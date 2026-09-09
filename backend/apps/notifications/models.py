"""
User notifications feed.

Each row is one actionable alert for a single user, scoped to their tenant
for RLS. Rows are kept in sync with live in-app state by
`apps.notifications.services.sync_user_notifications` (computed on read, so a
notification never goes stale). The `key` column is a stable dedupe key so the
feed is idempotent across syncs.
"""
from django.db import models

from apps.common.models import TenantScopedModel


class Notification(TenantScopedModel):
    class Severity(models.TextChoices):
        INFO = "info", "Info"
        WARN = "warn", "Warning"
        CRITICAL = "critical", "Critical"

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
    )
    # Stable machine key used to upsert the same alert across syncs
    # (e.g. "course_behind:<offering-id>"). Unique per user+tenant.
    key = models.CharField(max_length=160)
    # Semantic type tag (e.g. "course_behind", "pipeline_failed").
    kind = models.CharField(max_length=60)
    severity = models.CharField(max_length=12, choices=Severity.choices, default=Severity.INFO)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True, default="")
    # Client-side route the alert links to ("" when there is no destination).
    link = models.CharField(max_length=200, blank=True, default="")
    is_read = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "user", "key"],
                name="uniq_notification_key_per_user",
            )
        ]
        indexes = [
            models.Index(fields=["tenant", "user", "is_read"]),
            models.Index(fields=["tenant", "user", "severity", "is_read"]),
        ]


class NotificationPreference(TenantScopedModel):
    """Per-user opt-in/out for each notification *kind*.

    When a kind is disabled, alerts of that kind are suppressed in the sync
    service and any still-unread rows for that kind are cleaned up, so a
    user who mutes a kind sees neither new nor lingering alerts for it.
    """

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="notification_preferences",
        db_index=True,
    )
    kind = models.CharField(max_length=60)
    enabled = models.BooleanField(default=True)

    class Meta:
        db_table = "notification_preferences"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "user", "kind"],
                name="uniq_notification_pref_per_user_kind",
            )
        ]
        indexes = [
            models.Index(fields=["tenant", "user", "kind"]),
        ]