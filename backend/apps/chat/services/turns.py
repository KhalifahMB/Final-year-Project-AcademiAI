"""
Chat turn execution — the two producer paths end to end:

  execute_send_turn(...)    synchronous POST (kept for compatibility)
  iter_stream_events(...)   SSE generator (ChatGPT-style typewriter UX)

Both endpoints share retrieve_grounding_chunks(); the stream variant returns
(event_name, payload) tuples so the HTTP view only handles SSE framing.
"""
import logging
import time

from django.conf import settings

from apps.common.ai import generate_grounded_answer
from apps.common.ai.gemini import (
    _get_client,
    _sanitize_context,
    SYSTEM_GROUNDING,
    CANARY_OPEN,
    CANARY_CLOSE,
)
from apps.common.db import tenant_scope

from ..serializers import ChatMessageSerializer
from .retrieval import retrieve_grounding_chunks, enrich_sources, sources_from_chunks
from .store import append_user_message, append_assistant_message, bump_session_title

logger = logging.getLogger(__name__)

_SYNC_PROMPT_TAIL = (
    "Answer based only on the data between the [SYSTEM DATA] markers."
)


def execute_send_turn(user, session, content: str, attached_resource_ids: list | None = None):
    """
    Full synchronous turn: persist user message, retrieve grounding, generate
    the answer with citations, persist the assistant reply.

    Returns (user_msg, assistant_msg). Runs inside the request middleware's
    tenant-scoped transaction.
    """
    attached_resource_ids = attached_resource_ids or []
    user_msg = append_user_message(session, content)
    bump_session_title(session, content)

    chunks, _retrieval_ms, confidence = retrieve_grounding_chunks(
        user, session, content, attached_resource_ids,
    )
    answer, source_meta = generate_grounded_answer(content, chunks, user.role)

    # Enrich source_meta with resource id/title/version for clickable chips.
    if source_meta:
        chunk_ids = [str(s.get("chunk_id")) for s in source_meta if s.get("chunk_id")]
        if chunk_ids:
            metas = enrich_sources(chunk_ids, user)
            for s in source_meta:
                cid = str(s.get("chunk_id"))
                if cid in metas:
                    s.update(metas[cid])

    assistant_msg = append_assistant_message(
        session, answer, source_meta, confidence=confidence,
    )
    return user_msg, assistant_msg


def iter_stream_events(user, session, content: str, chunks: list, confidence: str,
                       retrieval_ms: int, user_msg):
    """
    SSE event generator — (event_name, payload) tuples, in the order the UI
    consumes them. When no Gemini key is set it falls back to a deterministic
    dev stub (same behaviour as the sync endpoint).

    The generator body runs AFTER the middleware's atomic block has closed
    (StreamingHttpResponse hands back to the middleware first, then Django
    iterates the body), so persistence re-opens its own tenant scope.
    """
    client = _get_client()

    yield "user_message", ChatMessageSerializer(user_msg).data
    yield "meta", {
        "chunks_retrieved": len(chunks),
        "confidence": confidence,
        "retrieval_ms": retrieval_ms,
        "model": settings.GEMINI_MODEL if client else "dev-stub",
    }

    answer_parts = []

    if client is None:
        # Dev stub (no API key) — deterministic text, one token event each word.
        stub = (
            "(Dev stub — set GEMINI_API_KEY to enable streaming.) "
            f"Based on {len(chunks)} retrieved chunk(s), a grounded "
            f"response would address: {content[:200]}"
        )
        for w in stub.split(" "):
            yield "token", {"text": w + " "}
            answer_parts.append(w + " ")
            time.sleep(0.02)
        answer = stub
    else:
        # Build the grounding context the same way generate_grounded_answer does.
        context_parts = [
            f"[Source {i + 1}] {_sanitize_context(c.get('content', ''))}"
            for i, c in enumerate(chunks)
        ]
        context_block = (
            f"{CANARY_OPEN}\n"
            + ("\n\n".join(context_parts) or "(no authorized context retrieved)")
            + f"\n{CANARY_CLOSE}"
        )
        prompt = (
            f"CONTEXT:\n{context_block}\n\n"
            f"USER QUESTION:\n{content}\n\n"
            f"{_SYNC_PROMPT_TAIL}"
        )
        try:
            response = client.models.generate_content_stream(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config={
                    "system_instruction": SYSTEM_GROUNDING,
                    "automatic_function_calling": {"disable": True},
                },
            )
            for chunk in response:
                txt = getattr(chunk, "text", "") or ""
                if txt:
                    answer_parts.append(txt)
                    yield "token", {"text": txt}
        except Exception:
            logger.exception("Streaming generation failed")
            err = "The AI service is temporarily unavailable. Please try again."
            yield "token", {"text": err}
            answer_parts = [err]
        answer = "".join(answer_parts)

    # Full citations (resource id/title/version) for the persisted message.
    sources_meta = sources_from_chunks(chunks, user)

    # IMPORTANT: this generator runs AFTER the middleware's atomic block has
    # exited. Open our own tenant-scoped transaction so RLS sees
    # app.current_tenant_id for all DB writes performed here.
    with tenant_scope(user.tenant_id):
        # Refresh session from DB inside this transaction so
        # save(update_fields=['updated_at']) works under RLS.
        session.refresh_from_db()
        assistant_msg = append_assistant_message(
            session, answer, sources_meta, confidence=confidence,
        )
        payload = ChatMessageSerializer(assistant_msg).data

    yield "done", {"assistant_message": payload}