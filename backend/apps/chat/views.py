from django.utils.decorators import method_decorator
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.throttling import AiRateThrottle
from apps.common.viewsets import TenantModelViewSet
from apps.common.permissions import IsTenantMember
from django_filters.rest_framework import DjangoFilterBackend

from .models import ChatSession, ChatMessage
from .serializers import (
    ChatSessionSerializer,
    ChatMessageSerializer,
    ChatMessageCreateSerializer,
)
from . import services


@extend_schema(tags=["Chat"])
class ChatSessionViewSet(TenantModelViewSet):
    queryset = ChatSession.objects.all()
    serializer_class = ChatSessionSerializer
    filterset_fields = ["course_offering"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ChatSession.objects.none()
        qs = super().get_queryset()
        return qs.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, user=self.request.user)


@extend_schema(tags=["Chat"])
class ChatMessageViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only conversation history. Filter by session:
    GET /chat/messages/?session=<uuid> — messages the caller owns.
    """

    serializer_class = ChatMessageSerializer
    permission_classes = [IsTenantMember]
    queryset = ChatMessage.objects.all()
    filterset_fields = ["session"]
    filter_backends = [DjangoFilterBackend]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ChatMessage.objects.none()
        return (
            ChatMessage.objects.filter(
                tenant=self.request.user.tenant,
                session__user=self.request.user,
            )
            .select_related("session")
            .prefetch_related("sources")
            .order_by("created_at")
        )


class ChatSendMessageView(APIView):
    """
    POST /api/v1/chat/sessions/{session_id}/messages/
    Body: { "content": "..." }
    Runs retrieval + Gemini (sync for MVP; can be moved to Celery for long answers).
    """
    permission_classes = [IsTenantMember]
    throttle_classes = [AiRateThrottle]

    @extend_schema(
        tags=["Chat"],
        request=ChatMessageCreateSerializer,
        responses={201: ChatMessageSerializer},
        summary="Send a user message and receive the grounded assistant reply",
        description=(
            "Stores the user message, retrieves relevant passages from "
            "authorized resources (hybrid retrieval), generates a grounded "
            "answer via Gemini with source citations, and returns both "
            "messages. Rate limited under the 'ai' scope."
        ),
    )
    def post(self, request, session_id):
        ser = ChatMessageCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        content = ser.validated_data["content"]
        user = request.user

        try:
            session = ChatSession.objects.get(
                id=session_id, user=user, tenant=user.tenant
            )
        except ChatSession.DoesNotExist:
            return Response(
                {"success": False, "error": {"detail": "Session not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        user_msg = services.append_user_message(session, content)

        # Title the session from its first message so history is scannable.
        if session.title in ("", "New chat", "Study chat"):
            session.title = content[:80]
            session.save(update_fields=["title", "updated_at"])

        # Retrieval + AI (authorization-first)
        from apps.knowledge.retrieval import hybrid_retrieve
        from apps.common.ai import generate_grounded_answer

        chunks = hybrid_retrieve(
            query=content,
            tenant_id=user.tenant_id,
            user=user,
            course_offering_id=str(session.course_offering_id) if session.course_offering_id else None,
            top_k=8,
        )
        answer, source_meta = generate_grounded_answer(
            query=content,
            chunks=chunks,
            user_role=user.role,
        )
        assistant_msg = services.append_assistant_message(session, answer, source_meta)

        return Response(
            {
                "success": True,
                "user_message": ChatMessageSerializer(user_msg).data,
                "assistant_message": ChatMessageSerializer(assistant_msg).data,
            },
            status=status.HTTP_201_CREATED,
        )
