from django.contrib import admin
from .models import Tenant, TenantRequest


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "status", "plan", "created_at")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(TenantRequest)
class TenantRequestAdmin(admin.ModelAdmin):
    list_display = (
        "institution_name", "requester_email", "status",
        "institution_type", "created_at",
    )
    list_filter = ("status", "institution_type")
    search_fields = ("institution_name", "requester_email", "requester_name")
    readonly_fields = ("provisioned_tenant", "reviewed_at", "reviewed_by")
