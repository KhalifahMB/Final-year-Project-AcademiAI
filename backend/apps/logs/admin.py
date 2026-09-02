from django.contrib import admin
from .models import TenantLog


@admin.register(TenantLog)
class TenantLogAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "level", "category", "action", "actor_email", "tenant_id")
    list_filter = ("level", "category", "tenant_id")
    search_fields = ("action", "actor_email", "request_path")
    readonly_fields = [f.name for f in TenantLog._meta.get_fields() if hasattr(f, "name")]
    ordering = ("-timestamp",)
