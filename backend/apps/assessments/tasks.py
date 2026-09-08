"""AI quiz generation (queue: ai).

Runs under the requesting user's tenant scope so retrieval and persistence
are both RLS-enforced. Model output is schema-validated before persisting.
Each generated question is attributed to the authorized chunk whose content
best matches it (embedding cosine) so quiz answers can later feed resource
quality scoring.
"""
import logging

from celery import shared_task
from django.db import transaction

logger = logging.getLogger(__name__)

# Cosine threshold between a generated question and its presumed source chunk.
# Below this we leave source_chunk unset (no attribution) rather than risk a
# wrong link on a quiz answer.
ATTRIBUTION_MIN_SIMILARITY = 0.65


def _validate_quiz_payload(data: dict) -> list:
    """Return list of validated question dicts or empty."""
    questions = data.get("questions") or []
    valid = []
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            continue
        text = (q.get("question_text") or "").strip()
        options = q.get("options") or []
        if not text or not isinstance(options, list) or len(options) < 2:
            continue
        correct_answer = q.get("correct_answer")
        if not isinstance(correct_answer, dict):
            correct_answer = {}
        valid.append(
            {
                "question_text": text,
                "question_type": q.get("question_type") or "multiple_choice",
                "options": [str(o) for o in options],
                "correct_answer": correct_answer,
                "explanation": q.get("explanation") or "",
                "order_index": i,
            }
        )
    return valid


def _attribute_question_sources(questions: list[dict], chunks) -> list[dict]:
    """Set ``source_chunk_id`` on each validated question (in place)."""
    from apps.common.ai import generate_embeddings
    from apps.common.vectors import cosine_similarity

    chunk_rows = [
        (c.id, list(c.embedding)) for c in chunks if getattr(c, "embedding", None)
    ]
    if not chunk_rows:
        for q in questions:
            q["source_chunk_id"] = None
        return questions

    texts = [str(q.get("question_text") or "") for q in questions]
    vectors = generate_embeddings(texts) if texts else []
    for q, vec in zip(questions, vectors):
        if vec is None:
            q["source_chunk_id"] = None
            continue
        best_id, best_sim = None, 0.0
        for chunk_id, embedding in chunk_rows:
            sim = cosine_similarity(vec, embedding)
            if sim > best_sim:
                best_sim, best_id = sim, chunk_id
        q["source_chunk_id"] = (
            best_id if best_sim >= ATTRIBUTION_MIN_SIMILARITY else None
        )
    return questions


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def generate_quiz_task(self, user_id: str, tenant_id: str, params: dict):
    from apps.accounts.models import User
    from apps.assessments.models import Quiz, QuizQuestion
    from apps.common.ai import generate_quiz_json
    from apps.common.db import tenant_scope
    from apps.knowledge.retrieval import _authorized_resource_ids
    from apps.resources.models import ResourceChunk

    with tenant_scope(tenant_id):
        try:
            user = User.objects.get(id=user_id, tenant_id=tenant_id)
        except User.DoesNotExist:
            return {"status": "failed", "error": "user not found"}

        # Scope source content to materials this user is authorized to read
        # — never the whole tenant's corpus.
        requested_ids = [str(r) for r in (params.get("resource_ids") or [])]
        allowed = set(_authorized_resource_ids(user, params.get("course_offering_id")))
        if requested_ids:
            resource_ids = [r for r in requested_ids if r in allowed]
        else:
            resource_ids = allowed

        if not resource_ids:
            return {
                "status": "failed",
                "error": "No authorized materials available yet. Upload or ask for materials first.",
            }

        chunks = ResourceChunk.objects.filter(
            tenant_id=tenant_id,
            resource_version__resource_id__in=resource_ids,
        ).order_by("?")[:40]

        context = "\n\n".join(c.content[:1500] for c in chunks)

    if not context.strip():
        return {"status": "failed", "error": "no authorized content"}

    raw = generate_quiz_json(context, num_questions=params.get("num_questions", 5))
    validated = _validate_quiz_payload(raw)
    if not validated:
        return {"status": "failed", "error": "invalid model output"}

    validated = _attribute_question_sources(validated, chunks)

    with tenant_scope(tenant_id), transaction.atomic():
        quiz = Quiz.objects.create(
            tenant_id=tenant_id,
            created_by=user,
            course_offering_id=params.get("course_offering_id"),
            title=params.get("title") or raw.get("title") or "AI Generated Quiz",
            status=Quiz.Status.DRAFT,
            generation_job_id=self.request.id or "",
        )
        for q in validated:
            QuizQuestion.objects.create(
                tenant_id=tenant_id,
                quiz=quiz,
                source_chunk_id=q.pop("source_chunk_id"),
                **q,
            )
    return {"status": "completed", "quiz_id": str(quiz.id)}
