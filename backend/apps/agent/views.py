"""
Agent views: SSE streaming endpoint, identity manifest, settings, sessions.
"""
import json
import logging
import uuid

from django.conf import settings
from django.core.files.storage import default_storage
from django.http import StreamingHttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.db import tenant_scope
from apps.common.permissions import IsTenantMember
from apps.common.throttling import AiRateThrottle

from .agent_loop import CONTEXT_TYPES, run_agent_turn
from .manifest import identities_for_user, resolve_agent_key
from .models import AgentSession, AgentSettings
from .serializers import (
    AgentSessionDetailSerializer,
    AgentSessionSerializer,
    AgentSettingsSerializer,
)
from .tools import TOOL_DEFINITIONS

logger = logging.getLogger(__name__)


def sse_event(event_type, data):
    """Format an SSE event."""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


def _stream_events(client, user, message, context_type, session, agent_key=""):
    """Yield SSE events for one agent turn, then update the session.

    Any exception raised here is caught by the caller (`stream`) which turns
    it into a terminating error event rather than a truncated HTTP response.
    The tenant context is already bound by TenantContextMiddleware for the
    whole request, so writes here are RLS-safe.
    """
    if client is None:
        # Dev stub
        yield sse_event("token", {"text": f"Hello! I'm your ai agent. You said: {message}. (Set GEMINI_API_KEY for live responses.)"})
        yield sse_event("done", {"session_id": str(session.id)})
        return

    full_response = ""
    for event_type, data in run_agent_turn(
        client,
        settings.GEMINI_MODEL,
        user,
        message,
        context_type,
        history=getattr(session, "recent_messages", None) or [],
        session=session,
        agent_key=agent_key,
    ):
        if event_type == "token":
            full_response += data.get("text", "")
            yield sse_event("token", data)
        elif event_type == "tool_call":
            yield sse_event("tool_call", data)
        elif event_type == "tool_result":
            yield sse_event("tool_result", data)
        elif event_type == "error":
            yield sse_event("error", data)
        elif event_type == "done":
            yield sse_event("done", {
                "session_id": str(session.id),
                "response": data.get("response", full_response),
            })

    # Update session
    with tenant_scope(user.tenant_id):
        session.message_count += 1
        session.save(update_fields=["message_count", "last_active_at"])


