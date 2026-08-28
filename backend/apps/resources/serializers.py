from rest_framework import serializers
from .models import Resource, ResourceVersion, ResourceSummary


class ResourceSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(source="uploaded_by.username", read_only=True, default=None)
    latest_summary = serializers.SerializerMethodField()

    class Meta:
        model = Resource
        fields = (
            "id", "title", "description", "visibility_scope", "mime_type",
            "storage_key", "processing_status", "processing_error",
            "has_extractable_text",
            "course_offering", "programme", "department", "faculty",
            "uploaded_by", "uploaded_by_username", "tenant",
            "created_at", "updated_at", "latest_summary",
        )
        read_only_fields = (
            "id", "storage_key", "processing_status", "processing_error",
            "has_extractable_text",
            "uploaded_by", "tenant", "created_at", "updated_at",
            "latest_summary",
        )

    def get_latest_summary(self, obj):
        s = getattr(obj, "prefetched_latest_summary", None)
        if s is None:
            s = obj.summaries.order_by("-created_at").first()
        if s is None:
            return None
        return {
            "id": str(s.id),
            "summary": s.summary,
            "key_points": s.key_points or [],
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "created_by_name": (
                f"{s.created_by.first_name} {s.created_by.last_name}".strip()
                if s.created_by else None
            ),
        }


class ResourceVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceVersion
        fields = (
            "id", "resource", "version_number", "storage_key", "checksum",
            "file_size_bytes", "created_by", "created_at",
        )
        read_only_fields = fields


class ResourceSummarySerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ResourceSummary
        fields = (
            "id", "resource", "version_number", "created_by",
            "created_by_name", "summary", "key_points",
            "word_count", "model_name", "created_at",
        )
        read_only_fields = fields

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.email
