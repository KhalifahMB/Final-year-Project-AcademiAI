"""
Per-course-offering content intelligence for lecturers (Power Tools 4b).

Computed on demand from data that already exists (no cached tables):

- Resource quality scoring — how often each material is referenced by
  *successful* quiz answers (questions carry ``QuizQuestion.source_chunk``)
  and by AI chat citations (``ChatMessageSource``).
- Duplicate detection — exact duplicates via latest-version checksums plus
  near-duplicates via maximum chunk-embedding cosine similarity.
- Suggested resources — topics are derived from the course description
  (Gemini, with a deterministic fallback) and each topic is semantically
  matched against the offering's chunk embeddings.

Everything degrades deterministically: missing embeddings produce 0.0 cosine
(no duplicate flags, no similarity), and missing/empty course descriptions
produce an empty topic list.
"""
import itertools
import logging
from collections import defaultdict

from django.db.models import Count
from django.utils import timezone

from apps.assessments.answer_utils import is_answer_correct
from apps.assessments.models import QuizAttempt, QuizQuestion
from apps.chat.models import ChatMessageSource
from apps.common.ai import generate_embeddings, generate_topics
from apps.common.vectors import cosine_similarity
from apps.resources.models import Resource, ResourceChunk, ResourceVersion

logger = logging.getLogger(__name__)

# Quality scoring: each successful-quiz reference counts 2, each chat
# citation counts 1; weighted references * QUALITY_SCALE capped at 100.
QUIZ_REF_WEIGHT = 2
CHAT_REF_WEIGHT = 1
QUALITY_SCALE = 10
QUALITY_CAP = 100

# Duplicate detection.
DUPLICATE_SIMILARITY_THRESHOLD = 0.85
MAX_CHUNKS_PER_RESOURCE = 8
MAX_PAIR_COMPARISONS = 120

# Topic coverage ("suggested resources").
MAX_TOPICS = 8
SUGGESTED_PER_TOPIC = 3


def _offering_summary(offering) -> dict:
    return {
        "id": str(offering.id),
        "course_code": offering.course.code,
        "course_title": offering.course.title,
        "session_name": offering.academic_session.name,
        "semester_name": offering.semester.name,
    }


def _count_chat_references(tenant_id, resource_ids) -> dict:
    rows = (
        ChatMessageSource.objects.filter(
            tenant_id=tenant_id,
            chunk__resource_version__resource_id__in=resource_ids,
        )
        .values("chunk__resource_version__resource_id")
        .annotate(n=Count("id"))
    )
    return {str(r["chunk__resource_version__resource_id"]): r["n"] for r in rows}


def _count_quiz_references(offering, resource_id_str_map) -> dict:
    counts = defaultdict(int)
    quiz_id_to_resources = defaultdict(set)
    questions = (
        QuizQuestion.objects.filter(
            quiz__course_offering=offering,
            quiz__tenant_id=offering.tenant_id,
            source_chunk__isnull=False,
        )
        .select_related("source_chunk__resource_version__resource")
        .only(
            "id",
            "quiz_id",
            "correct_answer",
            "source_chunk__resource_version__resource_id",
        )
    )
    for q in questions:
        resource_id = q.source_chunk.resource_version.resource_id
        if str(resource_id) in resource_id_str_map:
            quiz_id_to_resources[q.quiz_id].add((q.id, resource_id))

    attempts = QuizAttempt.objects.filter(
        tenant_id=offering.tenant_id,
        quiz__course_offering=offering,
        submitted_at__isnull=False,
        answers__isnull=False,
    ).only("quiz_id", "answers")

    correct_answer_by_question = {
        q.id: q.correct_answer
        for q in questions
        if q.id in {entry[0] for entries in quiz_id_to_resources.values() for entry in entries}
    }

    for attempt in attempts:
        for question_id, resource_id in quiz_id_to_resources.get(attempt.quiz_id, set()):
            submitted = (attempt.answers or {}).get(str(question_id))
            if is_answer_correct(correct_answer_by_question.get(question_id), submitted):
                counts[str(resource_id)] += 1
    return dict(counts)


def _find_duplicates(tenant_id, resource_ids: list, resource_titles: dict) -> list:
    """Return duplicate pair rows: [{a, b, similarity, kind}, ...]."""
    if len(resource_ids) < 2:
        return []

    latest: dict = {}
    for v in (
        ResourceVersion.objects.filter(tenant_id=tenant_id, resource_id__in=resource_ids)
        .order_by("resource_id", "-version_number")
        .only("id", "resource_id", "checksum")
    ):
        if v.resource_id not in latest:
            latest[v.resource_id] = v

    pairs = {}
    exact_by_resource = defaultdict(list)
    checksum_groups = defaultdict(list)
    for resource_id, version in latest.items():
        if version.checksum:
            checksum_groups[version.checksum].append(resource_id)

    for group in checksum_groups.values():
        if len(group) > 1:
            for a, b in itertools.combinations(group, 2):
                pairs[(a, b)] = (1.0, "exact")
                exact_by_resource[a].append(b)
                exact_by_resource[b].append(a)

    sample_count = 0
    chunks_by_resource = __load_chunk_embeddings(latest, tenant_id)
    rid_list = [r for r in resource_ids]
    for i, a in enumerate(rid_list):
        for b in rid_list[i + 1:]:
            if sample_count >= MAX_PAIR_COMPARISONS:
                break
            if (a, b) in pairs:
                continue
            sample_count += 1
            best = 0.0
            for ea in chunks_by_resource.get(a, []):
                for eb in chunks_by_resource.get(b, []):
                    sim = cosine_similarity(ea, eb)
                    if sim > best:
                        best = sim
                        if best >= DUPLICATE_SIMILARITY_THRESHOLD:
                            break
                if best >= DUPLICATE_SIMILARITY_THRESHOLD:
                    break
            if best >= DUPLICATE_SIMILARITY_THRESHOLD:
                pairs[(a, b)] = (best, "near")

    if not pairs:
        return []

    def _info(resource_id):
        return {
            "resource_id": str(resource_id),
            "title": resource_titles.get(str(resource_id), ""),
        }

    rows = []
    for (a, b), (similarity, kind) in pairs.items():
        rows.append(
            {
                "a": _info(a),
                "b": _info(b),
                "similarity": round(similarity, 4),
                "kind": kind,
            }
        )
    rows.sort(key=lambda r: (-r["similarity"], r["a"]["resource_id"]))
    return rows


