from rest_framework import serializers
from .models import Announcement, AnnouncementSubscription


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_email = serializers.CharField(source="created_by.email", read_only=True, default=None)

    class Meta:
        model = Announcement
        fields = (
            "id", "title", "body", "target", "target_tenants",
            "priority", "is_active",
            "created_by", "created_by_email",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_by", "created_at", "updated_at")

    def create(self, validated_data):
        target_tenants = validated_data.pop("target_tenants", [])
        validated_data["created_by"] = self.context["request"].user
        announcement = Announcement.objects.create(**validated_data)
        if target_tenants:
            announcement.target_tenants.set(target_tenants)
        return announcement

    def update(self, instance, validated_data):
        target_tenants = validated_data.pop("target_tenants", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if target_tenants is not None:
            instance.target_tenants.set(target_tenants)
        return instance


class AnnouncementPublicSerializer(serializers.ModelSerializer):
    """Read-only for tenant-facing active announcements."""

    class Meta:
        model = Announcement
        fields = ("id", "title", "body", "priority", "created_at")
        read_only_fields = fields


class AnnouncementSubscriptionSerializer(serializers.ModelSerializer):
    """
    Per-user announcement email preferences. Only the 'info' type is
    opt-out-able; warning/critical ("important") are always emailed.
    """

    class Meta:
        model = AnnouncementSubscription
        fields = ("subscribe_info", "updated_at")
        read_only_fields = ("updated_at",)

    def update(self, instance, validated_data):
        instance.subscribe_info = validated_data.get(
            "subscribe_info", instance.subscribe_info
        )
        instance.save(update_fields=["subscribe_info", "updated_at"])
        return instance


class AnnouncementSubscriptionInputSerializer(serializers.Serializer):
    """Shape for creating/updating preferences in a single call."""

    subscribe_info = serializers.BooleanField(default=True)
