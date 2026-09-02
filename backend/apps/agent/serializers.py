from rest_framework import serializers
from .models import AgentSession, AgentToolExecution


class AgentSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentSession
        fields = [
            "id", "context_type", "started_at", "last_active_at", "message_count",
        ]
        read_only_fields = ["id", "started_at", "last_active_at", "message_count"]


class AgentToolExecutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentToolExecution
        fields = [
            "id", "tool_name", "input_params", "output_summary",
            "execution_time_ms", "success", "timestamp",
        ]
        read_only_fields = fields
