"""
Platform-wide models — not tenant-scoped.
"""
from django.db import models

from apps.common.models import UUIDModel, TimeStampedModel


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
