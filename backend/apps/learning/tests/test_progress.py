"""Per-concept mastery is recomputed from reading + quiz evidence (TC-progress).

ProgressRecord is a derived table: no endpoint writes it. Reading position
updates and scored quiz submissions fire signals that recompute mastery for
every concept the material maps to, and the Progress page reads the result.
"""
import datetime

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.knowledge.models import Concept, ResourceConcept
from apps.resources.models import Resource
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026"


def _tenant(slug="pg-t"):
    return Tenant.objects.create(name="Univ pg", slug=slug)


def _student(tenant, email="pg@u.com"):
    return User.objects.create_user(
        email=email, password=PASSWORD, tenant=tenant,
        role=User.Role.STUDENT, is_active=True, is_email_verified=True,
    )


def _resource(tenant, user, title="Paper A"):
    return Resource.objects.create(
        tenant=tenant, uploaded_by=user, title=title,
        visibility_scope=Resource.Visibility.INSTITUTION,
        processing_status=Resource.ProcessingStatus.READY,
    )


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.mark.django_db
def test_reading_position_recomputes_concept_mastery():
    from apps.learning.models import ProgressRecord

    tenant = _tenant("pg-t")
    user = _student(tenant)
    concept = Concept.objects.create(tenant=tenant, canonical_name="Kinematics")
    res = _resource(tenant, user)
    ResourceConcept.objects.create(resource=res, concept=concept)
    client = _client(user)

    # Read 80% of the way through the material.
    resp = client.post(
        "/api/v1/reading-positions/",
        {"resource": str(res.id), "scroll_percentage": 80},
        format="json",
    )
    assert resp.status_code == 201, resp.data

    record = ProgressRecord.objects.get(user=user, concept=concept)
    # Only reading evidence -> mastery = 0.4 * 0.8 = 32%.
    assert record.progress_value == 32.0
    assert record.tenant_id == tenant.id

    # Progress page exposes the concept name, not a bare UUID.
    progress = client.get("/api/v1/progress/").json()
    assert len(progress["results"]) == 1
    row = progress["results"][0]
    assert row["concept_name"] == "Kinematics"
    assert row["progress_value"] == 32.0


@pytest.mark.django_db
def test_reading_avg_over_concept_resources():
    from apps.learning.models import ProgressRecord

    tenant = _tenant("pg-avg")
    user = _student(tenant, "pg2@u.com")
    concept = Concept.objects.create(tenant=tenant, canonical_name="Optics")
    r1 = _resource(tenant, user, "Paper 1")
    r2 = _resource(tenant, user, "Paper 2")
    ResourceConcept.objects.create(resource=r1, concept=concept)
    ResourceConcept.objects.create(resource=r2, concept=concept)
    client = _client(user)

    # Both resources of the concept are part of its reading evidence.
    client.post(
        "/api/v1/reading-positions/", {"resource": str(r1.id), "scroll_percentage": 60}, format="json",
    )
    client.post(
        "/api/v1/reading-positions/", {"resource": str(r2.id), "scroll_percentage": 100}, format="json",
    )

    record = ProgressRecord.objects.get(user=user, concept=concept)
    # Average reading depth (60 + 100)/2 = 80 -> mastery = 0.4 * 0.8 = 32%.
    assert record.progress_value == 32.0


@pytest.mark.django_db
def test_quiz_submission_recomputes_concept_mastery():
    from apps.academics.models import (
        AcademicSession, Course, CourseEnrollment, CourseOffering,
        Department, Faculty, Semester,
    )
    from apps.assessments.models import Quiz, QuizQuestion
    from apps.learning.models import ProgressRecord

    tenant = _tenant("pg-quiz")
    lecturer = _student(tenant, "staff@u.com")
    student = _student(tenant, "s@u.com")
    concept = Concept.objects.create(tenant=tenant, canonical_name="Thermodynamics")
    res = _resource(tenant, lecturer, "Thermo notes")
    ResourceConcept.objects.create(resource=res, concept=concept)

    faculty = Faculty.objects.create(tenant=tenant, name="Science", code="SCI")
    dept = Department.objects.create(tenant=tenant, faculty=faculty, name="Physics", code="PHY")
    course = Course.objects.create(tenant=tenant, department=dept, code="PHY101", title="Physics I")
    session = AcademicSession.objects.create(
        tenant=tenant, name="2025/2026",
        start_date=datetime.date(2025, 9, 1), end_date=datetime.date(2026, 6, 30),
        is_current=True,
    )
    sem = Semester.objects.create(
        tenant=tenant, academic_session=session, name="First Semester",
        start_date=datetime.date(2025, 9, 1), end_date=datetime.date(2026, 1, 31),
        is_current=True,
    )
    offering = CourseOffering.objects.create(tenant=tenant, course=course, academic_session=session, semester=sem)
    # The concept's material belongs to the same course -> quiz maps to it.
    res.course_offering = offering
    res.save(update_fields=["course_offering"])
    CourseEnrollment.objects.create(tenant=tenant, course_offering=offering, student=student)

    quiz = Quiz.objects.create(
        tenant=tenant, created_by=lecturer, title="Thermo quiz",
        course_offering=offering, status=Quiz.Status.PUBLISHED,
    )
    q1 = QuizQuestion.objects.create(
        tenant=tenant, quiz=quiz, question_text="Q1",
        question_type="multiple_choice", options=["A", "B"],
        correct_answer={"index": 0}, explanation="e", order_index=0,
    )

    client = _client(student)
    attempt = client.post("/api/v1/quiz-attempts/", {"quiz": str(quiz.id)}, format="json")
    assert attempt.status_code == 201, attempt.data
    attempt_id = attempt.data["id"]

    # Correct answer -> 100% quiz, no reading evidence -> mastery = 0.6 * 1.0 = 60%.
    submit = client.post(
        f"/api/v1/quiz-attempts/{attempt_id}/submit/",
        {"answers": {str(q1.id): {"index": 0}}},
        format="json",
    )
    assert submit.status_code == 200, submit.data
    assert submit.data["score"] == 100.0

    record = ProgressRecord.objects.get(user=student, concept=concept)
    assert record.progress_value == 60.0


@pytest.mark.django_db
def test_no_evidence_creates_no_progress_record():
    tenant = _tenant("pg-none")
    user = _student(tenant, "pg3@u.com")
    concept = Concept.objects.create(tenant=tenant, canonical_name="Orphan")
    _resource(tenant, user)
    # No reading, no quiz -> the Progress page stays empty.
    progress = _client(user).get("/api/v1/progress/").json()
    assert progress["results"] == []


@pytest.mark.django_db
def test_progress_is_user_scoped():
    from apps.learning.models import ProgressRecord

    tenant = _tenant("pg-scope")
    a = _student(tenant, "a@u.com")
    b = _student(tenant, "b@u.com")
    concept = Concept.objects.create(tenant=tenant, canonical_name="Calculus")
    res = _resource(tenant, a)
    ResourceConcept.objects.create(resource=res, concept=concept)

    _client(a).post(
        "/api/v1/reading-positions/", {"resource": str(res.id), "scroll_percentage": 50}, format="json",
    )
    assert ProgressRecord.objects.filter(user=a).count() == 1

    other = _client(b).get("/api/v1/progress/").json()
    assert other["results"] == []