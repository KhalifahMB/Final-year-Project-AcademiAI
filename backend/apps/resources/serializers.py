from rest_framework import serializers
from .models import Resource, ResourceVersion

class ResourceSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(source="uploaded_by.username", read_only=True, default=None)

    class Meta:
        model = Resource
        fields = (
            "id", "title", "description", "visibility_scope", "mime_type",
            "storage_key", "processing_status", "processing_error",
            "has_extractable_text",
            "course_offering", "programme", "department", "faculty",
            "uploaded_by", "uploaded_by_username", "tenant",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "storage_key", "processing_status", "processing_error",
            "has_extractable_text",
            "uploaded_by", "tenant", "created_at", "updated_at",
        )

class ResourceVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceVersion
        fields = (
            "id", "resource", "version_number", "storage_key", "checksum",
            "file_size_bytes", "created_by", "created_at",
        )
        read_only_fields = fields
