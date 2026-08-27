"""
Grounded chat orchestration: authorize -> retrieve -> Gemini -> persist + citations.

Note: these helpers intentionally do NOT open their own transaction.atomic().
They must run inside a caller-managed transaction so that RLS's
`app.current_tenant_id` setting (set via apps.common.db.tenant_scope or the
TenantContextMiddleware) remains visible throughout the write. Opening a
nested transaction here would not break correctness, but callers must still
guarantee the tenant config is in scope (critical for the SSE streaming
generator where the middleware transaction has already closed).
"""
import logging

from apps.resources.models import ResourceChunk
from .models import ChatSession, ChatMessage, ChatMessageSource

logger = logging.getLogger(__name__)


def get_or_create_session(user, session_id=None, course_offering=None, title="New chat"):
    if session_id:
        return ChatSession.objects.get(id=session_id, user=user, tenant=user.tenant)
    return ChatSession.objects.create(
        tenant=user.tenant,
        user=user,
        course_offering=course_offering,
        title=title[:255],
    )


def append_user_message(session, content: str) -> ChatMessage:
    return ChatMessage.objects.create(
        tenant=session.tenant,
        session=session,
        role=ChatMessage.Role.USER,
        content=content,
        content_type=ChatMessage.ContentType.TEXT,
    )


def append_assistant_message(session, content: str, sources: list) -> ChatMessage:
    """
    sources: list of dicts with keys chunk_id, rank, similarity_score, retrieval_method

    Caller MUST run this inside a tenant-scoped transaction (middleware's
    atomic block, or tenant_scope()) so that RLS policies can see
    app.current_tenant_id for all inserted rows.
    """
    msg = ChatMessage.objects.create(
        tenant=session.tenant,
        session=session,
        role=ChatMessage.Role.ASSISTANT,
        content=content,
    )
    for s in sources:
        chunk_id = s.get("chunk_id")
        if not chunk_id:
            continue
        # Authorization: chunk must belong to same tenant.
        if not ResourceChunk.objects.filter(id=chunk_id, tenant_id=session.tenant_id).exists():
            logger.warning("Skipped unauthorized chunk %s for tenant %s", chunk_id, session.tenant_id)
            continue
        ChatMessageSource.objects.create(
            tenant=session.tenant,
            message=msg,
            chunk_id=chunk_id,
            rank=s.get("rank", 0),
            similarity_score=s.get("similarity_score"),
            retrieval_method=s.get("retrieval_method", "hybrid"),
        )
    session.save(update_fields=["updated_at"])
    return msg
