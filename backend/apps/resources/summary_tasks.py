"""Async summarization (queue: ai)."""
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=45)
def summarize_resource_task(self, resource_id: str, tenant_id: str, user_id: str):
    from apps.resources.models import Resource, ResourceChunk
    from apps.common.ai import generate_summary

    try:
        resource = Resource.objects.get(id=resource_id, tenant_id=tenant_id)
    except Resource.DoesNotExist:
        return {"status": "failed", "error": "resource not found"}

    chunks = ResourceChunk.objects.filter(
        tenant_id=tenant_id,
        resource_version__resource=resource,
    ).order_by("chunk_index")[:30]
    text = "\n\n".join(c.content for c in chunks)
    if not text.strip():
        return {"status": "failed", "error": "no content"}

    summary = generate_summary(text)
    # Store on resource metadata via processing_error field is wrong; use description append or JSON later
    # For now return result for job polling clients
    logger.info("Summary complete resource=%s user=%s", resource_id, user_id)
    return {"status": "completed", "resource_id": resource_id, "summary": summary}
