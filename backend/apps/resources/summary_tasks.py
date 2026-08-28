"""Async summarization (queue: ai).

Authorization is re-checked inside the task: the resource must exist under
the requesting user's tenant (RLS scope) before any content is summarized.

IMPORTANT: Celery workers (including solo-pool on Windows) run tasks OUTSIDE
the request middleware's tenant transaction, so we wrap ALL work — chunk
reads AND the Gemini call + result — inside tenant_scope(). Although
generate_summary() itself does no DB work, we materialize the queryset
inside the scope (via list()) and keep the scope open around the Gemini
call to avoid any connection-reuse edge cases with RLS config.
"""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=45,
    queue="ai",
    name="apps.resources.summary_tasks.summarize_resource_task",
)
def summarize_resource_task(self, resource_id: str, tenant_id: str, user_id: str):
    from apps.common.ai import generate_summary
    from apps.common.db import tenant_scope
    from apps.resources.models import Resource, ResourceChunk

    with tenant_scope(tenant_id):
        resource = Resource.objects.filter(id=resource_id).first()
        if resource is None:
            return {"status": "failed", "error": "resource not found"}

        # Materialize the chunk contents inside the tenant transaction so
        # lazy evaluation can't trip RLS after the scope closes.
        chunks = list(
            ResourceChunk.objects.filter(
                tenant_id=tenant_id,
                resource_version__resource=resource,
            )
            .order_by("chunk_index")
            .values_list("content", flat=True)[:30]
        )
        text = "\n\n".join(chunks)
        if not text.strip():
            return {"status": "failed", "error": "no content"}

        # Generate summary within the same tenant scope. The Gemini call
        # itself doesn't touch the DB, but keeping the scope open prevents
        # any connection-pool edge case where another bit of middleware or a
        # signal might re-use the connection without tenant context.
        summary = generate_summary(text)
        if not summary:
            return {"status": "failed", "error": "empty summary from AI"}

        logger.info(
            "Summary complete resource=%s user=%s length=%d",
            resource_id,
            user_id,
            len(summary),
        )
        return {
            "status": "completed",
            "resource_id": resource_id,
            "resource_title": resource.title,
            "summary": summary,
        }
