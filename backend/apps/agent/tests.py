import types
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.academics.models import (
    AcademicSession, Course, CourseEnrollment, CourseOffering, Department, Faculty, Semester,
)
from apps.agent.agent_loop import run_agent_turn
from apps.agent.manifest import identities_for_user, resolve_agent_key
from apps.agent.models import AgentSession, AgentToolExecution
from apps.agent.tools import get_deadlines
from apps.assessments.models import Quiz
from apps.learning.models import Plan
from apps.tenants.models import Tenant


class FakeFunctionCall:
    def __init__(self, name, args=None):
        self.name = name
        self.args = args or {}


class FakePart:
    def __init__(self, *, text=None, function_call=None):
        self.text = text
        self.function_call = function_call


class FakeResponse:
    def __init__(self, results):
        self.candidates = [types.SimpleNamespace(content=types.SimpleNamespace(parts=results))]


class FakeModels:
    def __init__(self):
        self.calls = 0

    def generate_content(self, **kwargs):
        self.calls += 1
        if self.calls == 1:
            return FakeResponse([
                FakePart(function_call=FakeFunctionCall("get_user_profile", {})),
            ])
        return FakeResponse([
            FakePart(text="I can help with that."),
        ])


class FakeClient:
    def __init__(self):
        self.models = FakeModels()


@pytest.mark.django_db
def test_agent_turn_persists_recent_history_and_logs_tool_calls():
    tenant = Tenant.objects.create(name="Agent Uni", slug="agent-uni")
    user = User.objects.create_user(
        email="agent@agent-uni.edu",
        password="StrongPass!2026x",
        tenant=tenant,
        role="student",
        first_name="Agent",
        last_name="User",
        is_email_verified=True,
    )
    session = AgentSession.objects.create(
        tenant=tenant,
        user=user,
        context_type="dashboard",
        recent_messages=[
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
        ],
    )

    events = list(
        run_agent_turn(
            FakeClient(),
            "gemini-2.0-flash",
            user,
            "What are my courses?",
            "dashboard",
            history=session.recent_messages,
            session=session,
        )
    )

    assert any(event[0] == "token" and "I can help with that." in event[1].get("text", "") for event in events)
    session.refresh_from_db()
    assert session.recent_messages[-2]["role"] == "user"
    assert session.recent_messages[-2]["content"] == "What are my courses?"
    assert session.recent_messages[-1]["role"] == "assistant"
    assert AgentToolExecution.objects.filter(session=session, tool_name="get_user_profile").exists()


@pytest.mark.django_db
def test_agent_session_reuses_history_for_follow_up_turns():
    tenant = Tenant.objects.create(name="Follow Uni", slug="follow-uni")
    user = User.objects.create_user(
        email="follow@follow-uni.edu",
        password="StrongPass!2026x",
        tenant=tenant,
        role="student",
        first_name="Follow",
        last_name="User",
        is_email_verified=True,
    )
    session = AgentSession.objects.create(
        tenant=tenant,
        user=user,
        context_type="dashboard",
        recent_messages=[
            {"role": "user", "content": "What are my courses?"},
            {"role": "assistant", "content": "Here are your courses."},
        ],
    )

    events = list(
        run_agent_turn(
            FakeClient(),
            "gemini-2.0-flash",
            user,
            "How many are there?",
            "dashboard",
            history=session.recent_messages,
            session=session,
        )
    )

    assert any(event[0] == "done" for event in events)
    session.refresh_from_db()
    assert session.message_count == 0
    assert len(session.recent_messages) >= 4
    assert session.recent_messages[-4]["content"] == "What are my courses?"


@pytest.mark.django_db
def test_get_deadlines_returns_enrolled_published_quizzes_and_plans():
    tenant = Tenant.objects.create(name="Deadline Uni", slug="deadline-uni")
    user = User.objects.create_user(
        email="deadline@deadline-uni.edu",
        password="StrongPass!2026x",
        tenant=tenant,
        role="student",
        is_email_verified=True,
    )
    faculty = Faculty.objects.create(tenant=tenant, name="Science", code="SCI")
    department = Department.objects.create(
        tenant=tenant, faculty=faculty, name="Computing", code="COMP",
    )
    course = Course.objects.create(
        tenant=tenant, department=department, code="CS101", title="Computing",
    )
    session = AcademicSession.objects.create(
        tenant=tenant, name="2026/2027", start_date="2026-09-01", end_date="2027-07-31",
    )
    semester = Semester.objects.create(
        tenant=tenant, academic_session=session, name="First",
        start_date="2026-09-01", end_date="2027-01-31",
    )
    offering = CourseOffering.objects.create(
        tenant=tenant, course=course, academic_session=session, semester=semester,
    )
    CourseEnrollment.objects.create(tenant=tenant, course_offering=offering, student=user)
    Quiz.objects.create(
        tenant=tenant, course_offering=offering, created_by=user,
        title="Midterm", status=Quiz.Status.PUBLISHED,
        due_date=timezone.now() + timedelta(days=3),
    )
    Plan.objects.create(
        tenant=tenant, user=user, title="Revision", status="active",
        target_date=(timezone.now() + timedelta(days=1)).date(),
    )

    result = get_deadlines(user)

    assert result["count"] == 2
    assert {deadline["type"] for deadline in result["deadlines"]} == {"plan", "quiz"}
    quiz_deadline = next(
        deadline for deadline in result["deadlines"] if deadline["type"] == "quiz"
    )
    assert quiz_deadline["title"] == "Midterm"
    assert quiz_deadline["course_code"] == "CS101"


