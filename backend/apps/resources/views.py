import logging

from django.db import models
from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.throttling import AiRateThrottle, UploadRateThrottle
from apps.common.viewsets import TenantModelViewSet
from apps.resources.permissions import IsOwnerOrAdminForWrite
from .models import Resource, ResourceVersion, ResourceSummary
from .serializers import (
    ResourceSerializer,
    ResourceVersionSerializer,
    ResourceSummarySerializer,
)
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


_IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".gif", ".webp")
_TEXT_EXTS = (".txt", ".md", ".markdown", ".json", ".csv", ".log")

_IMAGE_MIMES = ("image/",)


def _preview_kind(resource) -> str:
    """
    Classify a stored file for preview: 'pdf' | 'image' | 'text' | 'other'.

    Signals, in order: stored mime_type, title/filename extension, then a
    magic-byte sniff of the object's first bytes (covers resources uploaded
    before mime_type was persisted, where keys are extension-less UUIDs).
    """
    mime = (resource.mime_type or "").lower()
    title = (resource.title or "").lower()
    key = (resource.storage_key or "").lower()

    def by_mime(m):
        if "pdf" in m:
            return "pdf"
        if m.startswith(_IMAGE_MIMES):
            return "image"
        if m.startswith("text/") or m in ("application/json",):
            return "text"
        return None

    def by_ext(name):
        if name.endswith(".pdf"):
            return "pdf"
        if name.endswith(_IMAGE_EXTS):
            return "image"
        if name.endswith(_TEXT_EXTS):
            return "text"
        return None

    kind = by_mime(mime) or by_ext(title) or by_ext(key)
    if kind:
        return kind

    # Last resort: sniff the first bytes straight from storage.
    try:
        from django.conf import settings

        client = get_s3_client()
        obj = client.get_object(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
            Key=resource.storage_key,
            Range="bytes=0-15",
        )
        head = obj["Body"].read(16)
    except Exception:
        logger.exception("Preview sniff failed resource=%s", resource.id)
        return "other"

    if head[:4] == b"%PDF" or head[:5] == b"%PDF-":
        return "pdf"
    if (
        head[:8] == b"\x89PNG\r\n\x1a\n"
        or head[:3] == b"\xff\xd8\xff"
        or head[:3] in (b"GIF87a", b"GIF89a")
        or (head[:4] == b"RIFF" and head[8:12] == b"WEBP")
    ):
        return "image"
    try:
        head.decode("utf-8")
        return "text"
    except UnicodeDecodeError:
        return "other"


def _authorized_resources_q(user) -> Q:
    """
    Visibility filter for LIST endpoints — same scope semantics as the RAG
    pipeline (apps.knowledge.retrieval): institution-wide for everyone,
    course-scoped to enrolled students / assigned lecturers, programme /
    department / faculty scopes via the viewer's academic profile.

    Private materials are visible ONLY to their uploader, for every role —
    including tenant admins and platform superusers. Admins retain broad
    visibility over all non-private scopes in the tenant, but never over
    another user's private resources.
    """
    from apps.academics.models import CourseEnrollment, LecturerCourseAssignment
    from apps.knowledge.retrieval import _viewer_academic_context

    role = getattr(user, "role", None)
    is_admin = role == "admin" or bool(getattr(user, "is_superuser", False))

    # The scope the user may read from, ignoring private visibility for a
    # moment. Admins can read everything non-private in the tenant; students /
    # lecturers are limited to their academic scope (whose clauses already
    # require a non-private visibility value, so they never match private).
    if is_admin:
        scope = ~Q(visibility_scope=Resource.Visibility.PRIVATE)
    else:
        base = Q(visibility_scope=Resource.Visibility.INSTITUTION)

        allowed_offerings = set()
        if role == "student":
            allowed_offerings = set(
                CourseEnrollment.objects.filter(
                    student=user, status=CourseEnrollment.Status.ENROLLED
                ).values_list("course_offering_id", flat=True)
            )
        elif role == "lecturer":
            allowed_offerings = set(
                LecturerCourseAssignment.objects.filter(lecturer=user).values_list(
                    "course_offering_id", flat=True
                )
            )

        scope = (
            base
            | Q(
                visibility_scope=Resource.Visibility.COURSE,
                course_offering_id__in=allowed_offerings,
            )
            # A course-scoped material without an offering would otherwise be
            # invisible to everyone — the uploader can always see their own.
            | Q(
                visibility_scope=Resource.Visibility.COURSE,
                course_offering__isnull=True,
                uploaded_by=user,
            )
        )
        programme_id, department_id, faculty_id = _viewer_academic_context(user)
        if programme_id:
            scope |= Q(
                visibility_scope=Resource.Visibility.PROGRAMME,
                programme_id=programme_id,
            )
        if department_id:
            scope |= Q(
                visibility_scope=Resource.Visibility.DEPARTMENT,
                department_id=department_id,
            )
        if faculty_id:
            scope |= Q(
                visibility_scope=Resource.Visibility.FACULTY,
                faculty_id=faculty_id,
            )

    # Universal rule: a private resource is visible only to its uploader,
    # regardless of role. `scope` never matches a private resource, so OR-ing
    # the owner's own private materials is both necessary and sufficient.
    return scope | Q(
        visibility_scope=Resource.Visibility.PRIVATE, uploaded_by=user
    )


