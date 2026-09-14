"""
Chat viewsets and endpoints — thin HTTP layer only.

Business logic lives in the `chat/services/` package (store, retrieval,
turns). Views parse the request, delegate, and format the response.

- ChatSessionViewSet (list/retrieve/create/update title/delete)
- ChatMessageViewSet (read history)
- ChatSendMessageView  (synchronous — kept for compatibility)
- ChatQuickUploadView  (single-step in-chat file upload)
- ChatStreamMessageView (SSE streaming — ChatGPT-style typewriter UX)
"""
import json
import logging
import uuid

from django.conf import settings
from django.http import StreamingHttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from rest_framework import serializers as drf_serializers
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.db import tenant_scope
from apps.common.jobs import claim_job
from apps.common.permissions import IsTenantMember
from apps.common.security.file_validation import (
    validate_upload_bytes,
    FileValidationError,
    MAX_UPLOAD_BYTES,
)
from apps.common.storage import get_s3_client
from apps.common.throttling import AiRateThrottle, UploadRateThrottle
from apps.resources.models import Resource, ResourceVersion
from apps.resources.serializers import ResourceSerializer
from apps.resources.tasks import process_resource_ingestion

from .models import ChatSession
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
    queryset = ChatSession.objects.none()
    filterset_fields = ["session"]
    filter_backends = [DjangoFilterBackend]

    def get_queryset(self):
        from .models import ChatMessage

        if getattr(self, "swagger_fake_view", False):
            return ChatMessage.objects.none()
        qs = (
            ChatMessage.objects.filter(
                tenant=self.request.user.tenant,
                session__user=self.request.user,
            )
            .select_related("session")
            .prefetch_related("sources__chunk__resource_version__resource")
            .order_by("created_at")
        )
        # Backward-paging cursor: pass ?before=<ISO created_at> to fetch
        # messages older than that point (client keeps created_at ascending).
        before = self.request.query_params.get("before")
        if before:
            qs = qs.filter(created_at__lt=before)
        return qs

    @extend_schema(
        request=ChatMessageCreateSerializer,
        responses={201: ChatMessageSerializer},
        summary="Set feedback rating on an assistant message",
    )
    @action(detail=True, methods=["post"], url_path="rate")
    def rate(self, request, pk=None):
        class RateIn(drf_serializers.Serializer):
            rating = drf_serializers.ChoiceField(choices=[1, -1, 0], required=False)

        ser = RateIn(data=request.data)
        ser.is_valid(raise_exception=True)
        msg = self.get_object()
        rating = ser.validated_data.get("rating")
        msg.rating = rating if rating != 0 else None
        msg.save(update_fields=["rating"])
        return Response(ChatMessageSerializer(msg).data)


class ChatSendMessageView(APIView):
    """
    POST /api/v1/chat/sessions/{session_id}/messages/
    Synchronous send — kept for backwards compatibility. Delegates the whole
    turn (persist, retrieve, generate, cite) to chat.services.execute_send_turn.
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

        user_msg, assistant_msg = services.execute_send_turn(
            user, session, ser.validated_data["content"],
            ser.validated_data.get("resource_ids") or [],
        )

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
    throttle_classes = [AiRateThrottle, UploadRateThrottle]

    def post(self, request):
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
                f"{resource.id}/{uuid.uuid4()}"
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

        # Synchronous pre-work (runs inside the middleware tenant scope):
        # persist the user's message, set a fallback title, and resolve the
        # authorized grounding context once.
        user_msg = services.append_user_message(session, content)
        services.bump_session_title(session, content)
        chunks, retrieval_ms, confidence = services.retrieve_grounding_chunks(
            user, session, content, attached_resource_ids,
        )

        def sse_event(event: str, data: dict) -> bytes:
            return (
                f"event: {event}\n"
                f"data: {json.dumps(data, default=str)}\n\n"
            ).encode("utf-8")

        def stream():
            for event, payload in services.iter_stream_events(
                user, session, content, chunks, confidence, retrieval_ms, user_msg,
            ):
                yield sse_event(event, payload)

        response = StreamingHttpResponse(
            stream(), content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response