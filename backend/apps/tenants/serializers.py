from rest_framework import serializers
from .models import Tenant


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
    Superuser-only representation: every field is manageable. Slug is
    writable at creation (provisioning) but never updated — enforced in
    TenantViewSet.perform_update.
    """

    class Meta(TenantSerializer.Meta):
        fields = (
            "id", "name", "slug", "domain", "status", "plan",
            "storage_quota_bytes", "suspended_at",
            "allowed_email_domains", "branding",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "suspended_at", "allowed_email_domains",
            "branding", "created_at", "updated_at",
        )


class TenantDirectorySerializer(serializers.ModelSerializer):
    """Public listing for the signup dropdown / landing-page directory.
    Exposes only non-sensitive branding fields of ACTIVE tenants."""

    class Meta:
        model = Tenant
        fields = ("id", "name", "slug")
