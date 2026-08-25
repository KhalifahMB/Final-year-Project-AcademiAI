from drf_spectacular.utils import extend_schema

from apps.common.viewsets import TenantModelViewSet
from .models import Note, Bookmark, ProgressRecord
from .serializers import NoteSerializer, BookmarkSerializer, ProgressRecordSerializer


@extend_schema(tags=["Notes"])
class NoteViewSet(TenantModelViewSet):
    queryset = Note.objects.select_related("resource")
    serializer_class = NoteSerializer
    search_fields = ["title", "content"]

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, user=self.request.user)


@extend_schema(tags=["Bookmarks"])
class BookmarkViewSet(TenantModelViewSet):
    queryset = Bookmark.objects.select_related("resource")
    serializer_class = BookmarkSerializer
    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, user=self.request.user)


@extend_schema(tags=["Progress"])
class ProgressRecordViewSet(TenantModelViewSet):
    queryset = ProgressRecord.objects.select_related("concept")
    serializer_class = ProgressRecordSerializer

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, user=self.request.user)
