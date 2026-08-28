"""
Announcement email delivery.

Dispatch is chunked so a large audience never blocks a single Celery task:
``dispatch_announcement_emails`` is the entry point called on publish — it
resolves the intended recipients once, splits them into batches, and fans out
one ``send_announcement_email_chunk`` subtask per batch.

Important announcements (priority warning/critical) are always emailed to the
intended recipients. Non-important (info) announcements skip users who have
opted out of 'info' email.
"""
import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)

CHUNK_SIZE = 200

_IMPORTANT_PRIORITIES = {"warning", "critical"}


def _recipient_ids(announcement):
    from apps.accounts.models import User
    from .models import Announcement

    qs = User.objects.filter(is_active=True, is_email_verified=True).exclude(
        tenant__isnull=True
    )
    if announcement.target == Announcement.Target.SPECIFIC:
        tenant_ids = list(
            announcement.target_tenants.values_list("id", flat=True)
        )
        qs = qs.filter(tenant_id__in=tenant_ids)

    important = announcement.priority in _IMPORTANT_PRIORITIES
    if not important:
        # Skip users who opted out of info announcements.
        qs = qs.exclude(
            announcement_subscription__subscribe_info=False
        )
    return list(qs.values_list("id", flat=True))


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def dispatch_announcement_emails(self, announcement_id: str):
    from .models import Announcement

    try:
        announcement = Announcement.objects.select_related().get(id=announcement_id)
    except Announcement.DoesNotExist:
        logger.warning("dispatch_announcement_emails: announcement %s missing", announcement_id)
        return {"total": 0}

    ids = _recipient_ids(announcement)
    total = len(ids)
    logger.info("dispatch_announcement_emails id=%s recipients=%d", announcement_id, total)

    for i in range(0, total, CHUNK_SIZE):
        batch = ids[i : i + CHUNK_SIZE]
        send_announcement_email_chunk.delay(announcement_id, batch)

    return {"total": total, "chunks": -(-total // CHUNK_SIZE) if total else 0}


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_announcement_email_chunk(self, announcement_id: str, user_ids):
    from apps.accounts.models import User
    from .models import Announcement

    try:
        announcement = Announcement.objects.get(id=announcement_id)
    except Announcement.DoesNotExist:
        logger.warning("send_announcement_email_chunk: announcement %s missing", announcement_id)
        return {"sent": 0}

    users = User.objects.filter(id__in=user_ids)
    subject = f"[{announcement.priority.upper()}] {announcement.title}"
    message = (
        f"{announcement.body}\n\n"
        "— AcademiAI"
    )
    sent = 0
    try:
        for user in users.iterator(chunk_size=200):
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
            sent += 1
        return {"sent": sent}
    except Exception as exc:
        logger.exception("Announcement chunk failed announcement_id=%s", announcement_id)
        raise self.retry(exc=exc)
