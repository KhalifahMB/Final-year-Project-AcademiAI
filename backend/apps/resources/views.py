from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.common.viewsets import TenantModelViewSet
from .models import Resource, ResourceVersion
from .serializers import ResourceSerializer, ResourceVersionSerializer
from apps.common.storage import generate_presigned_upload_url, generate_presigned_download_url
import uuid

class ResourceViewSet(TenantModelViewSet):
    queryset = Resource.objects.all()
    serializer_class = ResourceSerializer
    search_fields = ["title", "description"]
    filterset_fields = ["processing_status", "visibility_scope", "course_offering"]

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, uploaded_by=self.request.user)

    @action(detail=True, methods=["post"])
    def request_upload_url(self, request, pk=None):
        resource = self.get_object()
        content_type = request.data.get("content_type", "application/octet-stream")
        key = f"tenants/{resource.tenant_id}/resources/{resource.id}/{uuid.uuid4()}"
        url = generate_presigned_upload_url(key, content_type)
        return Response({"upload_url": url, "storage_key": key})

    @action(detail=True, methods=["get"])
    def download_url(self, request, pk=None):
        resource = self.get_object()
        if not resource.storage_key:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_404_NOT_FOUND)
        url = generate_presigned_download_url(resource.storage_key)
        return Response({"download_url": url})

    @action(detail=True, methods=["post"])
    def complete_upload(self, request, pk=None):
        """Mark version + kick off ingestion after client PUT to presigned URL."""
        resource = self.get_object()
        storage_key = request.data.get("storage_key")
        if not storage_key:
            return Response({"detail": "storage_key required"}, status=status.HTTP_400_BAD_REQUEST)
        from .models import ResourceVersion
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
        task = process_resource_ingestion.delay(str(resource.id), str(version.id))
        return Response({"version_id": str(version.id), "job_id": task.id, "status": "pending"})
