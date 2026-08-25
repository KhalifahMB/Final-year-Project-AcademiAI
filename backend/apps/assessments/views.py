from django.core.exceptions import PermissionDenied
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.throttling import AiRateThrottle
from apps.common.viewsets import TenantModelViewSet
from apps.common.permissions import IsLecturerOrAdmin
from .models import Quiz, QuizQuestion, QuizAttempt
from .serializers import (
    QuizSerializer, QuizQuestionSerializer, QuizAttemptSerializer,
    QuizGenerateSerializer, QuizSubmitSerializer,
)


@extend_schema(tags=["Quizzes"])
class QuizViewSet(TenantModelViewSet):
    """
    Quiz CRUD plus AI generation. Authoring (create/update/delete) is
    restricted to lecturers/admins; every tenant member may read published
    quizzes and use the AI generator.
    """

    queryset = Quiz.objects.prefetch_related("questions").all()
    serializer_class = QuizSerializer
    filterset_fields = ["status", "course_offering"]

    def get_permissions(self):
        perms = super().get_permissions()
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsLecturerOrAdmin()] + perms
        return perms

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, created_by=self.request.user)

    @extend_schema(
        tags=["Quizzes"],
        request=QuizGenerateSerializer,
        responses={202: None},
        summary="Queue AI quiz generation from your authorized materials",
        description=(
            "Available to every authenticated tenant member. Generation runs "
            "asynchronously against materials the requester is allowed to "
            "read; poll /jobs/{job_id}/ for the resulting quiz id."
        ),
    )
    @action(
        detail=False,
        methods=["post"],
        throttle_classes=[AiRateThrottle],
    )
    def generate(self, request):
        ser = QuizGenerateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        from .tasks import generate_quiz_task
        task = generate_quiz_task.delay(
            str(request.user.id),
            str(request.user.tenant_id),
            ser.validated_data,
        )
        from apps.common.jobs import claim_job

        claim_job(task.id, request.user.id)
        return Response(
            {"success": True, "job_id": task.id, "status": "pending"},
            status=status.HTTP_202_ACCEPTED,
        )


@extend_schema(tags=["Quiz Questions"])
class QuizQuestionViewSet(TenantModelViewSet):
    """
    Question bank for quizzes. Authoring is restricted to lecturers/admins;
    students may only read the questions of quizzes they can attempt
    (correct answers/explanations are stripped by the serializer).
    """

    queryset = QuizQuestion.objects.select_related("quiz")
    serializer_class = QuizQuestionSerializer
    filterset_fields = ["quiz"]

    def get_permissions(self):
        perms = super().get_permissions()
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsLecturerOrAdmin()] + perms
        return perms


@extend_schema(tags=["Quiz Attempts"])
class QuizAttemptViewSet(TenantModelViewSet):
    """
    Start and submit quiz attempts. Students see only their own attempts;
    lecturers/admins see all attempts in the tenant. Submission scores the
    attempt server-side and cannot be repeated.
    """

    queryset = QuizAttempt.objects.all()
    serializer_class = QuizAttemptSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "student":
            return qs.filter(student=user)
        return qs

    def perform_create(self, serializer):
        # Attempts belong to the requesting student. Staff accounts do not
        # sit quizzes; they author them. Drafts/archived quizzes cannot be
        # started — only published ones.
        user = self.request.user
        if user.role != "student":
            raise PermissionDenied("Only students can start quiz attempts.")
        quiz_id = serializer.validated_data.get("quiz")
        if quiz_id is None or quiz_id.status != Quiz.Status.PUBLISHED:
            raise PermissionDenied("This quiz is not open for attempts.")
        serializer.save(
            tenant=user.tenant,
            student=user,
        )

    @extend_schema(tags=["Quiz Attempts"], request=QuizSubmitSerializer)
    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """Submit answers; scores are computed server-side and are final."""
        attempt = self.get_object()
        if attempt.student_id != request.user.id:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        if attempt.submitted_at:
            return Response({"detail": "Already submitted"}, status=status.HTTP_409_CONFLICT)
        ser = QuizSubmitSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        answers = ser.validated_data["answers"]

        def _norm(value):
            # Text answers are compared case-insensitively; non-string
            # answers (option indexes) compare as-is.
            return value.strip().lower() if isinstance(value, str) else value

        questions = {str(q.id): q for q in attempt.quiz.questions.all()}
        correct = 0
        total = len(questions) or 1
        for qid, q in questions.items():
            user_ans = answers.get(qid)
            ca = q.correct_answer or {}
            if (
                user_ans == ca
                or _norm(user_ans) == _norm(ca.get("index"))
                or _norm(user_ans) == _norm(ca.get("value"))
            ):
                correct += 1
        score = round(100.0 * correct / total, 2)
        attempt.answers = answers
        attempt.score = score
        attempt.submitted_at = timezone.now()
        attempt.save(update_fields=["answers", "score", "submitted_at"])
        return Response(QuizAttemptSerializer(attempt).data)