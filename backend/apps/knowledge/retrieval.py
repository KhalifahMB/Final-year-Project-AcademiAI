"""
Hybrid RAG retrieval: authorization-first, then semantic + lexical + optional concept signals + RRF.
"""
import logging
from collections import defaultdict
from uuid import UUID

from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.db.models import Q
from pgvector.django import CosineDistance

from apps.resources.models import Resource, ResourceChunk
from apps.academics.models import CourseEnrollment, LecturerCourseAssignment

logger = logging.getLogger(__name__)


def _viewer_academic_context(user):
    """
    Resolve the viewer's programme/department/faculty ids from their profile.

    Students inherit scope from their programme; lecturers from their
    department. Returns (programme_id, department_id, faculty_id) with None
    for unknown levels.
    """
    from apps.accounts.models import StudentProfile, LecturerProfile

    programme_id = department_id = faculty_id = None
    if user.role == "student":
        profile = (
            StudentProfile.objects.filter(user=user)
            .select_related("programme__department__faculty")
            .first()
        )
        if profile and profile.programme:
            programme_id = profile.programme_id
            department_id = profile.programme.department_id
            faculty_id = profile.programme.department.faculty_id
    else:
        profile = (
            LecturerProfile.objects.filter(user=user)
            .select_related("department__faculty")
            .first()
        )
        if profile and profile.department:
            department_id = profile.department_id
            faculty_id = profile.department.faculty_id
    return programme_id, department_id, faculty_id


def _authorized_resource_ids(user, course_offering_id=None):
    """
    Resources the user may retrieve from. Never bypass this.

    Scope semantics (PRD §8): institution-wide resources are visible to all
    tenant members; course-scoped to enrolled students and assigned
    lecturers; programme/department/faculty scopes follow the viewer's
    academic profile; private resources only to the uploader. Admins see
    everything in the tenant.
    """
    tenant_id = user.tenant_id
    qs = Resource.objects.filter(
        tenant_id=tenant_id,
        processing_status=Resource.ProcessingStatus.READY,
    )

    role = getattr(user, "role", None)
    is_admin = role == "admin" or bool(getattr(user, "is_superuser", False))
    if is_admin:
        if course_offering_id:
            qs = qs.filter(
                Q(course_offering_id=course_offering_id)
                | Q(visibility_scope=Resource.Visibility.INSTITUTION)
            )
        # Private materials are owner-only, even for admins/superusers.
        qs = qs.filter(
            ~Q(visibility_scope=Resource.Visibility.PRIVATE)
            | Q(
                visibility_scope=Resource.Visibility.PRIVATE,
                uploaded_by=user,
            )
        )
        return list(qs.values_list("id", flat=True))

    # Students: enrolled offerings + institution-visible
    enrolled = CourseEnrollment.objects.filter(
        student=user, status=CourseEnrollment.Status.ENROLLED
    ).values_list("course_offering_id", flat=True)

    # Lecturers: assigned offerings
    assigned = LecturerCourseAssignment.objects.filter(lecturer=user).values_list(
        "course_offering_id", flat=True
    )

    allowed_offerings = set(enrolled) | set(assigned)
    if course_offering_id:
        try:
            oid = UUID(str(course_offering_id))
        except ValueError:
            allowed_offerings = set()
        else:
            # Restrict retrieval to the requested offering — but only when
            # the user is actually attached to it.
            allowed_offerings = {oid} if oid in allowed_offerings else set()

    q = (
        Q(visibility_scope=Resource.Visibility.INSTITUTION)
        | Q(visibility_scope=Resource.Visibility.COURSE, course_offering_id__in=allowed_offerings)
        | Q(
            visibility_scope=Resource.Visibility.COURSE,
            course_offering__isnull=True,
            uploaded_by=user,
        )
        | Q(visibility_scope=Resource.Visibility.PRIVATE, uploaded_by=user)
    )

    programme_id, department_id, faculty_id = _viewer_academic_context(user)
    if programme_id:
        q |= Q(visibility_scope=Resource.Visibility.PROGRAMME, programme_id=programme_id)
    if department_id:
        q |= Q(visibility_scope=Resource.Visibility.DEPARTMENT, department_id=department_id)
    if faculty_id:
        q |= Q(visibility_scope=Resource.Visibility.FACULTY, faculty_id=faculty_id)

    return list(qs.filter(q).values_list("id", flat=True))


