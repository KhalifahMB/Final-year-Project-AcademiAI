"""
Personal learning: notes, bookmarks, progress.
"""
from django.db import models

from apps.common.models import TenantScopedModel


class Note(TenantScopedModel):
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="notes")
    resource = models.ForeignKey(
        "resources.Resource",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notes",
    )
    title = models.CharField(max_length=255)
    content = models.TextField()

    class Meta:
        db_table = "notes"
        ordering = ["-updated_at"]


class Bookmark(TenantScopedModel):
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="bookmarks")
    resource = models.ForeignKey(
        "resources.Resource", on_delete=models.CASCADE, related_name="bookmarks"
    )

    class Meta:
        db_table = "bookmarks"
        constraints = [
            models.UniqueConstraint(fields=["user", "resource"], name="uniq_user_resource_bookmark")
        ]
        ordering = ["-created_at"]


class ProgressRecord(TenantScopedModel):
    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="progress_records"
    )
    concept = models.ForeignKey(
        "knowledge.Concept", on_delete=models.CASCADE, related_name="progress_records"
    )
    progress_value = models.FloatField(default=0.0)  # 0–1 or percentage
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "progress_records"
        constraints = [
            models.UniqueConstraint(fields=["user", "concept"], name="uniq_user_concept_progress")
        ]
