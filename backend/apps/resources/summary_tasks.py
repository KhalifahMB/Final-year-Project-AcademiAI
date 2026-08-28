"""Async summarization (queue: ai).

Authorization is re-checked inside the task: the resource must exist under
the requesting user's tenant (RLS scope) before any content is summarized.

IMPORTANT: Celery workers (including solo-pool on Windows) run tasks OUTSIDE
the request middleware's tenant transaction, so we wrap ALL work — chunk
reads AND the Gemini call + result persistence — inside tenant_scope().
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
    from apps.resources.models import Resource, ResourceChunk, ResourceSummary

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

        result = generate_summary(text)
        print(f"result {result}")
        summary_text = (result or {}).get("summary", "").strip()
        key_points = (result or {}).get("key_points", []) or []
        if not summary_text:
            return {"status": "failed", "error": "empty summary from AI"}

        # Persist the summary so it's available across sessions.
        try:
            from apps.accounts.models import User

            user = User.objects.filter(id=user_id).first()
            obj = ResourceSummary.objects.create(
                tenant_id=tenant_id,
                resource=resource,
                created_by=user,
                version_number=(resource.versions.order_by("-version_number")
                                .values_list("version_number", flat=True).first() or 1),
                summary=summary_text,
                key_points=key_points,
                word_count=len(summary_text.split()),
                model_name=getattr(self, "model", None) or "",
            )
            summary_id = str(obj.id)
        except Exception:
            logger.exception("Failed to persist summary resource=%s", resource_id)
            summary_id = None

        logger.info(
            "Summary complete resource=%s user=%s length=%d saved=%s",
            resource_id,
            user_id,
            len(summary_text),
            bool(summary_id),
        )
        return {
            "status": "completed",
            "summary_id": summary_id,
            "resource_id": resource_id,
            "resource_title": resource.title,
            "summary": summary_text,
            "key_points": key_points,
        }
