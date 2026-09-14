"""
Authorization-first RAG retrieval with citation enrichment.

Shared by the synchronous send and the SSE streaming endpoint so that
retrieval, attached-resource folding, and confidence heuristics live in one
place instead of being duplicated in both views.
"""
import hashlib
import logging
import time

from django.core.cache import cache

from apps.common.constants import (
    RAG_TOP_K,
    RAG_MAX_CONTEXT_CHUNKS,
    RAG_CHUNKS_PER_ATTACHED_RESOURCE,
    RAG_CACHE_TTL_SECONDS,
)
from apps.knowledge.retrieval import hybrid_retrieve
from apps.resources.models import Resource, ResourceChunk
from apps.resources.views import _authorized_resources_q
from ..models import ChatMessage

logger = logging.getLogger(__name__)


def compute_confidence(chunks: list) -> str:
    """Derive an answer-confidence label from the retrieved chunks.

    Heuristic (authorisation-first — only chunks the user may see):
      high   — >= 3 chunks from the authorised resource library
      medium — 1-2 chunks
      low    — 0 chunks (answer is from general knowledge, not grounded)
    """
    n = len(chunks)
    if n >= 3:
        return ChatMessage.Confidence.HIGH
    if n >= 1:
        return ChatMessage.Confidence.MEDIUM
    return ChatMessage.Confidence.LOW


def retrieve_grounding_chunks(user, session, content: str, attached_resource_ids: list):
    """
    Authorized, briefly-cached hybrid retrieval plus explicit attached
    resources. Returns (chunks, retrieval_ms, confidence).

    Cache is keyed by tenant+user+query so private-resource chunks never
    cross users. Attached resources are folded in AFTER the cache lookup
    (their set is per-request), matching the original endpoint behaviour.
    """
    cache_key = "rag:" + str(user.tenant_id) + ":" + str(user.id) + ":" + hashlib.sha256(
        content.encode("utf-8"),
    ).hexdigest()[:16]
    retrieval_start = time.monotonic()
    chunks = cache.get(cache_key)
    if chunks is None:
        chunks = hybrid_retrieve(
            query=content,
            tenant_id=user.tenant_id,
            user=user,
            course_offering_id=str(session.course_offering_id) if session.course_offering_id else None,
            top_k=RAG_TOP_K,
        )
        cache.set(cache_key, chunks, RAG_CACHE_TTL_SECONDS)
    retrieval_ms = int((time.monotonic() - retrieval_start) * 1000)

    merged = _fold_attached_resources(chunks, user, session, attached_resource_ids)
    return merged, retrieval_ms, compute_confidence(merged)


def _fold_attached_resources(chunks: list, user, session, attached_resource_ids: list) -> list:
    """Prepend the latest version's top chunks for each attached resource.

    Visibility-first: private materials are only retrievable by their
    uploader, for every role (admins included). Attached chunks rank ahead
    of hybrid results (deduplicated), capped at RAG_MAX_CONTEXT_CHUNKS.
    """
    if not attached_resource_ids:
        return chunks or []

    visible = Resource.objects.filter(
        _authorized_resources_q(user), tenant=user.tenant, id__in=attached_resource_ids,
    )
    attached = []
    for r in visible:
        latest = r.versions.order_by("-version_number").first()
        if not latest:
            continue
        rcs = list(
            ResourceChunk.objects.filter(
                resource_version=latest,
                tenant_id=user.tenant_id,
            )
            .order_by("chunk_index")[:RAG_CHUNKS_PER_ATTACHED_RESOURCE]
            .values("id", "content", "chunk_index")
        )
        for rc in rcs:
            attached.append(
                {
                    "id": str(rc["id"]),
                    "content": rc["content"],
                    "score": 1.0,
                    "method": "attached",
                    "rank": 0,
                }
            )

    seen = {c["id"] for c in attached}
    for c in chunks:
        cid = str(c.get("id"))
        if cid in seen:
            continue
        seen.add(cid)
        attached.append(c)
    return attached[:RAG_MAX_CONTEXT_CHUNKS]


def enrich_sources(chunk_ids: list, user) -> dict:
    """
    Bulk-resolve resource id/title/version for citation chips. Returns a
    {chunk_id: {...}} map. One query, no N+1. Unknown chunks are skipped.
    """
    metas = {}
    if not chunk_ids:
        return metas
    rows = ResourceChunk.objects.filter(
        id__in=chunk_ids, tenant_id=user.tenant_id,
    ).values(
        "id",
        "resource_version__version_number",
        "resource_version__resource_id",
        "resource_version__resource__title",
    )
    for m in rows:
        metas[str(m["id"])] = {
            "resource_id": str(m["resource_version__resource_id"]) if m["resource_version__resource_id"] else None,
            "resource_title": m["resource_version__resource__title"],
            "version_number": m["resource_version__version_number"],
        }
    return metas

def sources_from_chunks(chunks: list, user) -> list:
    """Build the full citation list for a set of chunks (rank, score, method,
    plus resource metadata) for persistence + the UI's clickable chips."""
    chunk_ids = [str(c.get("id")) for c in chunks if c.get("id")]
    meta = enrich_sources(chunk_ids, user)
    sources = []
    for i, c in enumerate(chunks):
        cid = str(c.get("id"))
        sources.append({
            "chunk_id": cid,
            "rank": i + 1,
            "similarity_score": c.get("score"),
            "retrieval_method": c.get("method", "hybrid"),
            **meta.get(cid, {}),
        })
    return sources