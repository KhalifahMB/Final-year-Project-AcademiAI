"""
Upload lifecycle + ownership-aware delete for resources — view-free.

Owns the pure business logic referenced in docs/AUDIT_REPORT.md #11:
presigned key issuance, race-free version registration, retry reset,
text preview reads, and the detach-vs-delete decision. Views handle
nothing but HTTP framing.
"""
import logging
import uuid

from django.conf import settings
from django.db import transaction

from apps.common.constants import RESOURCE_TEXT_PEEK_BYTES
from apps.common.jobs import claim_job
from apps.common.security.file_validation import ALLOWED_MIME_PREFIXES
from apps.common.storage import (
    delete_object,
    generate_presigned_upload_post,
    get_s3_client,
)
from apps.learning.models import Bookmark
from apps.resources.models import Resource, ResourceVersion
from apps.resources.tasks import process_resource_ingestion

logger = logging.getLogger(__name__)


class UploadServiceError(Exception):
    """Expected business-rule failure carrying an HTTP status for the view."""

    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def content_type_allowed(content_type: str) -> bool:
    """Only offer presigns for document MIME types we can actually process."""
    ct = (content_type or "").lower()
    if not ct or ct == "application/octet-stream":
        return True  # let magic-byte validation decide at ingestion time
    return any(ct.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES)


def issue_upload_envelope(resource, content_type="application/octet-stream"):
    """
    Presigned upload target (url + form fields) bound to this resource's
    tenant partition, with a server-enforced size cap. Persists the declared
    content type (storage keys are extension-less UUIDs, so preview/
    ingestion later classify from this field). Returns the response-shaped
    dict the client needs to PUT the file directly to storage.
    """
    if not content_type_allowed(content_type):
        raise UploadServiceError(f"Unsupported content type: {content_type}")
    key = f"tenants/{resource.tenant_id}/resources/{resource.id}/{uuid.uuid4()}"
    if content_type and content_type != "application/octet-stream":
        resource.mime_type = content_type
        resource.save(update_fields=["mime_type", "updated_at"])
    presigned = generate_presigned_upload_post(key, content_type)
    return {
        "upload_url": presigned["url"],
        "form_fields": presigned["fields"],
        "storage_key": key,
    }


def register_completed_upload(resource, storage_key, declared_ct, user):
    """
    Register a new version for the uploaded key and dispatch async ingestion.

    Atomic + row-locked so concurrent complete_upload calls cannot race on
    version numbering. The client must present the exact key issued for THIS
    resource — accepting arbitrary keys would let one tenant ingest another
    tenant's stored document. Arbitrary client content types are rejected.
    """
    if not storage_key:
        raise UploadServiceError("storage_key required")
    expected_prefix = f"tenants/{resource.tenant_id}/resources/{resource.id}/"
    if not str(storage_key).startswith(expected_prefix):
        raise UploadServiceError("storage_key does not belong to this resource.")
    declared_ct = declared_ct or ""
    if (
        declared_ct
        and declared_ct != "application/octet-stream"
        and not content_type_allowed(declared_ct)
    ):
        raise UploadServiceError(f"Unsupported content type: {declared_ct}")

    with transaction.atomic():
        locked = type(resource).objects.select_for_update().get(pk=resource.pk)
        last = locked.versions.order_by("-version_number").first()
        next_ver = (last.version_number + 1) if last else 1
        if declared_ct and declared_ct != "application/octet-stream":
            locked.mime_type = declared_ct
        version = ResourceVersion.objects.create(
            tenant=locked.tenant,
            resource=locked,
            version_number=next_ver,
            storage_key=storage_key,
            created_by=user,
        )
        locked.storage_key = storage_key
        locked.processing_status = locked.ProcessingStatus.PENDING
        locked.save(update_fields=["storage_key", "processing_status", "mime_type", "updated_at"])

    task = process_resource_ingestion.delay(
        str(locked.id), str(version.id), str(locked.tenant_id)
    )
    claim_job(task.id, user.id)
    return {"version_id": str(version.id), "job_id": task.id, "status": "pending"}


def reset_for_retry(resource, user):
    """
    Re-run the ingestion pipeline for a material that previously failed.
    Only FAILED materials can change back to PENDING via this path.
    """
    if resource.processing_status != Resource.ProcessingStatus.FAILED:
        raise UploadServiceError("Only failed materials can be retried.", status=409)
    version = resource.versions.order_by("-version_number").first()
    if version is None:
        raise UploadServiceError("No stored file to process.")
    resource.processing_status = Resource.ProcessingStatus.PENDING
    resource.processing_error = ""
    resource.save(update_fields=["processing_status", "processing_error", "updated_at"])

    task = process_resource_ingestion.delay(
        str(resource.id), str(version.id), str(resource.tenant_id)
    )
    claim_job(task.id, user.id)
    return {"job_id": task.id, "status": "pending"}


def detach_or_delete(resource, user) -> str:
    """
    Ownership-aware delete: if anyone else bookmarks an in-scope resource,
    detach the owner and hide it from listings (make it private); otherwise
    purge the stored object and the row.

    Atomic + race-free: two concurrent deleters could otherwise both read
    ``has_other_bookmarks`` and double-delete or double-detach.

    Returns the audit action ("resource.detach" | "resource.delete") so the
    view can record it without re-deriving the branch.
    """
    with transaction.atomic():
        locked = Resource.objects.select_for_update().get(pk=resource.pk)
        has_other_bookmarks = Bookmark.objects.filter(
            resource=locked
        ).exclude(user=user).exists()

        if has_other_bookmarks and locked.visibility_scope != Resource.Visibility.PRIVATE:
            # Detach the owner and hide it from listings by making it private.
            # Bookmarkers will still be able to access it because it's their
            # bookmark, though they won't find it in general search.
            locked.uploaded_by = None
            locked.visibility_scope = Resource.Visibility.PRIVATE
            locked.save(update_fields=["uploaded_by", "visibility_scope", "updated_at"])
            return "resource.detach"

        # Object storage cleanup is best-effort; metadata removal must succeed.
        if locked.storage_key:
            try:
                delete_object(locked.storage_key)
            except Exception:
                logger.exception(
                    "Failed to delete stored object for resource=%s", locked.pk
                )
        locked.delete()
        return "resource.delete"


def peek_text_content(resource):
    """Read the stored text-like object for inline preview (512 KB cap)."""
    client = get_s3_client()
    obj = client.get_object(
        Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=resource.storage_key
    )
    raw = obj["Body"].read(RESOURCE_TEXT_PEEK_BYTES + 1)
    truncated = len(raw) > RESOURCE_TEXT_PEEK_BYTES
    return raw[:RESOURCE_TEXT_PEEK_BYTES].decode("utf-8", errors="replace"), truncated


__all__ = [
    "UploadServiceError",
    "content_type_allowed",
    "issue_upload_envelope",
    "register_completed_upload",
    "reset_for_retry",
    "detach_or_delete",
    "peek_text_content",
]