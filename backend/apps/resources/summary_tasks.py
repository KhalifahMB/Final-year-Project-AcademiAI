"""Async summarization (queue: ai).

Authorization is re-checked inside the task: the resource must exist under
the requesting user's tenant (RLS scope) before any content is summarized.
"""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=45)
def summarize_resource_task(self, resource_id: str, tenant_id: str, user_id: str):
    from apps.common.ai import generate_summary
    from apps.common.db import tenant_scope
    from apps.resources.models import Resource, ResourceChunk

    with tenant_scope(tenant_id):
        resource = Resource.objects.filter(id=resource_id).first()
        if resource is None:
            return {"status": "failed", "error": "resource not found"}

        chunks = ResourceChunk.objects.filter(
            tenant_id=tenant_id,
            resource_version__resource=resource,
        ).order_by("chunk_index")[:30]
        text = "\n\n".join(c.content for c in chunks)
        if not text.strip():
            return {"status": "failed", "error": "no content"}

    summary = generate_summary(text)
    logger.info("Summary complete resource=%s user=%s", resource_id, user_id)
    return {"status": "completed", "resource_id": resource_id, "summary": summary}
