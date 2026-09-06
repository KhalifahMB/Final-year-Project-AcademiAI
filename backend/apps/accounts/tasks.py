"""
Email tasks (queue: email).

Every task renders a branded multipart message (HTML + plain-text fallback)
via ``apps.common.mail`` and delivers through the configured SMTP backend
(Mailpit in local dev). Retries are limited and no secret material (codes,
reset tokens) is ever logged.
"""
import logging

from celery import shared_task
from django.conf import settings

from apps.common.mail import send_email

logger = logging.getLogger(__name__)


def _frontend(path="/"):
    return settings.FRONTEND_URL + path


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_verification_email(self, user_id: str, code: str):
    from .models import User

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return
    subject = "AcademiAI — Verify your account"
    context = {
        "first_name": user.first_name or user.email,
        "code": code,
        "expiry_minutes": settings.AUTH_VERIFICATION_CODE_EXPIRY_MINUTES,
        "verify_url": _frontend("/verify-email"),
    }
    try:
        send_email(subject, [user.email], "verification_email", context)
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
    subject = "AcademiAI — Reset your password"
    context = {
        "first_name": user.first_name or user.email,
        "code": token,
        "reset_url": _frontend(f"/password-reset?token={token}"),
        "expiry_minutes": settings.AUTH_PASSWORD_RESET_EXPIRY_MINUTES,
    }
    try:
        send_email(subject, [user.email], "password_reset_email", context)
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
    context = {
        "first_name": user.first_name or user.email,
        "tenant_name": user.tenant.name if user.tenant else None,
        "dashboard_url": _frontend("/dashboard"),
    }
    try:
        send_email(subject, [user.email], "welcome_email", context)
        logger.info("Welcome email sent user_id=%s", user_id)
    except Exception as exc:
        logger.exception("Welcome email failed user_id=%s", user_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_password_changed_email(self, user_id: str):
    """Documented flow 5: security notification — no secret material inside."""
    from django.utils import timezone

    from .models import User

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return
    subject = "AcademiAI — Your password was changed"
    context = {
        "first_name": user.first_name or user.email,
        "changed_at": timezone.localtime().strftime("%B %d, %Y at %H:%M"),
        "reset_url": _frontend("/password-reset"),
    }
    try:
        send_email(subject, [user.email], "password_changed_email", context)
        logger.info("Password-changed notification sent user_id=%s", user_id)
    except Exception as exc:
        logger.exception("Password-changed notification failed user_id=%s", user_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_tenant_suspension_emails(self, tenant_id: str):
    """Notify every active user of a tenant that it has been suspended and
    that access will be restricted after a 24-hour (grace) period."""
    from apps.tenants.models import Tenant
    from .models import User

    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return

    grace_hours = int(getattr(settings, "SUSPENSION_GRACE_HOURS", 24))
    subject = f"AcademiAI access — {tenant.name} suspended"
    sent = 0
    for user in (
        User.objects.filter(tenant_id=tenant.id, is_active=True).iterator()
    ):
        context = {
            "first_name": user.first_name or user.email,
            "tenant_name": tenant.name,
            "grace_hours": grace_hours,
        }
        try:
            send_email(subject, [user.email], "tenant_suspension_email", context)
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