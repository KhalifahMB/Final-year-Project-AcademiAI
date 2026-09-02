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
