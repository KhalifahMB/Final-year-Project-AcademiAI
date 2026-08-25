from rest_framework.routers import DefaultRouter
from .views import NoteViewSet, BookmarkViewSet, ProgressRecordViewSet

router = DefaultRouter()
router.register("notes", NoteViewSet, basename="note")
router.register("bookmarks", BookmarkViewSet, basename="bookmark")
router.register("progress", ProgressRecordViewSet, basename="progress")
urlpatterns = router.urls