def _make_user(tenant, email, role="student"):
    return User.objects.create_user(
        email=email,
        password="StrongPass!2026x",
        tenant=tenant,
        role=role,
        first_name="Agent",
        last_name="User",
        is_email_verified=True,
    )


def _auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_manifest_delivers_role_gated_identities_and_defaults():
    tenant = Tenant.objects.create(name="Identities Uni", slug="identities-uni")

    student = _make_user(tenant, "ident@identities-uni.edu", role="student")
    student_result = identities_for_user(student)
    student_keys = {a["key"] for a in student_result["agents"]}
    assert student_result["default_key"] == "tutor"
    assert {"tutor", "mentor", "planner", "librarian"} <= student_keys
    assert "exec" not in student_keys
    assert "analyst" not in student_keys

    admin = _make_user(tenant, "admin@identities-uni.edu", role="tenant_admin")
    admin_result = identities_for_user(admin)
    admin_keys = {a["key"] for a in admin_result["agents"]}
    assert admin_result["default_key"] == "exec"
    assert {"exec", "analyst", "planner", "librarian"} <= admin_keys
    assert "tutor" not in admin_keys

    # Presence is stable per user+agent (ssrg), never empty.
    for agent in student_result["agents"]:
        assert agent["presence"]
        assert agent["avatar"].startswith("/avatars/")

    # resolve_agent_key rejects out-of-role keys and falls back to the default.
    assert resolve_agent_key("", "student") == "tutor"
    assert resolve_agent_key("exec", "student") == "tutor"
    assert resolve_agent_key("mentor", "student") == "mentor"
    assert resolve_agent_key("", "tenant_admin") == "exec"


@pytest.mark.django_db
def test_agent_identities_settings_and_sessions_api():
    tenant = Tenant.objects.create(name="Settings Uni", slug="settings-uni")
    user = _make_user(tenant, "settings@settings-uni.edu", role="student")
    client = _auth_client(user)

    resp = client.get("/api/v1/agent/identities/")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["default_key"] == "tutor"
    assert payload["settings"] is not None
    assert payload["settings"]["tone"] == "balanced"

    resp = client.put(
        "/api/v1/agent/settings/",
        {
            "default_agent": "mentor",
            "tone": "coach",
            "filters": {"ableism": True, "reading_order": True},
            "reminders_enabled": False,
        },
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["tone"] == "coach"
    assert resp.json()["default_agent"] == "mentor"

    resp = client.post(
        "/api/v1/agent/sessions/",
        {"title": "Revision help", "agent_key": "mentor", "context_type": "plans"},
        format="json",
    )
    assert resp.status_code == 201
    session_id = resp.json()["id"]
    assert resp.json()["agent_key"] == "mentor"

    resp = client.get("/api/v1/agent/sessions/")
    assert resp.status_code == 200
    assert resp.json()["count"] == 1

    resp = client.get(f"/api/v1/agent/sessions/{session_id}/")
    assert resp.status_code == 200
    assert "recent_messages" in resp.json()

    resp = client.patch(
        f"/api/v1/agent/sessions/{session_id}/", {"title": "Renamed"}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Renamed"

    resp = client.delete(f"/api/v1/agent/sessions/{session_id}/")
    assert resp.status_code == 204
    assert not AgentSession.objects.filter(id=session_id).exists()

    # A different tenant's user cannot see or resume these sessions.
    other_tenant = Tenant.objects.create(name="Other Uni", slug="other-uni")
    other_user = _make_user(other_tenant, "other@other-uni.edu", role="student")
    other_client = _auth_client(other_user)
    resp = other_client.get("/api/v1/agent/sessions/")
    assert resp.status_code == 200
    assert resp.json()["count"] == 0


@pytest.mark.django_db
def test_agent_stream_creates_resumable_session_in_dev_mode():
    tenant = Tenant.objects.create(name="Stream Uni", slug="stream-uni")
    user = _make_user(tenant, "stream@stream-uni.edu", role="student")
    client = _auth_client(user)

    resp = client.post(
        "/api/v1/agent/stream/",
        {"message": "Help me plan", "context_type": "plans", "agent": "planner"},
        format="json",
    )
    assert resp.status_code == 200
    body = b"".join(resp.streaming_content).decode()

    session = AgentSession.objects.get(user=user)
    assert session.agent_key == "planner"
    assert session.context_type == "plans"
    assert f'"session_id": "{session.id}"' in body

    # Resuming with an invalid/borrowed session id returns 404.
    from uuid import uuid4
    resp = client.post(
        "/api/v1/agent/stream/",
        {"message": "resume", "session_id": str(uuid4())},
        format="json",
    )
    assert resp.status_code == 404
