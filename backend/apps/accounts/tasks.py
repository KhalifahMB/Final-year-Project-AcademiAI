"""
Email tasks (queue: email).
"""
import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_verification_email(self, user_id: str, code: str):
    from .models import User

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return
    subject = "Verify your AcademiAI account"
    message = (
        f"Hello,\n\nYour verification code is: {code}\n\n"
        f"This code expires in {settings.AUTH_VERIFICATION_CODE_EXPIRY_MINUTES} minutes.\n\n"
        "If you did not sign up, ignore this email."
    )
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
        logger.info("Verification email sent user_id=%s", user_id)
    except Exception as exc:
        logger.exception("Verification email failed user_id=%s", user_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_password_reset_email(self, user_id: str, token: str):
    from .models import User

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return
    subject = "Reset your AcademiAI password"
    # In production include a frontend deep link; token is never logged
    message = (
        f"Hello,\n\nUse this reset token with the password-reset/confirm endpoint:\n{token}\n\n"
        f"Expires in {settings.AUTH_PASSWORD_RESET_EXPIRY_MINUTES} minutes.\n\n"
        "If you did not request a reset, ignore this email."
    )
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
        logger.info("Password reset email sent user_id=%s", user_id)
    except Exception as exc:
        logger.exception("Password reset email failed user_id=%s", user_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_welcome_email(self, user_id: str):
    """Documented flow 2: sent once, after successful email verification."""
    from .models import User

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return
    subject = "Welcome to AcademiAI"
    message = (
        f"Hello {user.first_name or user.email},\n\n"
        "Your account has been verified. You can now sign in and start using "
        "your institution's AcademiAI workspace.\n\n"
        "If you did not create this account, contact your administrator."
    )
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
        logger.info("Welcome email sent user_id=%s", user_id)
    except Exception as exc:
        logger.exception("Welcome email failed user_id=%s", user_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_password_changed_email(self, user_id: str):
    """Documented flow 5: security notification — no secret material inside."""
    from .models import User

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return
    subject = "Your AcademiAI password was changed"
    message = (
        f"Hello {user.first_name or user.email},\n\n"
        "Your AcademiAI password was just changed. If this wasn't you, "
        "contact your institution's administrator immediately."
    )
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
        logger.info("Password-changed notification sent user_id=%s", user_id)
    except Exception as exc:
        logger.exception("Password-changed notification failed user_id=%s", user_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_tenant_suspension_emails(self, tenant_id: str):
    """Notify every active user of a tenant that it has been suspended and
    that access will be restricted after a 24-hour grace period."""
    from apps.tenants.models import Tenant
    from .models import User

    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return

    recipients = list(
        User.objects.filter(tenant_id=tenant.id, is_active=True)
        .values_list("email", flat=True)
        .iterator()
    )
    subject = f"AcademiAI access — {tenant.name} suspended"
    message = (
        f"Hello,\n\n"
        f"{tenant.name}'s AcademiAI workspace has been suspended by the "
        "platform team. You can still sign in for the next 24 hours; after "
        "that, account access will be restricted until the institution is "
        "reactivated.\n\n"
        "Please contact your institution's administrator for details."
    )
    sent = 0
    for email in recipients:
        try:
            send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False)
            sent += 1
        except Exception:
            logger.exception("Suspension notice failed tenant=%s one recipient", tenant.id)
    logger.info("Suspension notices sent tenant=%s count=%s", tenant.id, sent)


@shared_task
def restrict_suspended_tenant_logins():
    """
    Scheduled (hourly). Tenants suspended more than SUSPENSION_GRACE_HOURS
    ago lose login access: every non-superuser account is deactivated.
    Idempotent — deactivating an inactive user is a no-op.
    """
    from datetime import timedelta as _td

    from django.utils import timezone

    from apps.tenants.models import Tenant
    from .models import User

    grace_hours = int(getattr(settings, "SUSPENSION_GRACE_HOURS", 24))
    cutoff = timezone.now() - _td(hours=grace_hours)
    expired = Tenant.objects.filter(
        status=Tenant.Status.SUSPENDED,
        suspended_at__isnull=False,
        suspended_at__lte=cutoff,
    )
    total = 0
    for tenant in expired.iterator():
        qs = User.objects.filter(tenant_id=tenant.id, is_active=True).exclude(is_superuser=True)
        total += qs.update(is_active=False)
        logger.info("Restricted logins for suspended tenant=%s users=%s", tenant.id, total)
    return {"tenants": len(list(expired)), "deactivated": total}
