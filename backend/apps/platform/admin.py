from django.contrib import admin
from .models import Announcement


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "priority", "target", "is_active", "created_at")
    list_filter = ("priority", "target", "is_active")
    search_fields = ("title", "body")
    filter_horizontal = ("target_tenants",)
