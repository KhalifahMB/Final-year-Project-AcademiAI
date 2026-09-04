"""
Agent views: SSE streaming endpoint and tool listing.
"""
import json
import logging
import time

from django.conf import settings
from django.http import StreamingHttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.db import tenant_scope
from apps.common.permissions import IsTenantMember
from apps.common.throttling import AiRateThrottle

from .agent_loop import CONTEXT_TYPES
from .models import AgentSession, AgentToolExecution
from .serializers import AgentSessionSerializer, AgentToolExecutionSerializer
from .tools import TOOL_DEFINITIONS, TOOL_REGISTRY

logger = logging.getLogger(__name__)


def sse_event(event_type, data):
    """Format an SSE event."""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


def _stream_events(client, user, message, context_type, session):
    """Yield SSE events for one agent turn, then update the session.

    Any exception raised here is caught by the caller (`stream`) which turns
    it into a terminating error event rather than a truncated HTTP response.
    """
    start_time = time.monotonic()

    if client is None:
        # Dev stub
        yield sse_event("token", {"text": f"Hello! I'm your AI agent. You said: {message}. (Set GEMINI_API_KEY for live responses.)"})
        yield sse_event("done", {"session_id": str(session.id)})
        return

    from .agent_loop import run_agent_turn

    full_response = ""
    for event_type, data in run_agent_turn(
        client,
        settings.GEMINI_MODEL,
        user,
        message,
        context_type,
        history=getattr(session, "recent_messages", None) or [],
        session=session,
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
    Body: { "message": "...", "context_type": "dashboard"|"chat"|"plans"|"resources" }

    Streams agent response as Server-Sent Events with tool call transparency.
    """
    permission_classes = [IsTenantMember]
    throttle_classes = [AiRateThrottle]

    def post(self, request):
        from apps.common.ai.gemini import _get_client

        message = request.data.get("message", "").strip()
        context_type = request.data.get("context_type", "dashboard")

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

        # Reuse the most recent open session for this user so the agent
        # conversation stays continuous instead of creating a fresh (stateless)
        # session on every request.
        session = (
            AgentSession.objects.filter(
                tenant=user.tenant, user=user,
            )
            .order_by("-last_active_at")
            .first()
        )
        if session is None:
            session = AgentSession.objects.create(
                tenant=user.tenant,
                user=user,
                context_type=context_type,
            )

        client = _get_client()

        def stream():
            try:
                yield from _stream_events(client, user, message, context_type, session)
            except Exception:
                logger.exception("Agent streaming failed user=%s session=%s", user.id, session.id)
                yield sse_event("error", {"message": "The agent encountered an internal error. Please try again."})

        response = StreamingHttpResponse(stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


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
class AgentSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """List agent sessions for the current user."""
    serializer_class = AgentSessionSerializer
    permission_classes = [IsTenantMember]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AgentSession.objects.none()
        return AgentSession.objects.filter(
            tenant=self.request.user.tenant,
            user=self.request.user,
        )
