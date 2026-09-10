"""
Chat orchestration — view-free business logic in a service package.

    store/          append/get chat messages + sessions (persistence)
    retrieval.py    authorization-first RAG retrieval + citation enrichment
    turns.py        end-to-end turn execution (sync send, SSE stream)

Views stay thin: parse the HTTP request, delegate to a service, format the
HTTP response. See docs/AUDIT_REPORT.md finding #11.
"""
from .store import (
    get_or_create_session,
    append_user_message,
    append_assistant_message,
    bump_session_title,
)
from .retrieval import (
    compute_confidence,
    retrieve_grounding_chunks,
    enrich_sources,
)
from .turns import execute_send_turn, iter_stream_events

__all__ = [
    "get_or_create_session",
    "append_user_message",
    "append_assistant_message",
    "bump_session_title",
    "compute_confidence",
    "retrieve_grounding_chunks",
    "enrich_sources",
    "execute_send_turn",
    "iter_stream_events",
]