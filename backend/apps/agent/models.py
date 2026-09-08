"""
AI Agent session tracking and tool execution logs.
"""
from django.db import models
from apps.common.models import TenantScopedModel


class AgentSession(TenantScopedModel):
    """Tracks an AI agent conversation session."""
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="agent_sessions")
    context_type = models.CharField(
        max_length=20,
        choices=[
            ("dashboard", "Dashboard"),
            ("chat", "Chat"),
            ("plans", "Plans"),
            ("resources", "Resources"),
        ],
        default="dashboard",
    )
    agent_key = models.CharField(max_length=40, blank=True, default="")
    title = models.CharField(max_length=140, blank=True, default="New conversation")
    status = models.CharField(
        max_length=20,
        choices=[("open", "Open"), ("archived", "Archived")],
        default="open",
    )
    recent_messages = models.JSONField(default=list, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    last_active_at = models.DateTimeField(auto_now=True)
    message_count = models.IntegerField(default=0)

    class Meta:
        db_table = "agent_sessions"
        ordering = ["-last_active_at"]


class AgentToolExecution(TenantScopedModel):
    """Logs each tool invocation for transparency and debugging."""
    session = models.ForeignKey(AgentSession, on_delete=models.CASCADE, related_name="tool_executions")
    tool_name = models.CharField(max_length=100)
    input_params = models.JSONField(default=dict, blank=True)
    output_summary = models.TextField(blank=True, default="")
    execution_time_ms = models.IntegerField(null=True, blank=True)
    success = models.BooleanField(default=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "agent_tool_executions"
        ordering = ["-timestamp"]


class AgentSettings(TenantScopedModel):
    """Per-user agent preferences (identity default, tone, AI filters)."""
    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="agent_settings")
    enabled = models.BooleanField(default=True)
    default_agent = models.CharField(max_length=40, blank=True, default="")
    tone = models.CharField(
        max_length=20,
        choices=[("concise", "Concise"), ("balanced", "Balanced"), ("coach", "Coach")],
        default="balanced",
    )
    filters = models.JSONField(
        default=dict,
        blank=True,
        help_text="AI filters toggles, e.g. {'ableism': True, 'reading_order': True, 'itim': False}.",
    )
    reminders_enabled = models.BooleanField(default=True)
    avatar = models.CharField(
        max_length=300,
        blank=True,
        default="",
        help_text="Optional custom avatar URL (uploaded image or curated SVG path).",
    )

    def filter_enabled(self, name, default=True):
        return bool((self.filters or {}).get(name, default))

    class Meta:
        db_table = "agent_settings"
