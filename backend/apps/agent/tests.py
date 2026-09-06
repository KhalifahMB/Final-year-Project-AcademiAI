import types
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.academics.models import (
    AcademicSession, Course, CourseEnrollment, CourseOffering, Department, Faculty, Semester,
)
from apps.agent.agent_loop import run_agent_turn
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
