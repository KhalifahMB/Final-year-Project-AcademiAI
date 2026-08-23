from django.contrib import admin
from .models import ChatSession, ChatMessage, ChatMessageSource

@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "course_offering", "tenant", "updated_at")
    list_filter = ("tenant",)

@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ("session", "role", "created_at", "tenant")
    list_filter = ("role",)

admin.site.register(ChatMessageSource)
