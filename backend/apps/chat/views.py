"""
Chat viewsets and endpoints:
- ChatSessionViewSet (list/retrieve/create/update title/delete)
- ChatMessageViewSet (read history)
- ChatSendMessageView  (synchronous — kept for compatibility)
- ChatStreamMessageView (SSE streaming — ChatGPT-style typewriter UX)
"""
import json
import logging

from django.db.models import Q
from django.http import StreamingHttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.db import tenant_scope
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
        attached_resource_ids = ser.validated_data.get("resource_ids") or []
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

        if attached_resource_ids:
            from apps.resources.models import Resource, ResourceChunk

            if user.role == "admin" or getattr(user, "is_superuser", False):
                visible = Resource.objects.filter(
                    tenant=user.tenant, id__in=attached_resource_ids,
                )
            else:
                from apps.resources.views import _authorized_resources_q as _auth_q

                visible = Resource.objects.filter(
                    _auth_q(user), tenant=user.tenant, id__in=attached_resource_ids,
                )
            attached_chunks = []
            for r in visible:
                latest = r.versions.order_by("-version_number").first()
                if not latest:
                    continue
                for rc in ResourceChunk.objects.filter(
                    resource_version=latest, tenant_id=user.tenant_id,
                ).order_by("chunk_index")[:10].values("id", "content"):
                    attached_chunks.append(
                        {
                            "id": str(rc["id"]),
                            "content": rc["content"],
                            "score": 1.0,
                            "method": "attached",
                        }
                    )
            seen = {c["id"] for c in attached_chunks}
            for c in chunks:
                cid = str(c.get("id"))
                if cid not in seen:
                    attached_chunks.append(c)
                    seen.add(cid)
            chunks = attached_chunks[:24]

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


