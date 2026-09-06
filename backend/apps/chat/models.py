"""
AI chat sessions, messages, and source citations.
"""
from django.db import models

from apps.common.models import TenantScopedModel


class ChatSession(TenantScopedModel):
    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="chat_sessions"
    )
    title = models.CharField(max_length=255, blank=True, default="New chat")
    course_offering = models.ForeignKey(
        "academics.CourseOffering",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_sessions",
    )

    class Meta:
        db_table = "chat_sessions"
        ordering = ["-updated_at"]


class ChatMessage(TenantScopedModel):
    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"
        SYSTEM = "system", "System"

    class ContentType(models.TextChoices):
        TEXT = "text", "Text"
        MARKDOWN = "markdown", "Markdown"
        FORMULA = "formula", "Formula"
        SYSTEM_EVENT = "system_event", "System Event"

    class Confidence(models.TextChoices):
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"
        LOW = "low", "Low"
        NONE = "none", "None"

    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=20, choices=Role.choices)
    content = models.TextField()
    content_type = models.CharField(
        max_length=20, choices=ContentType.choices, default=ContentType.MARKDOWN
    )
    confidence = models.CharField(
        max_length=10, choices=Confidence.choices, null=True, blank=True,
        help_text="Answer confidence based on retrieval quality.",
    )
    rating = models.SmallIntegerField(
        null=True, blank=True,
        choices=[(1, "Good"), (-1, "Bad")],
        help_text="User feedback on answer quality (1 = good, -1 = bad).",
    )

    class Meta:
        db_table = "chat_messages"
        ordering = ["created_at"]


class ChatMessageSource(TenantScopedModel):
    message = models.ForeignKey(ChatMessage, on_delete=models.CASCADE, related_name="sources")
    chunk = models.ForeignKey(
        "resources.ResourceChunk", on_delete=models.CASCADE, related_name="+"
    )
    rank = models.PositiveIntegerField()
    similarity_score = models.FloatField(null=True, blank=True)
    retrieval_method = models.CharField(max_length=50, blank=True)  # semantic, lexical, hybrid, concept

    class Meta:
        db_table = "chat_message_sources"
        ordering = ["rank"]
