from rest_framework import serializers
from .models import TenantLog


class TenantLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantLog
        fields = [
            "id", "timestamp", "level", "category", "action",
            "actor_id", "actor_email", "ip_address", "user_agent",
            "request_path", "request_method", "response_status_code",
            "response_time_ms", "details",
        ]
        read_only_fields = fields