class ChatQuickUploadView(APIView):
    """
    POST /api/v1/chat/upload/
    Multipart upload: file=<binary> [,session_id=<uuid>]

    Small convenience endpoint that accepts a browser file upload,
    stores it in MinIO under the tenant's chat-attachments partition,
    creates a private Resource owned by the user, kicks off async
    ingestion, and returns the resource metadata so the UI can attach
    the file as a chat reference.

    This avoids the two-step presign dance for small in-chat uploads.
    """

    permission_classes = [IsTenantMember]
    throttle_classes = [AiRateThrottle]

    def post(self, request):
        from django.conf import settings
        from apps.common.storage import get_s3_client
        from apps.common.security.file_validation import (
            validate_upload_bytes,
            FileValidationError,
            MAX_UPLOAD_BYTES,
        )
        from apps.resources.models import Resource, ResourceVersion
        from apps.resources.serializers import ResourceSerializer

        user = request.user
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response(
                {"success": False, "error": {"detail": "file field required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if uploaded.size and uploaded.size > MAX_UPLOAD_BYTES:
            return Response(
                {"success": False, "error": {"detail": "File exceeds the 25 MB limit."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = uploaded.read()
        try:
            validate_upload_bytes(data, uploaded.content_type or "", uploaded.name)
        except FileValidationError as e:
            return Response(
                {"success": False, "error": {"detail": str(e)}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Determine MIME type from the upload if missing.
        ct = (uploaded.content_type or "").lower() or "application/octet-stream"

        # Resolve optional session for course-offering scoping.
        session_id = request.data.get("session_id")
        course_offering = None
        if session_id:
            course_offering = (
                ChatSession.objects.filter(id=session_id, user=user, tenant=user.tenant)
                .values_list("course_offering_id", flat=True)
                .first()
            )

        # Open a tenant-scoped transaction for writes.
        import uuid as _uuid
        from apps.common.db import tenant_scope

        with tenant_scope(user.tenant_id):
            resource = Resource.objects.create(
                tenant=user.tenant,
                uploaded_by=user,
                title=uploaded.name or "Uploaded file",
                visibility_scope=Resource.Visibility.PRIVATE,
                mime_type=ct,
                course_offering_id=course_offering,
                processing_status=Resource.ProcessingStatus.PENDING,
            )
            key = (
                f"tenants/{user.tenant_id}/chat-attachments/{user.id}/"
                f"{resource.id}/{_uuid.uuid4()}"
            )
            try:
                client = get_s3_client()
                client.put_object(
                    Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                    Key=key,
                    Body=data,
                    ContentType=ct,
                )
            except Exception:
                logger.exception("Chat upload put_object failed")
                resource.delete()
                return Response(
                    {
                        "success": False,
                        "error": {"detail": "Could not store file. Try again."},
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            version = ResourceVersion.objects.create(
                tenant=user.tenant,
                resource=resource,
                version_number=1,
                storage_key=key,
                created_by=user,
                file_size_bytes=len(data),
            )
            resource.storage_key = key
            resource.save(update_fields=["storage_key", "updated_at"])

        # Dispatch ingestion OUTSIDE the RLS scope — the Celery task sets its
        # own tenant context.
        job_id = None
        try:
            from apps.resources.tasks import process_resource_ingestion
            from apps.common.jobs import claim_job

            task_result = process_resource_ingestion.delay(
                str(resource.id), str(version.id), str(user.tenant_id)
            )
            claim_job(task_result.id, user.id)
            job_id = task_result.id
        except Exception:
            logger.exception("Failed to enqueue ingestion for chat upload")

        return Response(
            {
                "success": True,
                "resource": ResourceSerializer(resource).data,
                "job_id": job_id,
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
        attached_resource_ids = ser.validated_data.get("resource_ids") or []
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

        # Fold in explicit user-attached resources: pull the most recent
        # version's top chunks for each attached resource (authorized via
        # RLS/ownership) and prepend them so they are always in context.
        attached_chunks = []
        if attached_resource_ids:
            from apps.resources.models import Resource, ResourceChunk

            # Validate ownership/visibility — user must be allowed to see
            # each attached resource. Admins see the whole tenant; other
            # roles use the same visibility filter as the resources list.
            if user.role == "admin" or getattr(user, "is_superuser", False):
                visible_resources = Resource.objects.filter(
                    tenant=user.tenant, id__in=attached_resource_ids,
                )
            else:
                from apps.resources.views import _authorized_resources_q as _auth_q

                visible_resources = Resource.objects.filter(
                    _auth_q(user), tenant=user.tenant, id__in=attached_resource_ids,
                )
            for r in visible_resources:
                latest = r.versions.order_by("-version_number").first()
                if not latest:
                    continue
                rcs = list(
                    ResourceChunk.objects.filter(
                        resource_version=latest,
                        tenant_id=user.tenant_id,
                    )
                    .order_by("chunk_index")[:10]
                    .values("id", "content", "chunk_index")
                )
                for rc in rcs:
                    attached_chunks.append(
                        {
                            "id": str(rc["id"]),
                            "content": rc["content"],
                            "score": 1.0,
                            "method": "attached",
                            "rank": 0,
                        }
                    )

        # Merge: attached first (highest priority), then hybrid results that
        # aren't duplicates, capped at a reasonable total.
        seen = {c["id"] for c in attached_chunks}
        for c in chunks:
            cid = str(c.get("id"))
            if cid in seen:
                continue
            seen.add(cid)
            attached_chunks.append(c)
        chunks = attached_chunks[:24]

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

            # IMPORTANT: this generator runs AFTER the middleware's atomic
            # block has exited (StreamingHttpResponse returns to the middleware
            # first, then Django iterates the response body). We must open our
            # own tenant-scoped transaction so RLS sees app.current_tenant_id
            # for all DB writes performed here.
            with tenant_scope(user.tenant_id):
                # Refresh session from DB inside this transaction so
                # save(update_fields=['updated_at']) works under RLS.
                session.refresh_from_db()
                assistant_msg = services.append_assistant_message(
                    session, answer, sources_meta,
                )
                payload = ChatMessageSerializer(assistant_msg).data

            yield sse_event("done", {"assistant_message": payload})

        response = StreamingHttpResponse(
            stream(), content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response
