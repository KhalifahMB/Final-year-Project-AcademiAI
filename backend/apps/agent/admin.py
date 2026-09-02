from django.contrib import admin
from .models import AgentSession, AgentToolExecution


@admin.register(AgentSession)
class AgentSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "context_type", "message_count", "last_active_at")
    list_filter = ("context_type",)


@admin.register(AgentToolExecution)
class AgentToolExecutionAdmin(admin.ModelAdmin):
    list_display = ("tool_name", "session", "success", "execution_time_ms", "timestamp")
    list_filter = ("tool_name", "success")
