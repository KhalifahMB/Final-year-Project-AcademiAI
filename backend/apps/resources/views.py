import logging

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.throttling import AiRateThrottle, UploadRateThrottle
from apps.common.viewsets import TenantModelViewSet
from apps.resources.permissions import IsOwnerOrAdminForWrite
from .models import Resource, ResourceVersion
from .serializers import ResourceSerializer, ResourceVersionSerializer
from apps.common.storage import (
    get_s3_client,
    generate_presigned_upload_post,
    generate_presigned_download_url,
)
from apps.common.security.file_validation import ALLOWED_MIME_PREFIXES
import uuid

logger = logging.getLogger(__name__)


def _content_type_allowed(content_type: str) -> bool:
    """Only offer presigns for document MIME types we can actually process."""
    ct = (content_type or "").lower()
    if not ct or ct == "application/octet-stream":
        return True  # let magic-byte validation decide at ingestion time
    return any(ct.startswith(p) for p in ALLOWED_MIME_PREFIXES)


@extend_schema(tags=["Resources"])
class ResourceViewSet(TenantModelViewSet):
    """
    Tenant-scoped resource metadata CRUD plus the upload lifecycle:

    1. POST  {id}/request_upload_url/ — obtain a presigned URL + storage key
    2. PUT   the file bytes to that URL (direct to MinIO/S3)
    3. POST  {id}/complete_upload/    — register the version and start async
       ingestion (validation → extraction → chunking → embedding)
    """

    queryset = Resource.objects.select_related(
        "uploaded_by", "course_offering", "programme", "department", "faculty"
    )
    serializer_class = ResourceSerializer
    search_fields = ["title", "description"]
    filterset_fields = ["processing_status", "visibility_scope", "course_offering"]

    def get_permissions(self):
        perms = super().get_permissions()
        write_actions = ("update", "partial_update", "destroy", "retry_processing")
        if self.action in write_actions:
            return [IsOwnerOrAdminForWrite()] + perms
        return perms

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, uploaded_by=self.request.user)
        try:
            from apps.audit.services import log_action

            log_action(
                tenant=self.request.user.tenant,
                actor=self.request.user,
                action="resource.create",
                entity_type="resource",
                entity_id=str(serializer.instance.id),
            )
        except Exception:
            logger.exception("Failed to audit resource.create")

    def perform_destroy(self, instance):
        # Capture identity before deletion — Django clears instance.pk
        # during delete.
        resource_id = str(instance.id)
        # Object storage cleanup is best-effort; metadata removal must succeed.
        if instance.storage_key:
            try:
                from apps.common.storage import delete_object

                delete_object(instance.storage_key)
            except Exception:
                logger.exception(
                    "Failed to delete stored object for resource=%s", resource_id
                )
        super().perform_destroy(instance)
        try:
            from apps.audit.services import log_action

            log_action(
                tenant=self.request.user.tenant,
                actor=self.request.user,
                action="resource.delete",
                entity_type="resource",
                entity_id=resource_id,
            )
        except Exception:
            logger.exception("Failed to audit resource.delete")

    @action(detail=True, methods=["post"], throttle_classes=[UploadRateThrottle])
    def request_upload_url(self, request, pk=None):
        """
        Obtain a presigned POST (url + form fields) bound to this resource's
        tenant partition, with a server-enforced size cap.
        """
        resource = self.get_object()
        content_type = request.data.get("content_type", "application/octet-stream")
        if not _content_type_allowed(content_type):
            return Response(
                {"success": False, "error": {"detail": f"Unsupported content type: {content_type}"}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        key = (
            f"tenants/{resource.tenant_id}/resources/{resource.id}/"
            f"{uuid.uuid4()}"
        )
        presigned = generate_presigned_upload_post(key, content_type)
        return Response(
            {
                "upload_url": presigned["url"],
                "form_fields": presigned["fields"],
                "storage_key": key,
            }
        )

    @action(detail=True, methods=["get"])
    def download_url(self, request, pk=None):
        """Short-lived signed URL for the current stored version."""
        resource = self.get_object()
        if not resource.storage_key:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_404_NOT_FOUND)
        url = generate_presigned_download_url(resource.storage_key)
        return Response({"download_url": url})

    @action(detail=True, methods=["post"], throttle_classes=[UploadRateThrottle])
    def complete_upload(self, request, pk=None):
        """
        Confirm the client uploaded to the presigned key, register a new
        version, and dispatch async ingestion.
        """
        resource = self.get_object()
        storage_key = request.data.get("storage_key")
        if not storage_key:
            return Response({"detail": "storage_key required"}, status=status.HTTP_400_BAD_REQUEST)
        # The client must present the exact key issued for THIS resource.
        # Accepting arbitrary keys would let one tenant ingest another
        # tenant's stored document.
        expected_prefix = f"tenants/{resource.tenant_id}/resources/{resource.id}/"
        if not str(storage_key).startswith(expected_prefix):
            return Response(
                {"success": False, "error": {"detail": "storage_key does not belong to this resource."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        last = resource.versions.order_by("-version_number").first()
        next_ver = (last.version_number + 1) if last else 1
        version = ResourceVersion.objects.create(
            tenant=resource.tenant,
            resource=resource,
            version_number=next_ver,
            storage_key=storage_key,
            created_by=request.user,
        )
        resource.storage_key = storage_key
        resource.processing_status = resource.ProcessingStatus.PENDING
        resource.save(update_fields=["storage_key", "processing_status", "updated_at"])
        from .tasks import process_resource_ingestion
        task = process_resource_ingestion.delay(
            str(resource.id), str(version.id), str(resource.tenant_id)
        )
        from apps.common.jobs import claim_job

        claim_job(task.id, request.user.id)
        return Response({"version_id": str(version.id), "job_id": task.id, "status": "pending"})

    @action(detail=True, methods=["post"], throttle_classes=[UploadRateThrottle])
    def retry_processing(self, request, pk=None):
        """
        Re-run the ingestion pipeline (extract → chunk → embed) for the most
        recent stored version. Available to the uploader or a tenant admin
        when processing previously failed.
        """
        resource = self.get_object()
        if resource.processing_status != Resource.ProcessingStatus.FAILED:
            return Response(
                {"success": False, "error": {"detail": "Only failed materials can be retried."}},
                status=status.HTTP_409_CONFLICT,
            )
        version = resource.versions.order_by("-version_number").first()
        if version is None:
            return Response(
                {"success": False, "error": {"detail": "No stored file to process."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        resource.processing_status = Resource.ProcessingStatus.PENDING
        resource.processing_error = ""
        resource.save(update_fields=["processing_status", "processing_error", "updated_at"])

        from .tasks import process_resource_ingestion
        task = process_resource_ingestion.delay(
            str(resource.id), str(version.id), str(resource.tenant_id)
        )
        from apps.common.jobs import claim_job

        claim_job(task.id, request.user.id)
        return Response({"job_id": task.id, "status": "pending"})

    @action(detail=True, methods=["get"])
    def preview(self, request, pk=None):
        """
        Inline preview support:
        - text-like files (txt/md/json/csv): content returned directly
          (capped at 512 KB) so the browser needs no cross-origin fetch;
        - PDFs: a short-lived signed URL suitable for <iframe> embedding.
        """
        resource = self.get_object()
        if not resource.storage_key:
            return Response(
                {"detail": "No file uploaded."}, status=status.HTTP_404_NOT_FOUND
            )

        mime = (resource.mime_type or "").lower()
        name = (resource.storage_key or "").lower()
        is_text = mime.startswith("text/") or mime == "application/json" or name.endswith(
            (".txt", ".md", ".json", ".csv")
        )
        is_pdf = "pdf" in mime or name.endswith(".pdf")

        if is_pdf:
            url = generate_presigned_download_url(resource.storage_key, expires_in=600)
            return Response({"kind": "pdf", "preview_url": url})

        if is_text:
            from django.conf import settings

            client = get_s3_client()
            obj = client.get_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=resource.storage_key
            )
            raw = obj["Body"].read(512 * 1024 + 1)
            truncated = len(raw) > 512 * 1024
            return Response(
                {
                    "kind": "text",
                    "content": raw[: 512 * 1024].decode("utf-8", errors="replace"),
                    "truncated": truncated,
                }
            )

        return Response(
            {
                "kind": "download",
                "download_url": generate_presigned_download_url(resource.storage_key),
                "detail": "Preview is not supported for this file type; download it instead.",
            }
        )

    @extend_schema(tags=["Summaries"])
    @action(detail=True, methods=["post"], throttle_classes=[AiRateThrottle])
    def summarize(self, request, pk=None):
        """
        Queue an asynchronous AI summary of this material. The requester must
        be authorized to view it under the same visibility rules as retrieval.
        Poll /jobs/{job_id}/ for the result.
        """
        resource = self.get_object()

        # Visibility authorization — same rules the RAG pipeline applies, so
        # a user cannot summarize a private material they cannot read.
        from apps.knowledge.retrieval import _authorized_resource_ids

        if resource.id not in _authorized_resource_ids(request.user, None):
            return Response(
                {"success": False, "error": {"detail": "You do not have access to this material."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        from .summary_tasks import summarize_resource_task
        task = summarize_resource_task.delay(
            str(resource.id), str(request.user.tenant_id), str(request.user.id)
        )
        from apps.common.jobs import claim_job

        claim_job(task.id, request.user.id)
        return Response({"job_id": task.id, "status": "pending"}, status=status.HTTP_202_ACCEPTED)


@extend_schema(tags=["Resource Versions"])
class ResourceVersionViewSet(TenantModelViewSet):
    """
    Version history for one resource (nested under /resources/{resource_id}/).
    Read + create only: stored files are immutable; uploading new content
    creates a new version via the resource upload lifecycle.
    """

    http_method_names = ["get", "post", "head", "options"]
    serializer_class = ResourceVersionSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ResourceVersion.objects.none()
        return (
            ResourceVersion.objects.filter(
                tenant=self.request.user.tenant,
                # Object-level authorization: the parent resource must be in
                # the caller's tenant (IDOR guard for guessed ids).
                resource__id=self.kwargs.get("resource_pk"),
            )            .select_related("created_by")
            .order_by("-version_number")
        )

    def perform_create(self, serializer):
        resource = Resource.objects.get(
            id=self.kwargs.get("resource_pk"), tenant=self.request.user.tenant
        )
        last = resource.versions.order_by("-version_number").first()
        next_ver = (last.version_number + 1) if last else 1
        serializer.save(
            tenant=self.request.user.tenant,
            resource=resource,
            version_number=next_ver,
            created_by=self.request.user,
        )
