from rest_framework.routers import DefaultRouter
from .views import (
    NoteViewSet, BookmarkViewSet, ProgressRecordViewSet,
    ResourceReadingPositionViewSet, StudySessionViewSet, ConceptInteractionViewSet,
    PlanViewSet, PlanMilestoneViewSet, PlanTaskViewSet, PlanTemplateViewSet,
)

router = DefaultRouter()
router.register("notes", NoteViewSet, basename="note")
router.register("bookmarks", BookmarkViewSet, basename="bookmark")
router.register("progress", ProgressRecordViewSet, basename="progress")
router.register(r"reading-positions", ResourceReadingPositionViewSet, basename="reading-position")
router.register(r"study-sessions", StudySessionViewSet, basename="study-session")
router.register(r"concept-interactions", ConceptInteractionViewSet, basename="concept-interaction")
router.register(r"plans", PlanViewSet, basename="plan")
router.register(r"plan-milestones", PlanMilestoneViewSet, basename="plan-milestone")
router.register(r"plan-tasks", PlanTaskViewSet, basename="plan-task")
router.register(r"plan-templates", PlanTemplateViewSet, basename="plan-template")
urlpatterns = router.urls
