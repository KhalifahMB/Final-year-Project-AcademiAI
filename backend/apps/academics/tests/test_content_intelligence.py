"""
Contract tests for per-offering content intelligence
(GET /course-offerings/{id}/content-intelligence/):

- Resource quality scoring from successful quiz-answer references + chat citations
- Duplicate detection (exact checksums + near-duplicate chunk similarity)
- Suggested resources per topic (course-description topics matched by embedding)
- Same access rules as the analytics endpoint
"""
import datetime
from uuid import uuid4

import pytest
from django.conf import settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.academics.models import (
    AcademicSession,
    Course,
    CourseOffering,
    Department,
    Faculty,
    LecturerCourseAssignment,
    Semester,
)
from apps.assessments.models import Quiz, QuizAttempt, QuizQuestion
from apps.chat.models import ChatMessage, ChatSession, ChatMessageSource
from apps.resources.models import Resource, ResourceChunk, ResourceVersion
from apps.tenants.models import Tenant


PASSWORD = "StrongPass!2026"
DIM = settings.EMBEDDING_DIMENSION


@pytest.fixture(autouse=True)
def _no_live_ai(monkeypatch):
    """Never hit the Gemini API in these tests (deterministic stubs)."""
    monkeypatch.setattr("apps.common.ai.gemini._get_client", lambda: None)


def _vec(index=0):
    """Unit-basis embedding vector: [0,0,..,1 at index,..,0]."""
    return [1.0 if i == index else 0.0 for i in range(DIM)]


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


