from rest_framework import serializers
from .models import ChatSession, ChatMessage, ChatMessageSource


class ChatMessageSourceSerializer(serializers.ModelSerializer):
    """Citation with enough info for the UI to render a clickable source chip."""
    resource_id = serializers.SerializerMethodField()
    resource_title = serializers.SerializerMethodField()
    version_number = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessageSource
        fields = (
            "id", "chunk", "rank", "similarity_score", "retrieval_method",
            "resource_id", "resource_title", "version_number", "created_at",
        )
        read_only_fields = fields

    def get_resource_id(self, obj):
        chunk = obj.chunk
        rv = getattr(chunk, "resource_version", None) if chunk else None
        return str(rv.resource_id) if rv else None

    def get_resource_title(self, obj):
        chunk = obj.chunk
        rv = getattr(chunk, "resource_version", None) if chunk else None
        res = getattr(rv, "resource", None) if rv else None
        return res.title if res else None

    def get_version_number(self, obj):
        chunk = obj.chunk
        rv = getattr(chunk, "resource_version", None) if chunk else None
        return rv.version_number if rv else None


class ChatMessageSerializer(serializers.ModelSerializer):
    sources = ChatMessageSourceSerializer(many=True, read_only=True)

    class Meta:
        model = ChatMessage
        fields = (
            "id", "session", "role", "content", "content_type",
            "sources", "created_at",
        )
        read_only_fields = ("id", "role", "content_type", "created_at")


class ChatSessionSerializer(serializers.ModelSerializer):
    last_message_at = serializers.SerializerMethodField()
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = (
            "id", "title", "course_offering", "user", "tenant",
            "message_count", "last_message_at",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "user", "tenant", "created_at", "updated_at")

    def get_last_message_at(self, obj):
        last = obj.messages.order_by("-created_at").values_list("created_at", flat=True).first()
        return last.isoformat() if last else None

    def get_message_count(self, obj):
        return obj.messages.count()


class ChatMessageCreateSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=10000)
    # Optional list of resource IDs that the user explicitly attached to
    # this turn (from the library or quick upload). Their chunks are folded
    # into the RAG context alongside hybrid_retrieve results.
    resource_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list,
    )


class ChatSessionRenameSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=True, allow_blank=False)
