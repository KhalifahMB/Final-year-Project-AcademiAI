"""
The chat session list must not fan out per-session queries.

ChatSessionSerializer reports ``message_count`` and ``last_message_at``. Read
through the related manager those each cost an extra query per row, so the list
degrades to 1 + 2N. The viewset now annotates them instead, and the serializer
falls back to the per-object query for a freshly created (un-annotated)
instance such as a POST response.
"""
from types import SimpleNamespace

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.accounts.models import User
from apps.chat.models import ChatMessage, ChatSession
from apps.chat.serializers import ChatSessionSerializer
from apps.chat.views import ChatSessionViewSet
from apps.common.db import tenant_scope
from apps.tenants.models import Tenant

SESSIONS = 6
MESSAGES_PER_SESSION = 4
PASSWORD = "StrongPass!2026"


def _seed(slug="chat-n1"):
    tenant = Tenant.objects.create(name=f"Univ {slug}", slug=slug)
    student = User.objects.create_user(
        email=f"s@{slug}.edu", password=PASSWORD, role="student",
        tenant=tenant, is_active=True, is_email_verified=True,
    )
    for s in range(SESSIONS):
        session = ChatSession.objects.create(
            tenant=tenant, user=student, title=f"session {s}",
        )
        for m in range(MESSAGES_PER_SESSION):
            ChatMessage.objects.create(
                tenant=tenant, session=session, role="user", content=f"m{m}",
            )
    return tenant, student


def _list_queryset(user, tenant):
    """Build the real viewset the way DRF does, then take its queryset."""
    view = ChatSessionViewSet()
    view.request = SimpleNamespace(user=user, tenant=tenant)
    view.format_kwarg = None
    return view.get_queryset()


@pytest.mark.django_db
def test_annotated_list_reports_accurate_values():
    tenant, student = _seed()
    with tenant_scope(tenant.id):
        sessions = list(_list_queryset(student, tenant))
        payloads = ChatSessionSerializer(sessions, many=True).data

    assert len(payloads) == SESSIONS
    for payload in payloads:
        assert payload["message_count"] == MESSAGES_PER_SESSION
        assert payload["last_message_at"]


@pytest.mark.django_db
def test_list_query_count_is_constant_not_per_session():
    """Adding sessions must not add queries — the 1 + 2N fan-out is gone."""
    tenant, student = _seed()
    with tenant_scope(tenant.id):
        with CaptureQueriesContext(connection) as ctx:
            list(ChatSessionSerializer(_list_queryset(student, tenant), many=True).data)
        baseline_queries = len(ctx.captured_queries)

        # Grow the result set and re-measure the identical code path.
        for s in range(4):
            extra = ChatSession.objects.create(
                tenant=tenant, user=student, title=f"extra {s}",
            )
            for m in range(MESSAGES_PER_SESSION):
                ChatMessage.objects.create(
                    tenant=tenant, session=extra, role="user", content=f"m{m}",
                )
        with CaptureQueriesContext(connection) as more_ctx:
            list(ChatSessionSerializer(_list_queryset(student, tenant), many=True).data)
        grown_queries = len(more_ctx.captured_queries)

    assert grown_queries == baseline_queries, (
        f"query count scaled with rows: {baseline_queries} -> {grown_queries}"
    )


@pytest.mark.django_db
def test_unannotated_instance_falls_back_cleanly():
    """A just-created session carries no annotation but must still serialize."""
    tenant, student = _seed()
    with tenant_scope(tenant.id):
        session = ChatSession.objects.create(
            tenant=tenant, user=student, title="brand new",
        )
        ChatMessage.objects.create(
            tenant=tenant, session=session, role="user", content="hi",
        )
        payload = ChatSessionSerializer(session).data

    assert payload["message_count"] == 1
    assert payload["last_message_at"]
