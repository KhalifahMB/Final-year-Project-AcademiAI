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
