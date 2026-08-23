from rest_framework.routers import DefaultRouter
from .views import QuizViewSet, QuizQuestionViewSet, QuizAttemptViewSet

router = DefaultRouter()
router.register("quizzes", QuizViewSet, basename="quiz")
router.register("quiz-questions", QuizQuestionViewSet, basename="quiz-question")
router.register("quiz-attempts", QuizAttemptViewSet, basename="quiz-attempt")
urlpatterns = router.urls