@extend_schema(tags=["Resources"])
class ResourceViewSet(TenantModelViewSet):
    """
    Tenant-scoped resource metadata CRUD plus the upload lifecycle:

    1. POST  {id}/request_upload_url/ — obtain a presigned URL + storage key
    2. PUT   the file bytes to that URL (direct to MinIO/S3)
    3. POST  {id}/complete_upload/    — register the version and start async
       ingestion (validation → extraction → chunking → embedding)

    Authorization-first visibility: students/lecturers only ever see (list
    AND retrieve) materials their academic scope allows — private materials
    of other users are invisible even by direct id. Admins see the whole
    tenant; platform superusers likewise. `?scope=authorized` is accepted
    for backwards compatibility and is now the default behaviour.
    """
    queryset = Resource.objects.select_related(
        "uploaded_by", "course_offering", "programme", "department", "faculty"
    ).prefetch_related(
        # Prefetch only the latest summary per resource so list/detail don't
        # N+1 when serializing `latest_summary`. A sliced Prefetch with
        # `to_attr` returns a list (0 or 1 items); the serializer unwraps it.
        models.Prefetch(
            "summaries",
            queryset=ResourceSummary.objects.select_related("created_by")
            .order_by("-created_at")[:1],
            to_attr="prefetched_latest_summary",
        )
    )
    serializer_class = ResourceSerializer
    search_fields = ["title", "description"]
    filterset_fields = ["processing_status", "visibility_scope", "course_offering"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Defense in depth: RLS scopes the tenant, this scopes visibility
        # within it. Applied to list AND detail (get_object) alike. Private
        # resources are owner-only for every role (admins included).
        return qs.filter(_authorized_resources_q(user))

    def get_permissions(self):
        perms = super().get_permissions()
        # Actions that mutate a resource or issue privileged artifacts
        # (presigned upload URLs, version creation, retries, summary
        # generation is read-ish but rate-limited and auth-gated below).
        write_actions = (
            "update", "partial_update", "destroy", "retry_processing",
            "request_upload_url", "complete_upload",
        )
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
        tenant = self.request.user.tenant

        # If anyone else has bookmarked this, keep it available for them
        from apps.learning.models import Bookmark
        has_other_bookmarks = Bookmark.objects.filter(
            resource=instance
        ).exclude(user=self.request.user).exists()

        if has_other_bookmarks and instance.visibility_scope != Resource.Visibility.PRIVATE:
            # Detach the owner and hide it from listings by making it private.
            # Bookmarkers will still be able to access it because it's their bookmark,
            # though they won't find it in general search.
            instance.uploaded_by = None
            instance.visibility_scope = Resource.Visibility.PRIVATE
            instance.save(update_fields=["uploaded_by", "visibility_scope", "updated_at"])
            action = "resource.detach"
        else:
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
            action = "resource.delete"

        try:
            from apps.audit.services import log_action

            log_action(
                tenant=tenant,
                actor=self.request.user,
                action=action,
                entity_type="resource",
                entity_id=resource_id,
            )
        except Exception:
            logger.exception("Failed to audit %s", action)

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
        # Remember the declared type so preview/ingestion can classify the
        # file later (storage keys are extension-less UUIDs).
        if content_type and content_type != "application/octet-stream":
            resource.mime_type = content_type
            resource.save(update_fields=["mime_type", "updated_at"])
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
        # The presign flow may have recorded the declared content type; allow
        # the completion call to (re)state it for clients that skipped that.
        declared_ct = request.data.get("content_type")
        if declared_ct and declared_ct != "application/octet-stream":
            resource.mime_type = declared_ct
        version = ResourceVersion.objects.create(
            tenant=resource.tenant,
            resource=resource,
            version_number=next_ver,
            storage_key=storage_key,
            created_by=request.user,
        )
        resource.storage_key = storage_key
        resource.processing_status = resource.ProcessingStatus.PENDING
        resource.save(update_fields=["storage_key", "processing_status", "mime_type", "updated_at"])
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
        - PDFs and images: a short-lived signed URL suitable for
          <iframe>/<img> embedding;
        - text-like files (txt/md/json/csv): content returned directly
          (capped at 512 KB) so the browser needs no cross-origin fetch;
        - anything else: a signed download URL.

        Type detection is defensive: stored mime_type first, then the
        original filename/title extension, then magic bytes — storage keys
        are extension-less UUIDs, so title/mime are the practical signals.
        """
        resource = self.get_object()
        if not resource.storage_key:
            return Response(
                {"detail": "No file uploaded."}, status=status.HTTP_404_NOT_FOUND
            )

        kind = _preview_kind(resource)

        if kind in ("pdf", "image"):
            url = generate_presigned_download_url(resource.storage_key, expires_in=600)
            return Response(
                {
                    "kind": kind,
                    "preview_url": url,
                    "mime_type": resource.mime_type or "",
                }
            )

        if kind == "text":
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

        if not resource.has_extractable_text:
            return Response(
                {"success": False, "error": {"detail": "This material has no extractable text and cannot be summarized. It may contain images or binary content."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if resource.processing_status != Resource.ProcessingStatus.READY:
            return Response(
                {"success": False, "error": {"detail": "Material is still being processed."}},
                status=status.HTTP_409_CONFLICT,
            )

        # Visibility authorization
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

    @extend_schema(tags=["Summaries"], responses=ResourceSummarySerializer(many=True))
    @action(detail=True, methods=["get"])
    def summaries(self, request, pk=None):
        """List saved AI summaries for this resource (most recent first).

        Any user authorized to view the resource can read its summaries.
        """
        resource = self.get_object()
        qs = (
            ResourceSummary.objects.filter(tenant=request.user.tenant, resource=resource)
            .select_related("created_by")
            .order_by("-created_at")
        )
        page = self.paginate_queryset(qs)
        ser = ResourceSummarySerializer(page if page is not None else qs, many=True)
        if page is not None:
            return self.get_paginated_response(ser.data)
        return Response(ser.data)

    @extend_schema(tags=["Summaries"])
    @action(
        detail=True,
        methods=["delete"],
        url_path="summaries/(?P<summary_id>[^/.]+)",
    )
    def delete_summary(self, request, pk=None, summary_id=None):
        """Delete a saved summary. Only the creator or an admin can delete."""
        resource = self.get_object()
        summary = ResourceSummary.objects.filter(
            tenant=request.user.tenant, resource=resource, id=summary_id
        ).first()
        if summary is None:
            return Response(
                {"success": False, "error": {"detail": "Summary not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        is_creator = summary.created_by_id == request.user.id
        is_admin = getattr(request.user, "is_superuser", False) or getattr(
            request.user, "role", None
        ) == "admin"
        if not (is_creator or is_admin):
            return Response(
                {"success": False, "error": {"detail": "You cannot delete this summary."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        summary.delete()
        return Response({"success": True}, status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Resource Versions"])
class ResourceVersionViewSet(TenantModelViewSet):
    """
    Version history for one resource (nested under /resources/{resource_id}/).
    Read + create only: stored files are immutable; uploading new content
    creates a new version via the resource upload lifecycle.
    """

    http_method_names = ["get", "post", "head", "options"]
    serializer_class = ResourceVersionSerializer

    def _parent_resource(self):
        from django.shortcuts import get_object_or_404
        return get_object_or_404(
            Resource.objects.filter(
                _authorized_resources_q(self.request.user)
                if not (getattr(self.request.user, "is_superuser", False)
                        or getattr(self.request.user, "role", None) == "admin")
                else Q(),
                tenant=self.request.user.tenant,
            ),
            id=self.kwargs.get("resource_pk"),
        )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ResourceVersion.objects.none()
        user = self.request.user
        qs = ResourceVersion.objects.filter(
            tenant=user.tenant,
            resource__id=self.kwargs.get("resource_pk"),
        ).select_related("created_by")
        # The parent resource must also be visible to the caller — a private
        # material's version history is not world-readable (admins included).
        visible = Resource.objects.filter(
            _authorized_resources_q(user)
        ).values("id")
        qs = qs.filter(resource__in=visible)
        return qs.order_by("-version_number")

    def perform_create(self, serializer):
        # Only the uploader or a tenant admin may add a new version. This
        # blocks students/other lecturers from uploading to someone else's
        # resource even if they can see it (e.g. COURSE/INSTITUTION scoped).
        resource = self._parent_resource()
        user = self.request.user
        is_owner = resource.uploaded_by_id == user.id
        is_admin = getattr(user, "role", None) == "admin" or getattr(user, "is_superuser", False)
        if not (is_owner or is_admin):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only the uploader or an admin may add a new version.")
        last = resource.versions.order_by("-version_number").first()
        next_ver = (last.version_number + 1) if last else 1
        serializer.save(
            tenant=self.request.user.tenant,
            resource=resource,
            version_number=next_ver,
            created_by=self.request.user,
        )
