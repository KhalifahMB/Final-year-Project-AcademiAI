from django.contrib import admin
from .models import Resource, ResourceVersion, ResourceChunk, ResourceSummary


@admin.register(Resource)
class ResourceAdmin(admin.ModelAdmin):
    list_display = ("title", "processing_status", "visibility_scope", "tenant", "created_at")
    list_filter = ("processing_status", "visibility_scope")
    search_fields = ("title",)


@admin.register(ResourceVersion)
class ResourceVersionAdmin(admin.ModelAdmin):
    list_display = ("resource", "version_number", "storage_key", "created_at")


@admin.register(ResourceChunk)
class ResourceChunkAdmin(admin.ModelAdmin):
    list_display = ("resource_version", "chunk_index", "token_count", "tenant")
    list_filter = ("tenant",)


@admin.register(ResourceSummary)
class ResourceSummaryAdmin(admin.ModelAdmin):
    list_display = ("resource", "version_number", "word_count", "created_by", "created_at")
    list_filter = ("tenant",)
    search_fields = ("resource__title", "summary")
    raw_id_fields = ("resource", "created_by")
