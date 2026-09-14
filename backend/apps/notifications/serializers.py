from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "id", "kind", "severity", "title", "body", "link",
            "is_read", "created_at",
        )
        read_only_fields = fields


class NotificationPrefsUpdateSerializer(serializers.Serializer):
    """Toggle one notification kind: `{kind, enabled}`."""

    kind = serializers.CharField(max_length=60)
    enabled = serializers.BooleanField()