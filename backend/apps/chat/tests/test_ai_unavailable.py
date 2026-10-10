"""
An unavailable AI backend must surface as an explicit, user-safe error — never
as a fabricated answer.

The chat stream used to emit a "(Dev stub — set GEMINI_API_KEY to enable
streaming.) Based on N retrieved chunk(s) ..." string as ordinary `token`
events. The UI rendered that as the assistant's reply and the backend persisted
it, so a missing API key looked like a working (if useless) answer. These tests
pin the replacement contract:

  - keyless/out-of-service  ->  `error` event, no tokens, nothing persisted
  - the same for the synchronous POST path (HTTP 503)
"""
import json
import pytest
from unittest.mock import patch

from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.chat.models import ChatSession, ChatMessage
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026"


def _tenant(slug="ai-off"):
    return Tenant.objects.create(name=f"Univ {slug}", slug=slug)


def _user(t, email, role="student"):
    return User.objects.create_user(
        email=email, password=PASSWORD, role=role, tenant=t,
        is_active=True, is_email_verified=True,
    )


def _sse_events(response):
    """Parse a StreamingHttpResponse body into (event, data) pairs."""
    body = b"".join(response.streaming_content).decode("utf-8")
    out = []
    for frame in body.split("\n\n"):
        if not frame.strip():
            continue
        event = data = None
        for line in frame.split("\n"):
            if line.startswith("event: "):
                event = line[7:].strip()
            elif line.startswith("data: "):
                data = line[6:]
        if event:
            out.append((event, json.loads(data) if data else None))
    return out


@pytest.mark.django_db
def test_stream_emits_error_event_when_ai_unavailable():
    tenant = _tenant("stream-off")
    student = _user(tenant, "s@stream-off.edu")
    session = ChatSession.objects.create(tenant=tenant, user=student, title="t")

    with patch("apps.chat.views.ai_service_available", return_value=False):
        client = APIClient()
        client.force_authenticate(student)
        resp = client.post(
            f"/api/v1/chat/sessions/{session.id}/messages/stream/",
            {"content": "Summarize the key ideas from my course materials."},
            format="json",
        )

    assert resp.status_code == 503, resp.data
    detail = resp.data["error"]["detail"]
    assert "unavailable" in detail.lower()
    assert "Dev stub" not in detail
    assert "GEMINI_API_KEY" not in detail
    # Rejected before persisting: no stranded user message.
    assert not ChatMessage.objects.filter(session=session).exists()


@pytest.mark.django_db
def test_stream_generator_yields_error_event_not_stub_tokens():
    """Unit-level: the generator itself must terminate with `error` and never
    emit `token` events when the backend is keyless."""
    from apps.chat.services.store import append_user_message
    from apps.chat.services.turns import iter_stream_events

    tenant = _tenant("gen-off")
    student = _user(tenant, "s@gen-off.edu")
    session = ChatSession.objects.create(tenant=tenant, user=student, title="t")
    user_msg = append_user_message(session, "hi")

    with patch("apps.chat.services.turns._get_client", return_value=None):
        events = list(
            iter_stream_events(student, session, "hi", [], "low", 5, user_msg)
        )

    names = [name for name, _ in events]
    assert "token" not in names, "must not stream placeholder tokens"
    assert "done" not in names, "must not report success"
    assert names[-1] == "error"

    message = events[-1][1]["message"]
    assert "unavailable" in message.lower()
    assert "Dev stub" not in message
    assert "GEMINI_API_KEY" not in message
    assert "retrieved chunk" not in message
    # Nothing may be persisted as the assistant's reply.
    assert not ChatMessage.objects.filter(session=session, role="assistant").exists()


@pytest.mark.django_db
def test_stream_error_event_on_live_failure_persists_nothing():
    """A mid-stream failure reports `error` and stores no partial reply."""
    from apps.chat.services.store import append_user_message
    from apps.chat.services.turns import iter_stream_events

    class BrokenStream:
        def __iter__(self):
            raise RuntimeError("upstream 503")

    class BrokenClient:
        class models:
            @staticmethod
            def generate_content_stream(**kwargs):
                return BrokenStream()

    tenant = _tenant("gen-broken")
    student = _user(tenant, "s@gen-broken.edu")
    session = ChatSession.objects.create(tenant=tenant, user=student, title="t")
    user_msg = append_user_message(session, "hi")

    with patch("apps.chat.services.turns._get_client", return_value=BrokenClient()):
        events = list(
            iter_stream_events(student, session, "hi", [], "low", 5, user_msg)
        )

    names = [name for name, _ in events]
    assert names[-1] == "error"
    assert "token" not in names
    message = events[-1][1]["message"]
    assert "upstream 503" not in message, "must not leak the raw error"
    assert not ChatMessage.objects.filter(session=session, role="assistant").exists()


@pytest.mark.django_db
def test_stream_empty_completion_is_an_error_not_a_blank_reply():
    """A stream that yields no tokens is a failed generation, not an answer."""
    from apps.chat.services.store import append_user_message
    from apps.chat.services.turns import iter_stream_events

    class EmptyStream:
        def __iter__(self):
            return iter(())

    class EmptyClient:
        class models:
            @staticmethod
            def generate_content_stream(**kwargs):
                return EmptyStream()

    tenant = _tenant("gen-empty")
    student = _user(tenant, "s@gen-empty.edu")
    session = ChatSession.objects.create(tenant=tenant, user=student, title="t")
    user_msg = append_user_message(session, "hi")

    with patch("apps.chat.services.turns._get_client", return_value=EmptyClient()):
        events = list(
            iter_stream_events(student, session, "hi", [], "low", 5, user_msg)
        )

    names = [name for name, _ in events]
    assert names[-1] == "error"
    assert "done" not in names
    assert not ChatMessage.objects.filter(session=session, role="assistant").exists()


@pytest.mark.django_db
def test_sync_send_returns_503_and_persists_no_placeholder():
    tenant = _tenant("sync-off")
    student = _user(tenant, "s@sync-off.edu")
    session = ChatSession.objects.create(tenant=tenant, user=student, title="t")

    with patch("apps.chat.services.turns.ai_service_available", return_value=False):
        client = APIClient()
        client.force_authenticate(student)
        resp = client.post(
            f"/api/v1/chat/sessions/{session.id}/messages/",
            {"content": "Summarize the key ideas."},
            format="json",
        )

    assert resp.status_code == 503, resp.data
    detail = resp.data["error"]["detail"]
    assert "unavailable" in detail.lower()
    assert "Dev stub" not in detail
    assert "GEMINI_API_KEY" not in detail
    assert not ChatMessage.objects.filter(session=session).exists()


@pytest.mark.django_db
def test_agent_stream_returns_503_without_creating_a_session():
    """The agent panel had the same fabricated greeting. An unavailable
    service must 503 and must not create an empty conversation."""
    from apps.agent.models import AgentSession

    tenant = _tenant("agent-off")
    student = _user(tenant, "s@agent-off.edu")

    with patch("apps.agent.views.ai_service_available", return_value=False):
        client = APIClient()
        client.force_authenticate(student)
        resp = client.post(
            "/api/v1/agent/stream/",
            {"message": "Explain recursion", "context_type": "chat"},
            format="json",
        )

    assert resp.status_code == 503, resp.data
    detail = resp.data["error"]["detail"]
    assert "unavailable" in detail.lower()
    assert "GEMINI_API_KEY" not in detail
    assert not AgentSession.objects.filter(tenant=tenant).exists()