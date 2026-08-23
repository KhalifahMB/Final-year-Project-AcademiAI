from apps.common.viewsets import TenantModelViewSet
from .models import Note, Bookmark, ProgressRecord
from .serializers import NoteSerializer, BookmarkSerializer, ProgressRecordSerializer

class NoteViewSet(TenantModelViewSet):
    queryset = Note.objects.all()
    serializer_class = NoteSerializer
    search_fields = ["title", "content"]

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, user=self.request.user)

class BookmarkViewSet(TenantModelViewSet):
    queryset = Bookmark.objects.all()
    serializer_class = BookmarkSerializer

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, user=self.request.user)

class ProgressRecordViewSet(TenantModelViewSet):
    queryset = ProgressRecord.objects.all()
    serializer_class = ProgressRecordSerializer

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, user=self.request.user)