def __load_chunk_embeddings(latest: dict, tenant_id: str) -> dict:
    """Share chunk-embedding samples used by duplicates + topic matching."""
    version_ids = [v.id for v in latest.values()]
    chunks = (
        ResourceChunk.objects.filter(
            tenant_id=tenant_id,
            resource_version_id__in=version_ids,
            embedding__isnull=False,
        )
        .order_by("chunk_index")
        .values_list("resource_version__resource_id", "embedding")
    )
    out: dict = defaultdict(list)
    for resource_id, embedding in chunks:
        if len(out[resource_id]) < MAX_CHUNKS_PER_RESOURCE:
            out[resource_id].append(list(embedding))
    return dict(out)


def _suggest_resources(topics: list[str], chunks_by_resource: dict, titles: dict) -> list:
    suggestions = []
    for topic in topics:
        vec = generate_embeddings([topic])[0]
        best = []
        for resource_id, embeddings in chunks_by_resource.items():
            sim = max((cosine_similarity(vec, e) for e in embeddings), default=0.0)
            best.append((str(resource_id), sim))
        best.sort(key=lambda t: (-t[1], t[0]))
        suggested = [
            {
                "resource_id": resource_id,
                "title": titles.get(resource_id, ""),
                "similarity": round(sim, 4),
            }
            for resource_id, sim in best[:SUGGESTED_PER_TOPIC]
        ]
        suggestions.append(
            {
                "topic": topic,
                "best_similarity": round(best[0][1], 4) if best else 0.0,
                "resources": suggested,
            }
        )
    return suggestions


def build(offering) -> dict:
    """Compute the full content-intelligence payload for an offering."""
    tenant_id = offering.tenant_id
    resources = list(
        Resource.objects.filter(
            tenant_id=tenant_id,
            course_offering=offering,
            processing_status=Resource.ProcessingStatus.READY,
        ).order_by("title")
    )
    resource_ids = [r.id for r in resources]
    titles = {str(r.id): r.title for r in resources}

    quality = []
    if resource_ids:
        chat_refs = _count_chat_references(tenant_id, resource_ids)
        quiz_refs = _count_quiz_references(offering, {str(r.id): r for r in resources})
    else:
        chat_refs, quiz_refs = {}, {}
    for r in resources:
        quiz_cites = quiz_refs.get(str(r.id), 0)
        chat_cites = chat_refs.get(str(r.id), 0)
        weighted = quiz_cites * QUIZ_REF_WEIGHT + chat_cites * CHAT_REF_WEIGHT
        score = min(QUALITY_CAP, weighted * QUALITY_SCALE)
        tier = "unused" if score == 0 else ("core" if score >= 50 else "emerging")
        quality.append(
            {
                "resource_id": str(r.id),
                "title": r.title,
                "quality_score": score,
                "quality_tier": tier,
                "quiz_citations": quiz_cites,
                "chat_citations": chat_cites,
            }
        )

    duplicates = _find_duplicates(tenant_id, resource_ids, titles) if resource_ids else []
    duplicate_by_resource = {}
    for row in duplicates:
        for side in ("a", "b"):
            rid = row[side]["resource_id"]
            if rid not in duplicate_by_resource:
                other = row["b"] if side == "a" else row["a"]
                duplicate_by_resource[rid] = {
                    "resource_id": other["resource_id"],
                    "title": other["title"],
                    "similarity": row["similarity"],
                    "kind": row["kind"],
                }

    for item in quality:
        item["duplicate_of"] = duplicate_by_resource.get(item["resource_id"])

    latest = {}
    for v in (
        ResourceVersion.objects.filter(tenant_id=tenant_id, resource_id__in=resource_ids)
        .order_by("resource_id", "-version_number")
        .only("id", "resource_id")
    ):
        if v.resource_id not in latest:
            latest[v.resource_id] = v
    chunks_by_resource = __load_chunk_embeddings(latest, tenant_id)

    description = (offering.course.description or "").strip()
    topics = generate_topics(description, MAX_TOPICS)
    topic_rows = _suggest_resources(topics, chunks_by_resource, titles)

    return {
        "offering": _offering_summary(offering),
        "resources": quality,
        "duplicates": duplicates,
        "topics": topic_rows,
        "generation": {
            "topics_source": "course_description" if description else "empty_description",
            "score_formula": "quality_score = min(100, (quiz_citations * 2 + chat_citations * 1) * 10)",
            "computed_at": timezone.now().isoformat(),
        },
    }