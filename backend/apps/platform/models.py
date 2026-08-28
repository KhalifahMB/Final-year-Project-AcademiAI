"""
Platform-wide models — not tenant-scoped.
"""
from django.db import models

from apps.common.models import UUIDModel, TimeStampedModel


class AnnouncementSubscription(UUIDModel, TimeStampedModel):
    """
    Per-user email preference for announcement types.

    Announcement ``priority`` doubles as the announcement type. ``warning``
    and ``critical`` are treated as "important": they are always emailed and
    cannot be unsubscribed. ``info`` is the only opt-out-able type.

    A user with no row defaults to subscribed for every type, so preference
    records only need to exist once a user changes something.
    """

    class Meta:
        db_table = "platform_announcement_subscriptions"
        verbose_name = "Announcement subscription"
        verbose_name_plural = "Announcement subscriptions"

    user = models.OneToOneField(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="announcement_subscription",
    )
    # Subscribe to info (non-important) announcements. Important types
    # (warning/critical) are always sent and aren't toggleable.
    subscribe_info = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user.email} (info={'on' if self.subscribe_info else 'off'})"


class Announcement(UUIDModel, TimeStampedModel):
    class Priority(models.TextChoices):
        INFO = "info", "Info"
        WARNING = "warning", "Warning"
        CRITICAL = "critical", "Critical"

    class Target(models.TextChoices):
        ALL = "all", "All Tenants"
        SPECIFIC = "specific", "Specific Tenants"

    title = models.CharField(max_length=255)
    body = models.TextField()
    target = models.CharField(
        max_length=20, choices=Target.choices, default=Target.ALL
    )
    target_tenants = models.ManyToManyField(
        "tenants.Tenant", blank=True, related_name="announcements"
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.INFO,
    )
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="+",
    )

    class Meta:
        db_table = "platform_announcements"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
