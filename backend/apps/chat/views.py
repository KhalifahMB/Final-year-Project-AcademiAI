"""
Chat viewsets and endpoints:
- ChatSessionViewSet (list/retrieve/create/update title/delete)
- ChatMessageViewSet (read history)
- ChatSendMessageView  (synchronous — kept for compatibility)
- ChatStreamMessageView (SSE streaming — ChatGPT-style typewriter UX)
"""
import json
import logging

from django.http import StreamingHttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsTenantMember
from apps.common.throttling import AiRateThrottle
from django_filters.rest_framework import DjangoFilterBackend

from .models import ChatSession, ChatMessage
from .serializers import (
    ChatSessionSerializer,
    ChatMessageSerializer,
    ChatMessageCreateSerializer,
    ChatSessionRenameSerializer,
)
from . import services

logger = logging.getLogger(__name__)


@extend_schema(tags=["Chat"])
class ChatSessionViewSet(viewsets.ModelViewSet):
    """
    Chat session CRUD. Only the owning user sees their own sessions.
    Extra actions:
      PATCH  /chat/sessions/{id}/rename/  { "title": "..." }
      DELETE /chat/sessions/{id}/         (destroy is built-in)
    """

    serializer_class = ChatSessionSerializer
    permission_classes = [IsTenantMember]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ChatSession.objects.none()
        return (
            ChatSession.objects.filter(
                tenant=self.request.user.tenant, user=self.request.user,
            )
            .prefetch_related("messages")
            .order_by("-updated_at")
        )

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, user=self.request.user)

    def perform_destroy(self, instance):
        # Ownership enforced by queryset filtering; RLS also prevents cross-user.
        instance.delete()

    @extend_schema(
        request=ChatSessionRenameSerializer,
        responses=ChatSessionSerializer,
        summary="Rename a chat session",
    )
    @action(detail=True, methods=["patch"], url_path="rename")
    def rename(self, request, pk=None):
        session = self.get_object()
        ser = ChatSessionRenameSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        session.title = ser.validated_data["title"][:255]
        session.save(update_fields=["title", "updated_at"])
        return Response(ChatSessionSerializer(session).data)


@extend_schema(tags=["Chat"])
class ChatMessageViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only conversation history. GET /chat/messages/?session=<uuid>
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
            .prefetch_related("sources__chunk__resource_version__resource")
            .order_by("created_at")
        )


