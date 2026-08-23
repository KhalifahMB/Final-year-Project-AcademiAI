from django.contrib import admin
from .models import Resource, ResourceVersion, ResourceChunk

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
