"""
Contract tests for the role dashboards (apps/common/dashboard.py):

- Student / Admin / Lecturer dashboard aggregates
- Student activity timeline + totals
- Admin audit summary
- AI greeting / insight fallbacks (Gemini stubbed out)
- Permission gates: student forbidden on admin endpoints, superuser
  admitted, cross-tenant isolation
"""
import datetime
from uuid import uuid4

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.academics.models import (
    AcademicSession,
    Course,
    CourseEnrollment,
    CourseOffering,
    Department,
    Faculty,
    LecturerCourseAssignment,
    Semester,
)
from apps.assessments.models import Quiz, QuizAttempt
from apps.audit.models import AuditLog
from apps.chat.models import ChatMessage, ChatSession
from apps.learning.models import Note
from apps.resources.models import Resource
from apps.tenants.models import Tenant


PASSWORD = "StrongPass!2026"


def _tenant(slug):
    return Tenant.objects.create(name=f"Uni {slug}", slug=f"{slug}-{uuid4().hex[:8]}")


def _user(email, tenant, role="student"):
    return User.objects.create_user(
        email=email,
        password=PASSWORD,
        tenant=tenant,
        role=role,
        first_name="Test",
        last_name="User",
        is_active=True,
        is_email_verified=True,
    )


def _auth(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _campus(tenant):
    faculty = Faculty.objects.create(tenant=tenant, name="Science", code="SCI")
    department = Department.objects.create(
        tenant=tenant, faculty=faculty, name="Computing", code="COMP",
    )
    course = Course.objects.create(
        tenant=tenant, department=department, code="CS101", title="Computing 101",
    )
    session = AcademicSession.objects.create(
        tenant=tenant, name="2026/2027",
        start_date="2026-09-01", end_date="2027-07-31",
    )
    semester = Semester.objects.create(
        tenant=tenant, academic_session=session, name="First",
        start_date="2026-09-01", end_date="2027-01-31",
    )
    offering = CourseOffering.objects.create(
        tenant=tenant, course=course, academic_session=session, semester=semester,
    )
    return faculty, department, course, session, semester, offering


def _resource(tenant, uploader, **overrides):
    data = {
        "title": "Lecture Notes",
        "visibility_scope": Resource.Visibility.INSTITUTION,
        "processing_status": Resource.ProcessingStatus.READY,
        "uploaded_by": uploader,
        "mime_type": "application/pdf",
    }
    data.update(overrides)
    return Resource.objects.create(tenant=tenant, **data)


# ---------------------------------------------------------------- Student


@pytest.mark.django_db
def test_student_dashboard_aggregates_and_cross_tenant_isolation():
    tenant_a = _tenant("dash-stu-a")
    tenant_b = _tenant("dash-stu-b")
    student_a = _user("stu-a@dash-stu-a.edu", tenant_a, role="student")
    student_b = _user("stu-b@dash-stu-b.edu", tenant_b, role="student")
    _fac, _dep, course, session, semester, offering = _campus(tenant_a)

    CourseEnrollment.objects.create(
        tenant=tenant_a, course_offering=offering, student=student_a,
    )
    _resource(tenant_a, student_a, title="Chem Slides", visibility_scope=Resource.Visibility.INSTITUTION)
    quiz = Quiz.objects.create(
        tenant=tenant_a, course_offering=offering, created_by=student_a,
        title="Midterm", status=Quiz.Status.PUBLISHED,
        due_date=timezone.now() + datetime.timedelta(days=3),
    )
    QuizAttempt.objects.create(
        tenant=tenant_a, quiz=quiz, student=student_a,
        score=80.0, submitted_at=timezone.now(),
    )
    ChatSession.objects.create(tenant=tenant_a, user=student_a, title="Help")
    Note.objects.create(tenant=tenant_a, user=student_a, title="Key idea", content="todo")


    resp = _auth(student_a).get("/api/v1/dashboard/student/")
    assert resp.status_code == 200
    payload = resp.json()

    assert payload["counts"] == {
        "enrollments": 1,
        "resources": 1,
        "notes": 1,
        "bookmarks": 0,
        "quiz_attempts": 1,
        "chats": 1,
    }
    assert [c["code"] for c in payload["enrolled_courses"]] == ["CS101"]
    assert payload["continue_courses"][0]["title"] == "Computing 101"
    assert payload["continue_courses"][0]["code"] == "CS101"
    assert payload["up_next"][0]["kind"] == "quiz"
    assert payload["up_next"][0]["status"] == "available"
    assert [r["title"] for r in payload["recent_resources"]] == ["Chem Slides"]
    assert [c["title"] for c in payload["recent_chats"]] == ["Help"]
    assert payload["concept_mastery"][0]["pct"] == 80

    # A student in another tenant sees none of tenant A's data.
    resp_b = _auth(student_b).get("/api/v1/dashboard/student/")
    assert resp_b.status_code == 200
    payload_b = resp_b.json()
    assert payload_b["counts"]["resources"] == 0
    assert payload_b["up_next"] == []
    assert payload_b["continue_courses"] == []


# ---------------------------------------------------------------- Admin


@pytest.mark.django_db
def test_admin_dashboard_aggregates():
    tenant = _tenant("dash-admin")
    admin = _user("admin@dash-admin.edu", tenant, role="tenant_admin")
    lecturer = _user("lect@dash-admin.edu", tenant, role="lecturer")
    student1 = _user("stu1@dash-admin.edu", tenant, role="student")
    student2 = _user("stu2@dash-admin.edu", tenant, role="student")
    _fac, _dep, _course, _session, _semester, offering = _campus(tenant)

    CourseEnrollment.objects.create(
        tenant=tenant, course_offering=offering, student=student1,
    )
    # Ready institution material (visible) + pending institution +
    # a private failed material uploaded by a *different* user.
    ready = _resource(tenant, student1, title="Ready handout")
    _resource(tenant, lecturer, title="Pending handout",
              processing_status=Resource.ProcessingStatus.PENDING)
    _resource(tenant, student2, title="Private draft",
              visibility_scope=Resource.Visibility.PRIVATE,
              processing_status=Resource.ProcessingStatus.FAILED)

    quiz = Quiz.objects.create(
        tenant=tenant, course_offering=offering, created_by=lecturer,
        title="Lab Quiz", status=Quiz.Status.PUBLISHED,
        due_date=timezone.now() + datetime.timedelta(days=5),
    )
    QuizAttempt.objects.create(
        tenant=tenant, quiz=quiz, student=student1,
        score=70.0, submitted_at=timezone.now(),
    )
    session = ChatSession.objects.create(tenant=tenant, user=student1, title="General")
    ChatMessage.objects.create(
        tenant=tenant, session=session,
        role=ChatMessage.Role.USER, content="What is RLS?",
    )

    resp = _auth(admin).get("/api/v1/dashboard/admin/")
    assert resp.status_code == 200
    payload = resp.json()

    assert payload["totals"]["users"] == 4
    assert payload["totals"]["resources"] == 3
    assert payload["totals"]["storage_used_bytes"] == 0
    assert payload["totals"]["enrollments"] == 1
    assert payload["totals"]["quizzes"] == 1
    assert payload["totals"]["quiz_attempts"] == 1
    assert payload["totals"]["chat_sessions"] == 1
    assert payload["totals"]["chat_messages"] == 1

    role_map = {row["name"]: row["value"] for row in payload["users_by_role"]}
    assert role_map == {"Students": 2, "Lecturers": 1, "Admins": 1}

    status_map = {row["name"]: row["value"] for row in payload["materials_by_status"]}
    assert status_map == {"Ready": 1, "Processing": 0, "Pending": 1, "Failed": 1}

    structure = {row["name"]: row["value"] for row in payload["structure"]}
    assert structure["Faculties"] == 1
    assert structure["Courses"] == 1
    assert structure["Offerings"] == 1

    # Private material uploaded by another user must NOT leak into recent.
    # (No ordering guarantee: all seeds share the same created_at second.)
    recent_titles = {r["title"] for r in payload["recent_resources"]}
    assert recent_titles == {"Ready handout", "Pending handout"}
    assert payload["recent_resources"][0]["uploaded_by"] == "Test User"


# ---------------------------------------------------------------- Lecturer


@pytest.mark.django_db
def test_lecturer_dashboard_scope_and_risk_signals():
    tenant = _tenant("dash-lect")
    other_tenant = _tenant("dash-lect-other")
    lecturer = _user("lect@dash-lect.edu", tenant, role="lecturer")
    other_lecturer = _user("other@dash-lect-other.edu", other_tenant, role="lecturer")
    student = _user("stu@dash-lect.edu", tenant, role="student")
    _fac, _dep, _course, _session, _semester, offering = _campus(tenant)

    LecturerCourseAssignment.objects.create(
        tenant=tenant, lecturer=lecturer, course_offering=offering,
    )
    CourseEnrollment.objects.create(
        tenant=tenant, course_offering=offering, student=student,
    )
    _resource(
        tenant, lecturer,
        title="Slides",
        visibility_scope=Resource.Visibility.COURSE,
        course_offering=offering,
        processing_status=Resource.ProcessingStatus.READY,
    )
    quiz = Quiz.objects.create(
        tenant=tenant, course_offering=offering, created_by=lecturer,
        title="Pop Quiz", status=Quiz.Status.PUBLISHED,
        due_date=timezone.now() + datetime.timedelta(days=2),
    )
    QuizAttempt.objects.create(
        tenant=tenant, quiz=quiz, student=student,
        score=30.0, submitted_at=timezone.now(),
    )

    resp = _auth(lecturer).get("/api/v1/dashboard/lecturer/")
    assert resp.status_code == 200
    payload = resp.json()

    assert payload["workspace"] == "LECTURER WORKSPACE · CS101 · First"
    assert payload["kpis"]["active_courses"] == 1
    assert payload["kpis"]["students_enrolled"] == 1
    assert payload["kpis"]["quiz_submissions"] == 1
    assert payload["kpis"]["quiz_completion_pct"] == 100
    assert payload["kpis"]["ai_answers_today"] == 0
    assert payload["kpis"]["concepts_flagged"] == 1

    assert len(payload["students_needing_attention"]) == 1
    at_risk = payload["students_needing_attention"][0]
    assert at_risk["status"] == "at_risk"
    assert at_risk["avg_score"] == 30
    assert at_risk["name"] == "Test User"

    assert payload["weak_concepts"][0]["label"] == "Pop Quiz"
    assert payload["weak_concepts"][0]["mastery_pct"] == 30

    assert payload["pipeline"] == {"ready": 1, "indexing": 0, "failed": 0}

    # A lecturer from another tenant sees an empty workspace with no leakage.
    # (Their own tenant has no assignments, so every KPI reads zero.)
    other_tenant_payload = _auth(other_lecturer).get("/api/v1/dashboard/lecturer/").json()
    assert other_tenant_payload["kpis"]["active_courses"] == 0
    assert other_tenant_payload["kpis"]["students_enrolled"] == 0
    assert other_tenant_payload["students_needing_attention"] == []
    assert other_tenant_payload["pipeline"] == {"ready": 0, "indexing": 0, "failed": 0}


# ---------------------------------------------------------------- Permissions


@pytest.mark.django_db
def test_dashboard_permission_gates_and_superuser():
    tenant = _tenant("dash-perm")
    student = _user("stu@dash-perm.edu", tenant, role="student")
    lecturer = _user("lect@dash-perm.edu", tenant, role="lecturer")
    admin = _user("admin@dash-perm.edu", tenant, role="tenant_admin")
    superuser = _user("super@dash-perm.edu", tenant, role="student")
    superuser.is_superuser = True
    superuser.save()

    for endpoint in ("admin/", "lecturer/", "admin/audit-summary/"):
        path = f"/api/v1/dashboard/{endpoint}"
        assert _auth(student).get(path).status_code == 403, path
        assert _auth(lecturer).get(path).status_code == 200, path
        assert _auth(admin).get(path).status_code == 200, path
        # Platform superuser must be admitted regardless of role field.
        assert _auth(superuser).get(path).status_code == 200, path

    # Student endpoints still allow students but deny anonymous.
    assert _auth(student).get("/api/v1/dashboard/student/").status_code == 200
    assert APIClient().get("/api/v1/dashboard/student/").status_code == 401


# ---------------------------------------------------------------- Activity


@pytest.mark.django_db
def test_student_activity_timeline_and_totals():
    tenant = _tenant("dash-act")
    student = _user("stu@dash-act.edu", tenant, role="student")
    _fac, _dep, _course, _session, _semester, offering = _campus(tenant)

    session = ChatSession.objects.create(tenant=tenant, user=student, title="Help")
    for i, text in enumerate(["One", "Two"]):
        ChatMessage.objects.create(
            tenant=tenant, session=session,
            role=ChatMessage.Role.USER, content=text,
        )
    quiz = Quiz.objects.create(
        tenant=tenant, course_offering=offering, created_by=student,
        title="Quiz", status=Quiz.Status.PUBLISHED,
        due_date=timezone.now() + datetime.timedelta(days=3),
    )
    QuizAttempt.objects.create(
        tenant=tenant, quiz=quiz, student=student,
        score=50.0, submitted_at=timezone.now(),
    )
    fresh_note = Note.objects.create(
        tenant=tenant, user=student, title="Today", content="x",
    )
    stale_note = Note.objects.create(
        tenant=tenant, user=student, title="Old", content="y",
    )
    # 30 days old -> outside the 14-day default window.
    Note.objects.filter(id=stale_note.id).update(
        created_at=timezone.now() - datetime.timedelta(days=30),
    )

    resp = _auth(student).get("/api/v1/dashboard/student/activity/")
    assert resp.status_code == 200
    payload = resp.json()

    assert payload["range"] == "day"
    assert payload["window_days"] == 14
    today_json = timezone.now().date().isoformat()
    today_bucket = next((b for b in payload["timeline"] if b["bucket"] == today_json), None)
    assert today_bucket is not None, payload["timeline"]
    assert today_bucket["chats"] == 2
    assert today_bucket["quizzes"] == 1
    assert today_bucket["notes"] == 1
    assert payload["totals"] == {"chats": 2, "quizzes": 1, "notes": 1}

    # Out-of-range values fall back to day; ?range=week returns a wider
    # window (both notes inside it).
    resp_week = _auth(student).get("/api/v1/dashboard/student/activity/?range=week")
    assert resp_week.status_code == 200
    assert resp_week.json()["range"] == "week"
    assert resp_week.json()["totals"]["notes"] == 2

    resp_bad = _auth(student).get("/api/v1/dashboard/student/activity/?range=bogus")
    assert resp_bad.status_code == 200
    assert resp_bad.json()["range"] == "day"

    # Activity is strictly scoped to the caller's tenant.
    other = _user("other@dash-act.edu", _tenant("dash-act-b"), role="student")
    resp_other = _auth(other).get("/api/v1/dashboard/student/activity/")
    assert resp_other.json()["totals"] == {"chats": 0, "quizzes": 0, "notes": 0}


# ---------------------------------------------------------------- Audit


@pytest.mark.django_db
def test_admin_audit_summary_aggregates():
    tenant = _tenant("dash-audit")
    admin = _user("admin@dash-audit.edu", tenant, role="tenant_admin")
    student = _user("stu@dash-audit.edu", tenant, role="student")

    for action in ("resource.upload", "resource.upload", "quiz.create"):
        AuditLog.objects.create(
            tenant=tenant, actor=admin, action=action,
            entity_type="resource",
        )

    resp = _auth(admin).get("/api/v1/dashboard/admin/audit-summary/")
    assert resp.status_code == 200
    payload = resp.json()

    assert payload["window_days"] == 14
    assert payload["total_events"] == 3
    assert sum(b["count"] for b in payload["timeline"]) == 3
    action_map = {row["name"]: row["count"] for row in payload["by_action"]}
    assert action_map["resource.upload"] == 2
    assert action_map["quiz.create"] == 1
    assert len(payload["recent"]) == 3
    assert payload["recent"][0]["actor"] == "Test User"
    assert payload["top_actors"][0]["count"] == 3

    # Actor's other user activity never bleeds across tenants.
    other_admin = _user("other@dash-audit-b.edu", _tenant("dash-audit-b"), role="tenant_admin")
    resp_other = _auth(other_admin).get("/api/v1/dashboard/admin/audit-summary/")
    assert resp_other.json()["total_events"] == 0

    # Students are denied.
    assert _auth(student).get("/api/v1/dashboard/admin/audit-summary/").status_code == 403


# ---------------------------------------------------------------- AI endpoints


@pytest.mark.django_db
def test_ai_greeting_and_insight_fallbacks(monkeypatch):
    # Stub Gemini out so the canned fallbacks are exercised deterministically.
    monkeypatch.setattr("apps.common.ai.gemini._get_client", lambda: None)

    tenant = _tenant("dash-ai")
    student = _user("stu@dash-ai.edu", tenant, role="student")

    greeting_resp = _auth(student).get("/api/v1/dashboard/ai-greeting/")
    assert greeting_resp.status_code == 200
    greeting = greeting_resp.json()
    assert "greeting" in greeting and greeting["greeting"]
    assert greeting["suggested_action"]

    insight_resp = _auth(student).post(
        "/api/v1/dashboard/ai-insight/", {"dashboard_type": "student"}, format="json",
    )
    assert insight_resp.status_code == 200
    insight = insight_resp.json()
    assert insight["headline"]
    assert insight["body"]
    assert len(insight["suggested_actions"]) >= 1
    assert 0.5 <= insight["confidence"] <= 1.0

    # Unknown dashboard types are coerced to "student" rather than rejected.
    coerced = _auth(student).post(
        "/api/v1/dashboard/ai-insight/", {"dashboard_type": "exec"}, format="json",
    )
    assert coerced.status_code == 200
    assert coerced.json()["headline"]

    # Both endpoints stay authenticated.
    assert APIClient().get("/api/v1/dashboard/ai-greeting/").status_code == 401