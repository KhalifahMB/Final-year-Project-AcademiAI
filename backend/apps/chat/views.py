from django.utils.decorators import method_decorator
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.viewsets import TenantModelViewSet
from apps.common.permissions import IsTenantMember

from .models import ChatSession, ChatMessage
from .serializers import (
    ChatSessionSerializer,
    ChatMessageSerializer,
    ChatMessageCreateSerializer,
)
from . import services


class ChatSessionViewSet(TenantModelViewSet):
    queryset = ChatSession.objects.none()
    serializer_class = ChatSessionSerializer
    filterset_fields = ["course_offering"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ChatSession.objects.none()
        qs = super().get_queryset()
        return qs.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, user=self.request.user)


class ChatMessageViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ChatMessageSerializer
    permission_classes = [IsTenantMember]
    queryset = ChatMessage.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ChatMessage.objects.none()
        return ChatMessage.objects.filter(
            tenant=self.request.user.tenant,
            session__user=self.request.user,
        ).select_related("session").prefetch_related("sources")


class ChatSendMessageView(APIView):
    """
    POST /api/v1/chat/sessions/{session_id}/messages/
    Body: { "content": "..." }
    Runs retrieval + Gemini (sync for MVP; can be moved to Celery for long answers).
    """
    permission_classes = [IsTenantMember]

    @extend_schema(
        request=ChatMessageCreateSerializer,
        responses={201: ChatMessageSerializer},
        summary="Send a user message and receive the grounded assistant reply",
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
