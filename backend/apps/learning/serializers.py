from rest_framework import serializers

from apps.resources.models import Resource

from .models import Note, Bookmark, ProgressRecord


class BookmarkResourceSerializer(serializers.ModelSerializer):
    """Lightweight material info embedded in bookmark listings."""

    class Meta:
        model = Resource
        fields = (
            "id", "title", "description", "visibility_scope",
            "processing_status", "mime_type",
        )


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ("id", "title", "content", "resource", "user", "tenant", "created_at", "updated_at")
        read_only_fields = ("id", "user", "tenant", "created_at", "updated_at")


class BookmarkSerializer(serializers.ModelSerializer):
    resource_detail = BookmarkResourceSerializer(source="resource", read_only=True)

    class Meta:
        model = Bookmark
        fields = ("id", "resource", "resource_detail", "user", "tenant", "created_at")
        read_only_fields = ("id", "user", "tenant", "created_at")

    def validate_resource(self, value):
        # The bookmarked material must belong to the bookmarking user's
        # tenant — never store cross-tenant references.
        request = self.context.get("request")
        if request is not None and value.tenant_id != request.user.tenant_id:
            raise serializers.ValidationError("Material not found in your institution.")
        return value


class ProgressRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgressRecord
        fields = ("id", "concept", "progress_value", "last_seen_at", "user", "tenant")
        read_only_fields = ("id", "user", "tenant", "last_seen_at")