def _rrf_fuse(rank_lists, k=60):
    """Reciprocal Rank Fusion over lists of (chunk_id, rank_index)."""
    scores = defaultdict(float)
    for lst in rank_lists:
        for rank, chunk_id in enumerate(lst):
            scores[chunk_id] += 1.0 / (k + rank + 1)
    return sorted(scores.items(), key=lambda x: -x[1])




def _concept_related_chunk_ids(tenant_id, query: str, resource_ids, limit=20):
    """Lightweight concept-aware signal: match concept names in query, map to resources/chunks."""
    from apps.knowledge.models import Concept, ResourceConcept
    from apps.resources.models import ResourceChunk
    terms = [w for w in (query or "").lower().split() if len(w) > 3]
    if not terms:
        return []
    q = Q()
    for term in terms[:8]:
        q |= Q(canonical_name__icontains=term)
    concepts = Concept.objects.filter(tenant_id=tenant_id).filter(q)[:15]
    if not concepts:
        return []
    concept_ids = [c.id for c in concepts]
    res_ids = ResourceConcept.objects.filter(concept_id__in=concept_ids).values_list(
        "resource_id", flat=True
    )
    res_ids = set(res_ids) & set(resource_ids)
    if not res_ids:
        return []
    return list(
        ResourceChunk.objects.filter(
            tenant_id=tenant_id,
            resource_version__resource_id__in=res_ids,
        ).values_list("id", flat=True)[:limit]
    )

def hybrid_retrieve(query: str, tenant_id, user, course_offering_id=None, top_k=8):
    """
    Returns list of dicts: id, content, score, method
    """
    resource_ids = _authorized_resource_ids(user, course_offering_id)
    if not resource_ids:
        return []

    base = ResourceChunk.objects.filter(
        tenant_id=tenant_id,
        resource_version__resource_id__in=resource_ids,
    )

    # Lexical (PostgreSQL full-text)
    lexical_ids = []
    try:
        vector = SearchVector("content", config="english")
        search_q = SearchQuery(query, config="english")
        lexical = (
            base.annotate(rank=SearchRank(vector, search_q))
            .filter(rank__gt=0.01)
            .order_by("-rank")[: top_k * 2]
        )
        lexical_ids = [c.id for c in lexical]
    except Exception:
        logger.exception("Lexical search failed")
        lexical = []

    # Semantic (pgvector) if embeddings present
    semantic_ids = []
    try:
        from apps.common.ai import generate_embeddings

        emb = generate_embeddings([query])[0]
        if emb and any(v != 0.0 for v in emb):
            semantic = (
                base.exclude(embedding=None)
                .order_by(CosineDistance("embedding", emb))[: top_k * 2]
            )
            semantic_ids = [c.id for c in semantic]
    except Exception:
        logger.exception("Semantic search failed")

    concept_ids = []
    try:
        concept_ids = _concept_related_chunk_ids(tenant_id, query, resource_ids)
    except Exception:
        logger.exception("Concept signal failed")
    lists = [lexical_ids]
    if semantic_ids:
        lists.append(semantic_ids)
    if concept_ids:
        lists.append(concept_ids)
    fused = _rrf_fuse(lists)
    top_ids = [cid for cid, _ in fused[:top_k]]

    if not top_ids and lexical_ids:
        top_ids = lexical_ids[:top_k]

    chunks = {c.id: c for c in base.filter(id__in=top_ids)}
    score_map = dict(fused)
    results = []
    for cid in top_ids:
        c = chunks.get(cid)
        if not c:
            continue
        method = "hybrid"
        if cid in lexical_ids and cid in semantic_ids:
            method = "hybrid"
        elif cid in semantic_ids:
            method = "semantic"
        elif cid in lexical_ids:
            method = "lexical"
        results.append(
            {
                "id": c.id,
                "content": c.content,
                "score": score_map.get(cid, 0.0),
                "method": method,
            }
        )
    return results
