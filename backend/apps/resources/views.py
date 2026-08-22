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
