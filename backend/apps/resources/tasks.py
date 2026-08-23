"""
Document ingestion pipeline (queue: ingestion).
Upload already stored in object storage; this processes text → chunks → embeddings.
"""
import logging
import re
from celery import shared_task
from django.db import transaction

logger = logging.getLogger(__name__)


def _simple_chunk(text: str, max_chars: int = 1200, overlap: int = 150) -> list[str]:
    text = re.sub(r"\s+", " ", text or "").strip()
    if not text:
        return []
    chunks = []
    i = 0
    while i < len(text):
        chunks.append(text[i : i + max_chars])
        i += max_chars - overlap
    return chunks


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_resource_ingestion(self, resource_id: str, version_id: str):
    from apps.resources.models import Resource, ResourceVersion, ResourceChunk
    from apps.common.ai import generate_embeddings
    from apps.common.storage import get_s3_client
    from django.conf import settings

    try:
        resource = Resource.objects.get(id=resource_id)
        version = ResourceVersion.objects.get(id=version_id, resource=resource)
    except (Resource.DoesNotExist, ResourceVersion.DoesNotExist):
        return {"status": "failed", "error": "not found"}

    resource.processing_status = Resource.ProcessingStatus.PROCESSING
    resource.processing_error = ""
    resource.save(update_fields=["processing_status", "processing_error", "updated_at"])

    try:
        # Fetch object bytes (text-like files for MVP)
        client = get_s3_client()
        obj = client.get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=version.storage_key)
        raw = obj["Body"].read()
        try:
            text = raw.decode("utf-8", errors="ignore")
        except Exception:
            text = ""

        # Malware scan hook placeholder — extend with ClamAV etc.
        if not text.strip():
            raise ValueError("No extractable text (binary/OCR not enabled in this phase)")

        parts = _simple_chunk(text)
        embeddings = generate_embeddings(parts)

        with transaction.atomic():
            ResourceChunk.objects.filter(resource_version=version).delete()
            for idx, (content, emb) in enumerate(zip(parts, embeddings)):
                ResourceChunk.objects.create(
                    tenant_id=resource.tenant_id,
                    resource_version=version,
                    chunk_index=idx,
                    content=content,
                    embedding=emb,
                    token_count=len(content.split()),
                    metadata={},
                )
            resource.storage_key = version.storage_key
            resource.processing_status = Resource.ProcessingStatus.READY
            resource.save(update_fields=["storage_key", "processing_status", "updated_at"])

        logger.info("Ingestion complete resource=%s chunks=%s", resource_id, len(parts))
        return {"status": "completed", "chunks": len(parts)}
    except Exception as exc:
        logger.exception("Ingestion failed resource=%s", resource_id)
        resource.processing_status = Resource.ProcessingStatus.FAILED
        resource.processing_error = str(exc)[:2000]
        resource.save(update_fields=["processing_status", "processing_error", "updated_at"])
        raise self.retry(exc=exc)
