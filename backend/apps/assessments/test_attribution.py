"""
Unit tests for question-to-chunk attribution during AI quiz generation
(apps/assessments/tasks._attribute_question_sources).
"""
from uuid import uuid4

import pytest

from apps.accounts.models import User
from apps.assessments.models import QuizQuestion
from apps.assessments.tasks import _attribute_question_sources
from apps.resources.models import Resource, ResourceChunk, ResourceVersion
from apps.tenants.models import Tenant


def _tenant(slug):
    return Tenant.objects.create(name=f"Uni {slug}", slug=f"{slug}-{uuid4().hex[:8]}")


def _user(email, tenant):
    return User.objects.create_user(
        email=email, password="StrongPass!2026", tenant=tenant, role="lecturer",
    )


def _resource_and_chunks(tenant, uploader, vectors):
    """Return (resource, [chunk, ...]) with one chunk per embedding vector."""
    resource = Resource.objects.create(
        tenant=tenant, title="Slides",
        uploaded_by=uploader,
        visibility_scope=Resource.Visibility.INSTITUTION,
        processing_status=Resource.ProcessingStatus.READY,
        mime_type="application/pdf",
        storage_key=f"keys/{uuid4()}",
    )
    version = ResourceVersion.objects.create(
        tenant=tenant, resource=resource, version_number=1,
        storage_key=f"keys/{uuid4()}",
    )
    chunks = []
    for i, vector in enumerate(vectors):
        chunks.append(
            ResourceChunk.objects.create(
                tenant=tenant, resource_version=version, chunk_index=i,
                content=f"Chunk {i}", embedding=vector,
            )
        )
    return resource, chunks


def _vec(index=0, dim=768):
    return [1.0 if i == index else 0.0 for i in range(dim)]


@pytest.mark.django_db
def test_attribution_matches_best_chunk(monkeypatch):
    tenant = _tenant("at-match")
    lecturer = _user("lect@at-match.edu", tenant)
    _, chunks = _resource_and_chunks(tenant, lecturer, [_vec(0), _vec(3)])

    monkeypatch.setattr(
        "apps.common.ai.generate_embeddings", lambda texts: [None, _vec(0)]
    )

    questions = [
        {"question_text": "Q1 no vector", "source_chunk_id": None},
        {"question_text": "Q2 matches chunk 0", "source_chunk_id": None},
    ]
    result = _attribute_question_sources(questions, list(chunks))

    assert result[0]["source_chunk_id"] is None
    assert result[1]["source_chunk_id"] == chunks[0].id


@pytest.mark.django_db
def test_attribution_rejects_below_threshold(monkeypatch):
    tenant = _tenant("at-low")
    lecturer = _user("lect@at-low.edu", tenant)
    _, chunks = _resource_and_chunks(tenant, lecturer, [_vec(0)])

    monkeypatch.setattr(
        "apps.common.ai.generate_embeddings", lambda texts: [_vec(2)]
    )

    questions = [{"question_text": "Orthogonal to chunk", "source_chunk_id": None}]
    _attribute_question_sources(questions, list(chunks))

    assert questions[0]["source_chunk_id"] is None


@pytest.mark.django_db
def test_attribution_without_embeddings_leaves_unset():
    tenant = _tenant("at-none")
    lecturer = _user("lect@at-none.edu", tenant)
    resource = Resource.objects.create(
        tenant=tenant, title="No embeddings",
        uploaded_by=lecturer,
        visibility_scope=Resource.Visibility.INSTITUTION,
        processing_status=Resource.ProcessingStatus.READY,
        mime_type="application/pdf", storage_key=f"keys/{uuid4()}",
    )
    version = ResourceVersion.objects.create(
        tenant=tenant, resource=resource, version_number=1,
        storage_key=f"keys/{uuid4()}",
    )
    chunk = ResourceChunk.objects.create(
        tenant=tenant, resource_version=version, chunk_index=0,
        content="No vector", embedding=None,
    )

    questions = [{"question_text": "Anything", "source_chunk_id": None}]
    _attribute_question_sources(questions, [chunk])

    assert questions[0]["source_chunk_id"] is None


@pytest.mark.django_db
def test_source_chunk_is_attributed_on_persist(monkeypatch):
    """End-to-end: validated questions keep source_chunk_id through creation."""
    from apps.assessments.models import Quiz
    from apps.assessments.tasks import _validate_quiz_payload

    tenant = _tenant("at-persist")
    lecturer = _user("lect@at-persist.edu", tenant)
    _, chunks = _resource_and_chunks(tenant, lecturer, [_vec(0), _vec(1)])

    # Fake an AI payload, validate it like the task does, then attribute.
    raw = {
        "questions": [
            {
                "question_text": "Pick the regression method",
                "question_type": "multiple_choice",
                "options": ["Linear", "Random"],
                "correct_answer": {"index": 0, "text": "Linear"},
                "explanation": "",
            }
        ]
    }
    validated = _validate_quiz_payload(raw)
    assert len(validated) == 1

    monkeypatch.setattr(
        "apps.common.ai.generate_embeddings", lambda texts: [_vec(0)]
    )
    validated = _attribute_question_sources(validated, list(chunks))

    quiz = Quiz.objects.create(
        tenant=tenant, created_by=lecturer, title="AI Quiz",
        status=Quiz.Status.DRAFT,
    )
    for q in validated:
        QuizQuestion.objects.create(tenant=tenant, quiz=quiz, **q)

    saved = QuizQuestion.objects.get(quiz=quiz)
    assert saved.source_chunk_id == chunks[0].id
    assert saved.question_text == "Pick the regression method"