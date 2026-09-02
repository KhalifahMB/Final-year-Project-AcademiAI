"""
Structured per-tenant logging. Never stores PII (passwords, tokens, raw auth bodies).
"""
from django.db import models


class TenantLog(models.Model):
    """Append-only structured log entry, scoped to a tenant."""

    class Level(models.TextChoices):
        DEBUG = "debug", "Debug"
        INFO = "info", "Info"
        WARNING = "warning", "Warning"
        ERROR = "error", "Error"

    class Category(models.TextChoices):
        AUTH = "auth", "Authentication"
        CHAT = "chat", "Chat"
        API = "api", "API"
        SYSTEM = "system", "System"
        RESOURCE = "resource", "Resource"
        AGENT = "agent", "Agent"

    id = models.BigAutoField(primary_key=True)
    tenant_id = models.UUIDField(db_index=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    level = models.CharField(max_length=10, choices=Level.choices, default=Level.INFO, db_index=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.API, db_index=True)
    action = models.CharField(max_length=100, db_index=True)

    # Actor (nullable for system actions)
    actor_id = models.UUIDField(null=True, blank=True)
    actor_email = models.CharField(max_length=255, blank=True, default="")

    # Request context
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=200, blank=True, default="")
    request_path = models.CharField(max_length=500, blank=True, default="")
    request_method = models.CharField(max_length=10, blank=True, default="")
    response_status_code = models.IntegerField(null=True, blank=True)
    response_time_ms = models.IntegerField(null=True, blank=True)

    # Structured details (JSON metadata)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "tenant_logs"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["tenant_id", "timestamp"]),
            models.Index(fields=["tenant_id", "level"]),
            models.Index(fields=["tenant_id", "category"]),
            models.Index(fields=["tenant_id", "action"]),
        ]

    def __str__(self):
        return f"[{self.level}] {self.action} ({self.category}) at {self.timestamp}"
