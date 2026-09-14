"""
Contract tests for per-offering lecturer analytics (apps/academics/analytics):

- Assigned lecturers see cohort aggregates (KPIs, engagement, quiz performance,
  weakest questions, at-risk students)
- Forbidden for unassigned lecturers and students; admins view the whole tenant
- Cross-tenant offerings 404 even for staff
- Resource preview/download write structured ResourceAccess events for analytics
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
from apps.assessments.models import Quiz, QuizAttempt, QuizQuestion
from apps.resources.models import Resource, ResourceAccess
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


def _resource(tenant, uploader, offering, **overrides):
    data = {
        "title": "Lecture Notes",
        "visibility_scope": Resource.Visibility.INSTITUTION,
        "processing_status": Resource.ProcessingStatus.READY,
        "uploaded_by": uploader,
        "course_offering": offering,
        "mime_type": "application/pdf",
        "storage_key": f"tenants/{tenant.id}/resources/{uuid4()}",
    }
    data.update(overrides)
    return Resource.objects.create(tenant=tenant, **data)


def _quiz_and_questions(tenant, offering, created_by):
    quiz = Quiz.objects.create(
        tenant=tenant, course_offering=offering, created_by=created_by,
        title="Midterm", status=Quiz.Status.PUBLISHED,
        due_date=timezone.now() + datetime.timedelta(days=3),
    )
    q_a = QuizQuestion.objects.create(
        tenant=tenant, quiz=quiz, question_text="What is 2+2?",
        question_type=QuizQuestion.QuestionType.MULTIPLE_CHOICE,
        options=["3", "4"],
        correct_answer={"index": 1, "text": "4"},
        order_index=0,
    )
    q_b = QuizQuestion.objects.create(
        tenant=tenant, quiz=quiz, question_text="Capital of France?",
        question_type=QuizQuestion.QuestionType.MULTIPLE_CHOICE,
        options=["Paris", "Rome"],
        correct_answer={"index": 0, "text": "Paris"},
        order_index=1,
    )
    return quiz, q_a, q_b


def _attempt(tenant, quiz, student, answers, score, submitted=True):
    return QuizAttempt.objects.create(
        tenant=tenant, quiz=quiz, student=student,
        answers=answers, score=score,
        submitted_at=timezone.now() if submitted else None,
    )


def _seed_offering_with_activity(tenant, lecturer, student):
    """Tenant + offering + one enrolled student with quiz + resource usage."""
    _fac, _dep, _course, _session, _semester, offering = _campus(tenant)
    LecturerCourseAssignment.objects.create(
        tenant=tenant, lecturer=lecturer, course_offering=offering,
    )
    CourseEnrollment.objects.create(
        tenant=tenant, course_offering=offering, student=student,
    )
    resource = _resource(tenant, lecturer, offering, title="Slides 1")

    # 2x view + 1x download by the student -> views=2, downloads=1.
    ResourceAccess.objects.create(
        tenant=tenant, resource=resource, user=student,
        access_type=ResourceAccess.AccessType.VIEW,
        occurred_at=timezone.now() - datetime.timedelta(days=1),
    )
    ResourceAccess.objects.create(
        tenant=tenant, resource=resource, user=student,
        access_type=ResourceAccess.AccessType.VIEW,
        occurred_at=timezone.now() - datetime.timedelta(days=2),
    )
    ResourceAccess.objects.create(
        tenant=tenant, resource=resource, user=student,
        access_type=ResourceAccess.AccessType.DOWNLOAD,
        occurred_at=timezone.now() - datetime.timedelta(days=3),
    )

    quiz, q_a, q_b = _quiz_and_questions(tenant, offering, lecturer)
    # 3 attempts, avg 40 -> at_risk. q_a correct once (33%), q_b twice (67%).
    _attempt(tenant, quiz, student, {str(q_a.id): 0, str(q_b.id): 1}, 40.0)
    _attempt(tenant, quiz, student, {str(q_a.id): 0, str(q_b.id): 0}, 40.0)
    _attempt(tenant, quiz, student, {str(q_a.id): 1, str(q_b.id): 0}, 40.0)

    return offering, resource, quiz, q_a, q_b


def _payload(client, offering):
    return client.get(f"/api/v1/course-offerings/{offering.id}/analytics/")


# ---------------------------------------------------------------- Assigned


@pytest.mark.django_db
def test_assigned_lecturer_gets_cohort_analytics():
    tenant = _tenant("an-lect")
    lecturer = _user("lect@an-lect.edu", tenant, role="lecturer")
    student = _user("stu@an-lect.edu", tenant, role="student")
    offering, resource, quiz, q_a, q_b = _seed_offering_with_activity(
        tenant, lecturer, student
    )

    resp = _payload(_auth(lecturer), offering)
    assert resp.status_code == 200
    data = resp.json()

    assert data["offering"]["course_code"] == "CS101"
    assert data["offering"]["course_title"] == "Computing 101"

    kpi = data["kpis"]
    assert kpi["enrolled"] == 1
    assert kpi["active_students"] == 1
    assert kpi["materials"] == 1
    assert kpi["quizzes"] == 1
    assert kpi["quiz_submissions"] == 3
    assert kpi["avg_score_pct"] == 40
    assert kpi["completion_pct"] == 100
    assert kpi["at_risk_students"] == 1

    # Engagement: student-only, ordered by total accesses.
    items = data["engagement"]["items"]
    assert len(items) == 1
    assert items[0]["resource_id"] == str(resource.id)
    assert items[0]["views"] == 2
    assert items[0]["downloads"] == 1
    assert items[0]["unique_students"] == 1
    assert data["engagement"]["total_views"] == 2
    assert items[0]["last_accessed"] is not None

    # Quiz performance rollups.
    perf = next(p for p in data["quiz_performance"] if p["quiz_id"] == str(quiz.id))
    assert perf["attempts"] == 3
    assert perf["avg_score_pct"] == 40
    assert perf["completion_rate"] == 100

    # Weakest questions ranked by correct% (q_a 33% then q_b 67%).
    weakest = data["weakest_questions"]
    assert [w["question_id"] for w in weakest] == [str(q_a.id), str(q_b.id)]
    assert weakest[0]["correct_pct"] == 33
    assert weakest[0]["attempts"] == 3
    assert weakest[1]["correct_pct"] == 67

    # At-risk cohort.
    at_risk = data["at_risk"]
    assert len(at_risk) == 1
    row = at_risk[0]
    assert row["student_id"] == str(student.id)
    assert row["avg_score"] == 40
    assert row["attempts"] == 3
    assert row["resources_opened"] == 1
    assert row["status"] == "at_risk"
    assert row["last_activity_days"] is not None


@pytest.mark.django_db
def test_lecturer_access_does_not_count_as_student_engagement():
    tenant = _tenant("an-staff")
    lecturer = _user("lect@an-staff.edu", tenant, role="lecturer")
    student = _user("stu@an-staff.edu", tenant, role="student")
    offering, resource, quiz, q_a, q_b = _seed_offering_with_activity(
        tenant, lecturer, student
    )

    # A lecturer previews/downloads the same material 5 times.
    for _ in range(5):
        ResourceAccess.objects.create(
            tenant=tenant, resource=resource, user=lecturer,
            access_type=ResourceAccess.AccessType.VIEW,
        )

    data = _payload(_auth(lecturer), offering).json()
    items = data["engagement"]["items"]
    assert len(items) == 1
    assert items[0]["views"] == 2  # student views only, lecturer's excluded
    assert data["kpis"]["active_students"] == 1


# ---------------------------------------------------------------- Guards


@pytest.mark.django_db
def test_unassigned_lecturer_forbidden():
    tenant = _tenant("an-guard")
    lecturer = _user("lect@an-guard.edu", tenant, role="lecturer")
    other = _user("other@an-guard.edu", tenant, role="lecturer")
    student = _user("stu@an-guard.edu", tenant, role="student")
    offering, *_ = _seed_offering_with_activity(tenant, lecturer, student)

    assert _payload(_auth(other), offering).status_code == 403


@pytest.mark.django_db
def test_student_forbidden():
    tenant = _tenant("an-stu")
    lecturer = _user("lect@an-stu.edu", tenant, role="lecturer")
    student = _user("stu@an-stu.edu", tenant, role="student")
    offering, *_ = _seed_offering_with_activity(tenant, lecturer, student)

    assert _payload(_auth(student), offering).status_code == 403


@pytest.mark.django_db
def test_admin_sees_any_offering_in_tenant():
    tenant = _tenant("an-admin")
    admin = _user("admin@an-admin.edu", tenant, role="tenant_admin")
    lecturer = _user("lect@an-admin.edu", tenant, role="lecturer")
    student = _user("stu@an-admin.edu", tenant, role="student")
    offering, resource, quiz, q_a, q_b = _seed_offering_with_activity(
        tenant, lecturer, student
    )

    resp = _payload(_auth(admin), offering)
    assert resp.status_code == 200
    assert resp.json()["kpis"]["enrolled"] == 1


@pytest.mark.django_db
def test_cross_tenant_offering_not_found_for_staff():
    tenant_a = _tenant("an-iso-a")
    tenant_b = _tenant("an-iso-b")
    lecturer = _user("lect@an-iso-a.edu", tenant_a, role="lecturer")
    student = _user("stu@an-iso-a.edu", tenant_a, role="student")
    offering, *_ = _seed_offering_with_activity(tenant_a, lecturer, student)

    foreign_admin = _user("admin@an-iso-b.edu", tenant_b, role="tenant_admin")

    assert _payload(_auth(foreign_admin), offering).status_code == 404


# -------------------------------------------------------- Access logging


@pytest.mark.django_db
def test_preview_and_download_log_resource_access():
    tenant = _tenant("an-log")
    lecturer = _user("lect@an-log.edu", tenant, role="lecturer")
    student = _user("stu@an-log.edu", tenant, role="student")
    _fac, _dep, _course, _session, _semester, offering = _campus(tenant)
    resource = _resource(tenant, lecturer, offering)

    client = _auth(student)
    assert client.get(f"/api/v1/resources/{resource.id}/preview/").status_code == 200
    assert client.get(f"/api/v1/resources/{resource.id}/download_url/").status_code == 200
    assert client.get(f"/api/v1/resources/{resource.id}/download_url/").status_code == 200

    accesses = list(
        ResourceAccess.objects.filter(
            tenant=tenant, resource=resource, user=student
        ).order_by("access_type")
    )
    assert len(accesses) == 3
    kinds = sorted(a.access_type for a in accesses)
    assert kinds == ["download", "download", "view"]
    assert all(a.tenant_id == tenant.id for a in accesses)


@pytest.mark.django_db
def test_access_events_feed_analytics():
    tenant = _tenant("an-feed")
    lecturer = _user("lect@an-feed.edu", tenant, role="lecturer")
    student = _user("stu@an-feed.edu", tenant, role="student")
    _fac, _dep, _course, _session, _semester, offering = _campus(tenant)
    LecturerCourseAssignment.objects.create(
        tenant=tenant, lecturer=lecturer, course_offering=offering,
    )
    CourseEnrollment.objects.create(
        tenant=tenant, course_offering=offering, student=student,
    )
    resource = _resource(tenant, lecturer, offering)

    client = _auth(student)
    client.get(f"/api/v1/resources/{resource.id}/preview/")
    client.get(f"/api/v1/resources/{resource.id}/download_url/")

    data = _payload(_auth(lecturer), offering).json()
    assert data["kpis"]["active_students"] == 1
    assert data["engagement"]["items"][0]["views"] == 1
    assert data["engagement"]["items"][0]["downloads"] == 1
    assert data["kpis"]["at_risk_students"] == 1  # inactive student flagged