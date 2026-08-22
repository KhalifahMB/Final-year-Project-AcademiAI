"""
Append-only audit log.
"""
from django.db import models

from apps.common.models import TenantScopedModel


class AuditLog(TenantScopedModel):
    actor = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="audit_actions"
    )
    action = models.CharField(max_length=100, db_index=True)
    entity_type = models.CharField(max_length=100)
    entity_id = models.UUIDField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant", "action"]),
            models.Index(fields=["tenant", "entity_type", "entity_id"]),
        ]