def _campus(tenant, description=None):
    faculty = Faculty.objects.create(tenant=tenant, name="Science", code="SCI")
    department = Department.objects.create(
        tenant=tenant, faculty=faculty, name="Computing", code="COMP",
    )
    course = Course.objects.create(
        tenant=tenant, department=department, code="CS101",
        title="Computing 101",
        description=description
        if description is not None
        else "Introduction to machine learning. Regression. Classification.",
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


def _resource(tenant, uploader, offering, title, **overrides):
    data = {
        "title": title,
        "visibility_scope": Resource.Visibility.INSTITUTION,
        "processing_status": Resource.ProcessingStatus.READY,
        "uploaded_by": uploader,
        "course_offering": offering,
        "mime_type": "application/pdf",
        "storage_key": f"tenants/{tenant.id}/resources/{uuid4()}",
    }
    data.update(overrides)
    return Resource.objects.create(tenant=tenant, **data)


def _version(tenant, resource, checksum="", version_number=1):
    return ResourceVersion.objects.create(
        tenant=tenant, resource=resource, version_number=version_number,
        storage_key=f"keys/{uuid4()}", checksum=checksum,
    )


def _chunk(tenant, version, vector, content="Chunk content"):
    return ResourceChunk.objects.create(
        tenant=tenant, resource_version=version, chunk_index=0,
        content=content, embedding=vector,
    )


def _chat_citation(tenant, author, offering, chunk):
    session = ChatSession.objects.create(tenant=tenant, user=author, course_offering=offering)
    message = ChatMessage.objects.create(
        tenant=tenant, session=session, role=ChatMessage.Role.ASSISTANT,
        content="Grounded answer",
    )
    return ChatMessageSource.objects.create(
        tenant=tenant, message=message, chunk=chunk, rank=1,
        retrieval_method="hybrid",
    )


def _seeded_offering(tenant, lecturer, student, description=None):
    _fac, _dep, _course, _session, _semester, offering = _campus(tenant, description)
    LecturerCourseAssignment.objects.create(
        tenant=tenant, lecturer=lecturer, course_offering=offering,
    )
    return offering


def _payload(client, offering):
    return client.get(f"/api/v1/course-offerings/{offering.id}/content-intelligence/")


def _resource_by_id(data, resource):
    return next(
        r for r in data["resources"] if r["resource_id"] == str(resource.id)
    )


# ---------------------------------------------------------------- Quality


@pytest.mark.django_db
def test_quality_score_from_quiz_and_chat_references(monkeypatch):
    tenant = _tenant("ci-qual")
    lecturer = _user("lect@ci-qual.edu", tenant, role="lecturer")
    student = _user("stu@ci-qual.edu", tenant, role="student")
    offering = _seeded_offering(tenant, lecturer, student)

    # Resource A: cited by one correct quiz answer and two chat citations.
    # Resource B: no references at all.
    res_a = _resource(tenant, lecturer, offering, "Lecture A")
    res_b = _resource(tenant, lecturer, offering, "Lecture B")
    ver_a = _version(tenant, res_a)
    chunk_a = _chunk(tenant, ver_a, _vec(0))
    _version(tenant, res_b)

    quiz = Quiz.objects.create(
        tenant=tenant, course_offering=offering, created_by=lecturer,
        title="Quiz", status=Quiz.Status.PUBLISHED,
    )
    q = QuizQuestion.objects.create(
        tenant=tenant, quiz=quiz, question_text="Answer?",
        question_type=QuizQuestion.QuestionType.MULTIPLE_CHOICE,
        options=["Right", "Wrong"], correct_answer={"index": 1},
        order_index=0, source_chunk=chunk_a,
    )
    QuizAttempt.objects.create(
        tenant=tenant, quiz=quiz, student=student,
        answers={str(q.id): 1}, score=100.0, submitted_at=timezone.now(),
    )

    _chat_citation(tenant, student, offering, chunk_a)
    _chat_citation(tenant, student, offering, chunk_a)

    data = _payload(_auth(lecturer), offering).json()

    row_a = _resource_by_id(data, res_a)
    row_b = _resource_by_id(data, res_b)
    # quiz (1 correct) * 2 + chat (2) * 1 = 4 weighted refs * 10 = 40
    assert row_a["quiz_citations"] == 1
    assert row_a["chat_citations"] == 2
    assert row_a["quality_score"] == 40
    assert row_a["quality_tier"] == "emerging"
    assert row_a["duplicate_of"] is None

    assert row_b["quiz_citations"] == 0
    assert row_b["chat_citations"] == 0
    assert row_b["quality_score"] == 0
    assert row_b["quality_tier"] == "unused"


@pytest.mark.django_db
def test_quiz_references_count_only_correct_answers(monkeypatch):
    tenant = _tenant("ci-qa")
    lecturer = _user("lect@ci-qa.edu", tenant, role="lecturer")
    student = _user("stu@ci-qa.edu", tenant, role="student")
    offering = _seeded_offering(tenant, lecturer, student)

    res = _resource(tenant, lecturer, offering, "Notes")
    chunk = _chunk(tenant, _version(tenant, res), _vec(0))

    quiz = Quiz.objects.create(
        tenant=tenant, course_offering=offering, created_by=lecturer,
        title="Quiz", status=Quiz.Status.PUBLISHED,
    )
    q = QuizQuestion.objects.create(
        tenant=tenant, quiz=quiz, question_text="Pick?",
        question_type=QuizQuestion.QuestionType.MULTIPLE_CHOICE,
        options=["A", "B"], correct_answer={"index": 1},
        order_index=0, source_chunk=chunk,
    )
    # One correct, one incorrect, one without an answer for the question.
    QuizAttempt.objects.create(
        tenant=tenant, quiz=quiz, student=student,
        answers={str(q.id): 1}, score=100.0, submitted_at=timezone.now(),
    )
    QuizAttempt.objects.create(
        tenant=tenant, quiz=quiz, student=student,
        answers={str(q.id): 0}, score=0.0, submitted_at=timezone.now(),
    )
    QuizAttempt.objects.create(
        tenant=tenant, quiz=quiz, student=student,
        answers={}, score=0.0, submitted_at=timezone.now(),
    )

    row = _resource_by_id(_payload(_auth(lecturer), offering).json(), res)
    assert row["quiz_citations"] == 1  # only the correct one
    assert row["quality_score"] == 20


@pytest.mark.django_db
def test_chat_citations_count_toward_quality():
    tenant = _tenant("ci-chat")
    lecturer = _user("lect@ci-chat.edu", tenant, role="lecturer")
    student = _user("stu@ci-chat.edu", tenant, role="student")
    offering = _seeded_offering(tenant, lecturer, student)

    res = _resource(tenant, lecturer, offering, "Handout")
    chunk = _chunk(tenant, _version(tenant, res), _vec(0))
    for _ in range(3):
        _chat_citation(tenant, student, offering, chunk)

    row = _resource_by_id(_payload(_auth(lecturer), offering).json(), res)
    assert row["chat_citations"] == 3
    # 3 * 1 * 10 = 30
    assert row["quality_score"] == 30
    assert row["quality_tier"] == "emerging"


@pytest.mark.django_db
def test_question_without_source_chunk_contributes_nothing():
    tenant = _tenant("ci-nosrc")
    lecturer = _user("lect@ci-nosrc.edu", tenant, role="lecturer")
    student = _user("stu@ci-nosrc.edu", tenant, role="student")
    offering = _seeded_offering(tenant, lecturer, student)

    res = _resource(tenant, lecturer, offering, "Slides")
    _version(tenant, res)

    quiz = Quiz.objects.create(
        tenant=tenant, course_offering=offering, created_by=lecturer,
        title="Quiz", status=Quiz.Status.PUBLISHED,
    )
    q = QuizQuestion.objects.create(
        tenant=tenant, quiz=quiz, question_text="Q?",
        question_type=QuizQuestion.QuestionType.MULTIPLE_CHOICE,
        options=["A", "B"], correct_answer={"index": 1},
        order_index=0, source_chunk=None,
    )
    QuizAttempt.objects.create(
        tenant=tenant, quiz=quiz, student=student,
        answers={str(q.id): 1}, score=100.0, submitted_at=timezone.now(),
    )

    row = _resource_by_id(_payload(_auth(lecturer), offering).json(), res)
    assert row["quiz_citations"] == 0
    assert row["quality_score"] == 0


# ------------------------------------------------------------- Duplicates


@pytest.mark.django_db
def test_exact_duplicate_via_checksum():
    tenant = _tenant("ci-dup-hash")
    lecturer = _user("lect@ci-dup-hash.edu", tenant, role="lecturer")
    student = _user("stu@ci-dup-hash.edu", tenant, role="student")
    offering = _seeded_offering(tenant, lecturer, student)

    res_a = _resource(tenant, lecturer, offering, "Slides v1")
    res_b = _resource(tenant, lecturer, offering, "Slides v2")
    _version(tenant, res_a, checksum="hash-abc")
    _version(tenant, res_b, checksum="hash-abc")

    data = _payload(_auth(lecturer), offering).json()
    assert len(data["duplicates"]) == 1
    pair = data["duplicates"][0]
    assert pair["kind"] == "exact"
    assert {pair["a"]["resource_id"], pair["b"]["resource_id"]} == {
        str(res_a.id), str(res_b.id),
    }

    row = _resource_by_id(data, res_a)
    assert row["duplicate_of"]["resource_id"] == str(res_b.id)
    assert row["duplicate_of"]["kind"] == "exact"


@pytest.mark.django_db
def test_near_duplicate_via_chunk_similarity():
    tenant = _tenant("ci-dup-near")
    lecturer = _user("lect@ci-dup-near.edu", tenant, role="lecturer")
    student = _user("stu@ci-dup-near.edu", tenant, role="student")
    offering = _seeded_offering(tenant, lecturer, student)

    res_a = _resource(tenant, lecturer, offering, "Lecture 1")
    res_b = _resource(tenant, lecturer, offering, "Lecture 1 copy")
    res_c = _resource(tenant, lecturer, offering, "Different topic")
    _chunk(tenant, _version(tenant, res_a), _vec(0))
    _chunk(tenant, _version(tenant, res_b), _vec(0))   # identical embedding
    _chunk(tenant, _version(tenant, res_c), _vec(3))  # orthogonal

    data = _payload(_auth(lecturer), offering).json()
    pairs = data["duplicates"]
    assert len(pairs) == 1
    pair = pairs[0]
    assert pair["kind"] == "near"
    assert pair["similarity"] == pytest.approx(1.0, abs=1e-3)
    assert {pair["a"]["resource_id"], pair["b"]["resource_id"]} == {
        str(res_a.id), str(res_b.id),
    }

    row_c = _resource_by_id(data, res_c)
    assert row_c["duplicate_of"] is None


# ---------------------------------------------------------------- Topics


@pytest.mark.django_db
def test_topic_suggestions_match_resource_by_embedding(monkeypatch):
    tenant = _tenant("ci-topics")
    lecturer = _user("lect@ci-topics.edu", tenant, role="lecturer")
    student = _user("stu@ci-topics.edu", tenant, role="student")
    offering = _seeded_offering(tenant, lecturer, student)

    res_regression = _resource(tenant, lecturer, offering, "Regression notes")
    res_classification = _resource(tenant, lecturer, offering, "Classification notes")
    _chunk(tenant, _version(tenant, res_regression), _vec(1), "Regression")
    _chunk(tenant, _version(tenant, res_classification), _vec(2), "Classification")

    monkeypatch.setattr(
        "apps.resources.content_intelligence.generate_embeddings",
        lambda texts: [_vec(1) if "Regression" in (texts[0] or "") else _vec(2)],
    )
    monkeypatch.setattr(
        "apps.resources.content_intelligence.generate_topics",
        lambda description, max_topics=8: ["Regression", "Classification"],
    )

    data = _payload(_auth(lecturer), offering).json()
    by_topic = {t["topic"]: t for t in data["topics"]}
    assert "Regression" in by_topic
    regression_resources = {
        r["resource_id"] for r in by_topic["Regression"]["resources"]
    }
    assert str(res_regression.id) in regression_resources
    if regression_resources:
        first = max(
            by_topic["Regression"]["resources"],
            key=lambda r: r["similarity"],
        )
        assert first["resource_id"] == str(res_regression.id)
        assert first["similarity"] == pytest.approx(1.0, abs=1e-3)


@pytest.mark.django_db
def test_topics_fallback_is_deterministic_without_ai(monkeypatch):
    tenant = _tenant("ci-fallback")
    lecturer = _user("lect@ci-fallback.edu", tenant, role="lecturer")
    student = _user("stu@ci-fallback.edu", tenant, role="student")
    offering = _seeded_offering(tenant, lecturer, student)

    res = _resource(tenant, lecturer, offering, "Material")
    _chunk(tenant, _version(tenant, res), _vec(0))

    monkeypatch.setattr("apps.common.ai.gemini._get_client", lambda: None)

    data = _payload(_auth(lecturer), offering).json()
    topics = [t["topic"] for t in data["topics"]]
    assert topics == [
        "Introduction to machine learning",
        "Regression",
        "Classification",
    ]
    assert data["generation"]["topics_source"] == "course_description"
    assert all(t["best_similarity"] == 0.0 for t in data["topics"])


@pytest.mark.django_db
def test_empty_description_yields_no_topics(monkeypatch):
    tenant = _tenant("ci-nodesc")
    lecturer = _user("lect@ci-nodesc.edu", tenant, role="lecturer")
    student = _user("stu@ci-nodesc.edu", tenant, role="student")
    offering = _seeded_offering(tenant, lecturer, student, description="")

    res = _resource(tenant, lecturer, offering, "Material")
    _chunk(tenant, _version(tenant, res), _vec(0))

    monkeypatch.setattr("apps.common.ai.gemini._get_client", lambda: None)
    data = _payload(_auth(lecturer), offering).json()
    assert data["topics"] == []
    assert data["generation"]["topics_source"] == "empty_description"


# ---------------------------------------------------------------- Guards


def _guard_offering():
    tenant = _tenant("ci-guard")
    lecturer = _user("lect@ci-guard.edu", tenant, role="lecturer")
    student = _user("stu@ci-guard.edu", tenant, role="student")
    offering = _seeded_offering(tenant, lecturer, student)
    return tenant, lecturer, student, offering


@pytest.mark.django_db
def test_unassigned_lecturer_forbidden():
    tenant, lecturer, student, offering = _guard_offering()
    other = _user("other@ci-guard.edu", tenant, role="lecturer")
    assert _payload(_auth(other), offering).status_code == 403


@pytest.mark.django_db
def test_student_forbidden():
    tenant, lecturer, student, offering = _guard_offering()
    assert _payload(_auth(student), offering).status_code == 403


@pytest.mark.django_db
def test_admin_sees_any_offering_in_tenant():
    tenant, lecturer, student, offering = _guard_offering()
    admin = _user("admin@ci-guard.edu", tenant, role="tenant_admin")
    assert _payload(_auth(admin), offering).status_code == 200


@pytest.mark.django_db
def test_cross_tenant_offering_not_found():
    tenant, lecturer, student, offering = _guard_offering()
    tenant_b = _tenant("ci-iso-b")
    foreign_admin = _user("admin@ci-iso-b.edu", tenant_b, role="tenant_admin")
    assert _payload(_auth(foreign_admin), offering).status_code == 404