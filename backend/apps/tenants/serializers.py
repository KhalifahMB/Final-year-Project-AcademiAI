import re

from django.utils.text import slugify
from rest_framework import serializers
from .models import Tenant, TenantRequest


class TenantSerializer(serializers.ModelSerializer):
    """
    Read representation shared by all roles. Writes are split:
    tenant admins may rename their institution (name/domain only) while
    plan, status, slug and quota are platform-operator (superuser) controlled.
    """

    class Meta:
        model = Tenant
        fields = (
            "id", "name", "slug", "domain", "status", "plan",
            "storage_quota_bytes", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "slug", "status", "plan", "storage_quota_bytes",
            "created_at", "updated_at",
        )


class PlatformTenantSerializer(TenantSerializer):
    """
    Superuser-only representation: all fields manageable.
    """

    class Meta(TenantSerializer.Meta):
        fields = (
            "id", "name", "slug", "domain", "status", "plan",
            "storage_quota_bytes", "suspended_at",
            "allowed_email_domains",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "suspended_at", "created_at", "updated_at")
        extra_kwargs = {"slug": {"required": True}}


class TenantDirectorySerializer(serializers.ModelSerializer):
    """Public listing for the signup dropdown / landing-page directory."""

    class Meta:
        model = Tenant
        fields = ("id", "name", "slug")


# ----------------------------------------------------------------------
# TenantRequest (self-serve onboarding)
# ----------------------------------------------------------------------
class TenantRequestCreateSerializer(serializers.ModelSerializer):
    """Public submission form."""
    class Meta:
        model = TenantRequest
        fields = (
            "id", "requester_name", "requester_email", "requester_role",
            "phone_number", "institution_name", "institution_domain",
            "institution_type", "estimated_students", "notes",
            "created_at",
        )
        read_only_fields = ("id", "created_at")

    def validate_requester_email(self, value):
        return value.lower().strip()

    def validate_institution_name(self, value):
        if len(value.strip()) < 3:
            raise serializers.ValidationError("Institution name is too short.")
        return value.strip()

    def create(self, validated_data):
        name = validated_data["institution_name"]
        slug = slugify(name)[:90] or f"inst-{TenantRequest.objects.count() + 1}"
        # Make sure slug is unique across existing tenants & requests
        base = slug
        i = 1
        while (
            Tenant.objects.filter(slug=slug).exists()
            or TenantRequest.objects.filter(institution_slug=slug).exists()
        ):
            i += 1
            slug = f"{base}-{i}"[:90]
        validated_data["institution_slug"] = slug
        return super().create(validated_data)


class TenantRequestReviewSerializer(serializers.Serializer):
    """Superuser approval/rejection."""
    action = serializers.ChoiceField(choices=["approve", "reject"])
    review_notes = serializers.CharField(required=False, allow_blank=True)
    plan = serializers.CharField(required=False, default="standard")
    storage_quota_bytes = serializers.IntegerField(
        required=False, default=10 * 1024 ** 3,
    )


class TenantRequestSerializer(serializers.ModelSerializer):
    """Full read model for the superuser console."""
    reviewed_by_email = serializers.SerializerMethodField()
    provisioned_tenant_name = serializers.SerializerMethodField()

    class Meta:
        model = TenantRequest
        fields = "__all__"

    def get_reviewed_by_email(self, obj):
        return obj.reviewed_by.email if obj.reviewed_by else None

    def get_provisioned_tenant_name(self, obj):
        return obj.provisioned_tenant.name if obj.provisioned_tenant else None
