from rest_framework import serializers
from .models import ChatSession, ChatMessage, ChatMessageSource


class ChatMessageSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessageSource
        fields = (
            "id", "chunk", "rank", "similarity_score", "retrieval_method", "created_at",
        )
        read_only_fields = fields


class ChatMessageSerializer(serializers.ModelSerializer):
    sources = ChatMessageSourceSerializer(many=True, read_only=True)

    class Meta:
        model = ChatMessage
        fields = ("id", "session", "role", "content", "sources", "created_at")
        read_only_fields = ("id", "role", "created_at")


class ChatSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatSession
        fields = (
            "id", "title", "course_offering", "user", "tenant",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "user", "tenant", "created_at", "updated_at")


class ChatMessageCreateSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=10000)
    course_offering_id = serializers.UUIDField(required=False, allow_null=True)