class ChatSendMessageView(APIView):
    """
    POST /api/v1/chat/sessions/{session_id}/messages/
    Synchronous send — kept for backwards compatibility.
    """

    permission_classes = [IsTenantMember]
    throttle_classes = [AiRateThrottle]

    @extend_schema(
        request=ChatMessageCreateSerializer,
        responses={201: ChatMessageSerializer},
        summary="Send a message (synchronous)",
    )
    def post(self, request, session_id):
        ser = ChatMessageCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        content = ser.validated_data["content"]
        user = request.user

        try:
            session = ChatSession.objects.get(
                id=session_id, user=user, tenant=user.tenant,
            )
        except ChatSession.DoesNotExist:
            return Response(
                {"success": False, "error": {"detail": "Session not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        user_msg = services.append_user_message(session, content)
        if session.title in ("", "New chat"):
            session.title = content[:80]
            session.save(update_fields=["title", "updated_at"])

        from apps.knowledge.retrieval import hybrid_retrieve
        from apps.common.ai import generate_grounded_answer

        chunks = hybrid_retrieve(
            query=content,
            tenant_id=user.tenant_id,
            user=user,
            course_offering_id=str(session.course_offering_id) if session.course_offering_id else None,
            top_k=8,
        )
        answer, source_meta = generate_grounded_answer(content, chunks, user.role)
        assistant_msg = services.append_assistant_message(session, answer, source_meta)

        return Response(
            {
                "success": True,
                "user_message": ChatMessageSerializer(user_msg).data,
                "assistant_message": ChatMessageSerializer(assistant_msg).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ChatStreamMessageView(APIView):
    """
    POST /api/v1/chat/sessions/{session_id}/messages/stream/
    Body: { "content": "..." }

    Streams the assistant response as Server-Sent Events. The final
    event (`event: done`) includes the full persisted assistant message
    with sources so the client can reconcile its local state.

    When no Gemini key is set, falls back to a single stub event (same
    behaviour as the sync endpoint) so dev preview still works.
    """

    permission_classes = [IsTenantMember]
    throttle_classes = [AiRateThrottle]

    def post(self, request, session_id):
        import hashlib

        from django.core.cache import cache
        from apps.knowledge.retrieval import hybrid_retrieve
        from apps.common.ai.gemini import (
            _get_client, _sanitize_context, SYSTEM_GROUNDING,
        )
        from django.conf import settings

        ser = ChatMessageCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        content = ser.validated_data["content"]
        user = request.user

        try:
            session = ChatSession.objects.get(
                id=session_id, user=user, tenant=user.tenant,
            )
        except ChatSession.DoesNotExist:
            return Response(
                {"success": False, "error": {"detail": "Session not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        user_msg = services.append_user_message(session, content)
        if session.title in ("", "New chat"):
            session.title = content[:80]
            session.save(update_fields=["title", "updated_at"])

        # Authorization-first retrieval (cached briefly keyed by tenant+query)
        cache_key = "rag:" + str(user.tenant_id) + ":" + hashlib.sha256(
            content.encode("utf-8"),
        ).hexdigest()[:16]
        chunks = cache.get(cache_key)
        if chunks is None:
            chunks = hybrid_retrieve(
                query=content, tenant_id=user.tenant_id, user=user,
                course_offering_id=str(session.course_offering_id) if session.course_offering_id else None,
                top_k=8,
            )
            cache.set(cache_key, chunks, 300)

        client = _get_client()

        def sse_event(event: str, data: dict) -> bytes:
            return (
                f"event: {event}\n"
                f"data: {json.dumps(data, default=str)}\n\n"
            ).encode("utf-8")

        def stream():
            # 1. Send back user message id so the UI can reconcile optimistic state
            yield sse_event("user_message", ChatMessageSerializer(user_msg).data)
            yield sse_event("meta", {
                "chunks_retrieved": len(chunks),
                "model": settings.GEMINI_MODEL if client else "dev-stub",
            })

            answer_parts = []

            if client is None:
                # Dev stub (no API key) — deterministic text, one token event
                stub = (
                    "(Dev stub — set GEMINI_API_KEY to enable streaming.) "
                    f"Based on {len(chunks)} retrieved chunk(s), a grounded "
                    f"response would address: {content[:200]}"
                )
                # Send in small chunks to mimic streaming
                words = stub.split(" ")
                buf = ""
                for w in words:
                    buf = (buf + " " + w).strip()
                    yield sse_event("token", {"text": w + " "})
                    answer_parts.append(w + " ")
                    import time; time.sleep(0.02)
                answer = stub
                sources_meta = [
                    {
                        "chunk_id": str(c.get("id")),
                        "rank": i + 1,
                        "similarity_score": c.get("score"),
                        "retrieval_method": c.get("method", "hybrid"),
                    }
                    for i, c in enumerate(chunks)
                ]
            else:
                # Build context + prompt the same way generate_grounded_answer does
                context_parts = []
                for i, c in enumerate(chunks):
                    body = _sanitize_context(c.get("content", ""))
                    context_parts.append(f"[Source {i + 1}] {body}")
                context_block = "\n\n".join(context_parts) or "(no authorized context retrieved)"
                prompt = (
                    f"CONTEXT:\n{context_block}\n\n"
                    f"USER QUESTION:\n{content}\n\n"
                    "Answer based only on CONTEXT."
                )

                try:
                    response = client.models.generate_content_stream(
                        model=settings.GEMINI_MODEL,
                        contents=prompt,
                        config={
                            "system_instruction": SYSTEM_GROUNDING,
                            "automatic_function_calling": {"disable": True},
                        },
                    )
                    for chunk in response:
                        txt = getattr(chunk, "text", "") or ""
                        if txt:
                            answer_parts.append(txt)
                            yield sse_event("token", {"text": txt})
                except Exception:
                    logger.exception("Streaming generation failed")
                    err = "The AI service is temporarily unavailable. Please try again."
                    yield sse_event("token", {"text": err})
                    answer_parts = [err]

                answer = "".join(answer_parts)
                sources_meta = [
                    {
                        "chunk_id": str(c.get("id")),
                        "rank": i + 1,
                        "similarity_score": c.get("score"),
                        "retrieval_method": c.get("method", "hybrid"),
                    }
                    for i, c in enumerate(chunks)
                ]

            assistant_msg = services.append_assistant_message(
                session, answer, sources_meta,
            )
            yield sse_event("done", {
                "assistant_message": ChatMessageSerializer(assistant_msg).data,
            })

        response = StreamingHttpResponse(
            stream(), content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response