class AgentStreamView(APIView):
    """
    POST /api/v1/agent/stream/
    Body: {
        "message": "...",
        "context_type": "dashboard"|"chat"|"plans"|"resources",
        "session_id": "<uuid>",  # optional: resume a specific session
        "agent": "tutor",        # optional: agent identity key
        "title": "..."           # optional: initial title for a new session
    }

    Streams agent response as Server-Sent Events with tool call transparency.
    """
    permission_classes = [IsTenantMember]
    throttle_classes = [AiRateThrottle]

    def post(self, request):
        from apps.common.ai.gemini import _get_client

        message = request.data.get("message", "").strip()
        context_type = request.data.get("context_type", "dashboard")
        session_id = request.data.get("session_id")
        requested_agent = request.data.get("agent", "")
        title = (request.data.get("title") or "").strip()[:140]

        if context_type not in CONTEXT_TYPES:
            return Response(
                {"success": False, "error": {"detail": "Invalid context_type."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not message:
            return Response(
                {"success": False, "error": {"detail": "message field is required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        agent_key = resolve_agent_key(requested_agent, user.role)

        session = None
        if session_id:
            session = (
                AgentSession.objects.filter(
                    id=session_id, tenant=user.tenant, user=user,
                )
                .filter(status="open")
                .first()
            )
            if session is None:
                return Response(
                    {"success": False, "error": {"detail": "Session not found."}},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            # No explicit session: create one for the current agent+context so
            # every conversation is resumable. The frontend chooses to reuse a
            # past session by sending its id.
            session = AgentSession.objects.create(
                tenant=user.tenant,
                user=user,
                context_type=context_type,
                agent_key=agent_key,
                title=title or "New conversation",
            )

        client = _get_client()

        def stream():
            try:
                yield from _stream_events(
                    client, user, message, context_type, session, agent_key=agent_key
                )
            except Exception:
                logger.exception("Agent streaming failed user=%s session=%s", user.id, session.id)
                yield sse_event("error", {"message": "The agent encountered an internal error. Please try again."})

        response = StreamingHttpResponse(stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


@extend_schema(tags=["Agent"])
class AgentIdentityListView(APIView):
    """
    GET /api/v1/agent/identities/
    Returns the agent identities available to the current user's role, the
    per-role default, and the user's persisted agent settings.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        payload = identities_for_user(user)

        settings_data = None
        if user.tenant_id:
            settings_obj, _ = AgentSettings.objects.get_or_create(
                tenant_id=user.tenant_id, user=user,
            )
            settings_data = AgentSettingsSerializer(settings_obj).data

        payload["settings"] = settings_data
        return Response(payload)


@extend_schema(tags=["Agent"])
class AgentSettingsView(APIView):
    """
    GET/PUT /api/v1/agent/settings/
    Read or update the current user's agent preferences (default agent, tone,
    AI filters, reminders, visibility, avatar).
    """
    permission_classes = [IsTenantMember]

    def _get_settings(self, user):
        settings_obj, _ = AgentSettings.objects.get_or_create(
            tenant_id=user.tenant_id, user=user,
        )
        return settings_obj

    def get(self, request):
        settings_obj = self._get_settings(request.user)
        return Response(AgentSettingsSerializer(settings_obj).data)

    def put(self, request):
        settings_obj = self._get_settings(request.user)
        serializer = AgentSettingsSerializer(
            settings_obj, data=request.data, partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


_ALLOWED_AVATAR_TYPES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/svg+xml": "svg",
}


@extend_schema(tags=["Agent"])
class AgentAvatarUploadView(APIView):
    """
    POST /api/v1/agent/avatar/
    Upload a custom agent avatar image. Accepts image/png, image/jpeg,
    image/webp and image/svg+xml (max 1 MB). Persists the file and returns the
    public URL to store in AgentSettings.avatar.
    """
    permission_classes = [IsTenantMember]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        from apps.common.throttling import UploadRateThrottle

        throttle = UploadRateThrottle()
        if not throttle.allow_request(request, self):
            return Response(
                {"success": False, "error": {"detail": "Upload rate limit exceeded."}},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        file = request.FILES.get("file")
        if not file:
            return Response(
                {"success": False, "error": {"detail": "file field is required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if file.size > 1_048_576:
            return Response(
                {"success": False, "error": {"detail": "Image must be 1 MB or smaller."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ext = _ALLOWED_AVATAR_TYPES.get(file.content_type or "")
        if not ext:
            return Response(
                {"success": False, "error": {"detail": "Unsupported image type."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        name = default_storage.save(
            f"agent/avatars/{uuid.uuid4().hex}.{ext}", file
        )
        return Response({"avatar": default_storage.url(name)})


@extend_schema(tags=["Agent"])
class AgentToolListView(APIView):
    """
    GET /api/v1/agent/tools/
    Returns the list of available agent tools (for transparency/debugging).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tools = []
        for t in TOOL_DEFINITIONS:
            tools.append({
                "name": t["name"],
                "description": t["description"],
            })
        return Response({"tools": tools})


@extend_schema(tags=["Agent"])
class AgentSessionViewSet(viewsets.ModelViewSet):
    """
    List, create, retrieve (with full recent_messages), rename and delete the
    current user's agent sessions. Sessions are always scoped to the owner's
    tenant and user; cross-tenant access is denied.
    """
    serializer_class = AgentSessionSerializer
    permission_classes = [IsTenantMember]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AgentSession.objects.none()
        return AgentSession.objects.filter(
            tenant=self.request.user.tenant,
            user=self.request.user,
        )

    def get_serializer_class(self):
        if self.action == "retrieve":
            return AgentSessionDetailSerializer
        return AgentSessionSerializer

    def perform_create(self, serializer):
        user = self.request.user
        agent_key = resolve_agent_key(
            serializer.validated_data.get("agent_key", ""), user.role
        )
        serializer.save(
            tenant_id=user.tenant_id,
            user=user,
            agent_key=agent_key,
            context_type=serializer.validated_data.get("context_type", "dashboard"),
            title=serializer.validated_data.get("title", "") or "New conversation",
        )

    def perform_destroy(self, instance):
        instance.delete()