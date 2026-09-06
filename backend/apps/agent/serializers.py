from rest_framework import serializers

from .models import AgentSession, AgentSettings, AgentToolExecution
from .manifest import resolve_agent_key


class AgentSessionSerializer(serializers.ModelSerializer):
    preview = serializers.SerializerMethodField()

    class Meta:
        model = AgentSession
        fields = [
            "id", "title", "agent_key", "context_type", "preview",
            "started_at", "last_active_at", "message_count",
        ]
        read_only_fields = ["id", "preview", "started_at", "last_active_at", "message_count"]
        extra_kwargs = {
            "agent_key": {"required": False, "allow_blank": True},
            "title": {"required": False, "allow_blank": True},
        }

    def get_preview(self, obj):
        for message in reversed(obj.recent_messages or []):
            if isinstance(message, dict) and message.get("role") == "user":
                content = message.get("content") or ""
                return content[:140]
        return ""

    def validate_agent_key(self, value):
        value = value or ""
        user = self.context.get("request").user if self.context.get("request") else None
        role = getattr(user, "role", None) if user else None
        if value:
            resolved = resolve_agent_key(value, role)
            return resolved
        return value


class AgentSessionDetailSerializer(AgentSessionSerializer):
    class Meta(AgentSessionSerializer.Meta):
        fields = AgentSessionSerializer.Meta.fields + ["recent_messages"]


class AgentToolExecutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentToolExecution
        fields = [
            "id", "tool_name", "input_params", "output_summary",
            "execution_time_ms", "success", "timestamp",
        ]
        read_only_fields = fields


class AgentSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentSettings
        fields = ["enabled", "default_agent", "tone", "filters", "reminders_enabled"]
        extra_kwargs = {
            "default_agent": {"required": False, "allow_blank": True},
            "filters": {"required": False},
        }