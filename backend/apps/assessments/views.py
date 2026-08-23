from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.viewsets import TenantModelViewSet
from apps.common.permissions import IsTenantMember, IsLecturerOrAdmin

from .models import Quiz, QuizQuestion, QuizAttempt
from .serializers import (
    QuizSerializer, QuizQuestionSerializer, QuizAttemptSerializer,
    QuizGenerateSerializer, QuizSubmitSerializer,
)


class QuizViewSet(TenantModelViewSet):
    queryset = Quiz.objects.prefetch_related("questions").all()
    serializer_class = QuizSerializer
    filterset_fields = ["status", "course_offering"]

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, created_by=self.request.user)

    @action(detail=False, methods=["post"], permission_classes=[IsLecturerOrAdmin])
    def generate(self, request):
        ser = QuizGenerateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        from .tasks import generate_quiz_task
        task = generate_quiz_task.delay(
            str(request.user.id),
            str(request.user.tenant_id),
            ser.validated_data,
        )
        return Response(
            {"success": True, "job_id": task.id, "status": "pending"},
            status=status.HTTP_202_ACCEPTED,
        )


class QuizQuestionViewSet(TenantModelViewSet):
    queryset = QuizQuestion.objects.all()
    serializer_class = QuizQuestionSerializer
    filterset_fields = ["quiz"]


class QuizAttemptViewSet(TenantModelViewSet):
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
        serializer.save(
            tenant=self.request.user.tenant,
            student=self.request.user,
        )

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        attempt = self.get_object()
        if attempt.student_id != request.user.id:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        if attempt.submitted_at:
            return Response({"detail": "Already submitted"}, status=status.HTTP_409_CONFLICT)
        ser = QuizSubmitSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        answers = ser.validated_data["answers"]
        questions = {str(q.id): q for q in attempt.quiz.questions.all()}
        correct = 0
        total = len(questions) or 1
        for qid, q in questions.items():
            user_ans = answers.get(qid)
            ca = q.correct_answer or {}
            if user_ans == ca or user_ans == ca.get("index") or user_ans == ca.get("value"):
                correct += 1
        score = round(100.0 * correct / total, 2)
        attempt.answers = answers
        attempt.score = score
        attempt.submitted_at = timezone.now()
        attempt.save(update_fields=["answers", "score", "submitted_at"])
        return Response(QuizAttemptSerializer(attempt).data)
