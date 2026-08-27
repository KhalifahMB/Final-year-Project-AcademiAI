"""
Auth domain services: signup, verification, password reset.
Never log codes or tokens.
"""
import hashlib
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.tenants.models import Tenant
from .models import User
from apps.audit.services import log_action
from .models import EmailVerificationCode, PasswordResetToken

logger = logging.getLogger(__name__)


def _hash_value(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def create_verification_code(user: User) -> str:
    """Generate a single-use verification code; return plaintext only for email delivery."""
    code = f"{secrets.randbelow(10**6):06d}"
    EmailVerificationCode.objects.filter(user=user, is_used=False).update(is_used=True)
    EmailVerificationCode.objects.create(
        user=user,
        code_hash=_hash_value(code),
        expires_at=timezone.now()
        + timedelta(minutes=settings.AUTH_VERIFICATION_CODE_EXPIRY_MINUTES),
    )
    return code


def verify_email_code(email: str, code: str) -> User:
    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        raise ValueError("Invalid verification code.")

    qs = EmailVerificationCode.objects.filter(
        user=user, is_used=False, expires_at__gt=timezone.now()
    ).order_by("-created_at")
    record = qs.first()
    if not record:
        raise ValueError("Invalid or expired verification code.")

    if record.attempts >= settings.AUTH_MAX_VERIFICATION_ATTEMPTS:
        raise ValueError("Too many attempts. Request a new code.")

    if record.code_hash != _hash_value(code):
        record.attempts += 1
        record.save(update_fields=["attempts"])
        raise ValueError("Invalid or expired verification code.")

    record.is_used = True
    record.save(update_fields=["is_used"])
    first_verification = not user.is_email_verified
    user.is_email_verified = True
    user.save(update_fields=["is_email_verified"])

    # Documented flow: welcome email after successful (first) verification.
    if first_verification:
        try:
            from .tasks import send_welcome_email

            send_welcome_email(str(user.id))
        except Exception:
            logger.exception("Failed to queue welcome email")
        # First-time onboarding: auto-enrol students into the course
        # offerings of their programme's department.
        try:
            from apps.academics.services import auto_enroll_student

            auto_enroll_student(user)
        except Exception:
            logger.exception("Auto-enrollment failed user=%s", user.id)
    log_action(
        tenant=user.tenant,
        actor=user,
        action="user.email_verified",
        entity_type="user",
        entity_id=str(user.id),
    )
    return user


def signup_user(
    *,
    email,
    password,
    first_name="",
    last_name="",
    role="student",
    tenant_slug=None,
    programme_id=None,
    gender="",
    avatar_preset="",
):
    tenant = None
    if tenant_slug:
        tenant = Tenant.objects.filter(slug=tenant_slug, status=Tenant.Status.ACTIVE).first()
        if not tenant:
            raise ValueError("Tenant not found or inactive.")

    if User.objects.filter(email__iexact=email, tenant=tenant).exists():
        raise ValueError("A user with this email already exists for this institution.")

    # Anonymous signup requests carry no tenant context; academic tables are
    # RLS-protected, so resolve + write inside an explicit scope.
    programme = None
    if tenant is not None:
        from apps.common.db import tenant_scope
        from django.db import transaction

        with tenant_scope(str(tenant.id)), transaction.atomic():
            if programme_id:
                from apps.academics.models import Programme

                # Cross-tenant ids simply resolve to None here (IDOR-safe).
                programme = Programme.objects.filter(id=programme_id).first()

            user = User.objects.create_user(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role=role,
                tenant=tenant,
                is_email_verified=False,
                gender=gender or "",
                avatar_preset=avatar_preset or "",
            )

            from .models import LecturerProfile, StudentProfile

            if role == User.Role.STUDENT:
                StudentProfile.objects.create(user=user, tenant=tenant, programme=programme)
            elif role == User.Role.LECTURER:
                LecturerProfile.objects.create(user=user, tenant=tenant)
    else:
        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=role,
            tenant=None,
            is_email_verified=False,
        )

    code = create_verification_code(user)
    log_action(
        tenant=user.tenant,
        actor=user,
        action="user.signup",
        entity_type="user",
        entity_id=str(user.id),
        metadata={"role": role},
    )
    return user, code


def reactivate_tenant_users(tenant) -> int:
    """Restore login access after a suspension is lifted."""
    return User.objects.filter(tenant_id=tenant.id, is_active=False).exclude(
        is_superuser=True
    ).update(is_active=True)


def create_password_reset_token(user: User) -> str:
    token = secrets.token_urlsafe(32)
    PasswordResetToken.objects.filter(user=user, is_used=False).update(is_used=True)
    PasswordResetToken.objects.create(
        user=user,
        token_hash=_hash_value(token),
        expires_at=timezone.now()
        + timedelta(minutes=settings.AUTH_PASSWORD_RESET_EXPIRY_MINUTES),
    )
    return token


def confirm_password_reset(email: str, token: str, new_password: str) -> None:
    # Do not reveal whether email exists
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return
    record = (
        PasswordResetToken.objects.filter(
            user=user, is_used=False, expires_at__gt=timezone.now()
        )
        .order_by("-created_at")
        .first()
    )
    if not record or record.token_hash != _hash_value(token):
        raise ValueError("Invalid or expired reset token.")
    record.is_used = True
    record.save(update_fields=["is_used"])
    user.set_password(new_password)
    user.save(update_fields=["password"])
    # Security notification per email-services.md flow 5.
    try:
        from .tasks import send_password_changed_email

        send_password_changed_email(str(user.id))
    except Exception:
        logger.exception("Failed to queue password-changed notification")
    log_action(
        tenant=user.tenant,
        actor=user,
        action="user.password_reset",
        entity_type="user",
        entity_id=str(user.id),
    )
