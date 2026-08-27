"""
Grounded chat orchestration: authorize → retrieve → Gemini → persist + citations.
"""
import logging

from django.db import transaction

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


@transaction.atomic
def append_user_message(session, content: str) -> ChatMessage:
    return ChatMessage.objects.create(
        tenant=session.tenant,
        session=session,
        role=ChatMessage.Role.USER,
        content=content,
        content_type=ChatMessage.ContentType.TEXT,
    )


@transaction.atomic
def append_assistant_message(session, content: str, sources: list) -> ChatMessage:
    """
    sources: list of dicts with keys chunk_id, rank, similarity_score, retrieval_method
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
        # Authorization: chunk must belong to same tenant
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
