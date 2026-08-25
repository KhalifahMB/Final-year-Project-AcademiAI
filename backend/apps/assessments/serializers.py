from rest_framework import serializers
from .models import Quiz, QuizQuestion, QuizAttempt


def _validate_tenant_quiz(quiz, request):
    """Quiz must exist inside the requester's tenant (IDOR guard)."""
    if quiz is None:
        raise serializers.ValidationError("quiz is required.")
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "tenant_id", None) != quiz.tenant_id:
        raise serializers.ValidationError("Unknown quiz.")


class QuizQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizQuestion
        fields = (
            "id", "quiz", "question_text", "question_type", "options",
            "correct_answer", "explanation", "order_index",
        )
        read_only_fields = ("id",)

    def validate_quiz(self, quiz):
        _validate_tenant_quiz(quiz, self.context.get("request"))
        return quiz

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        # Hide correct answers from students until after attempt (simplified: hide for students always on list)
        user = getattr(request, "user", None)
        if user and getattr(user, "role", None) == "student":
            data.pop("correct_answer", None)
            data.pop("explanation", None)
        return data


class QuizSerializer(serializers.ModelSerializer):
    questions = QuizQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Quiz
        fields = (
            "id", "title", "description", "status", "course_offering",
            "created_by", "generation_job_id", "questions", "tenant", "created_at",
        )
        read_only_fields = ("id", "created_by", "generation_job_id", "tenant", "created_at")


class QuizAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizAttempt
        fields = (
            "id", "quiz", "student", "score", "answers", "started_at", "submitted_at", "tenant",
        )
        read_only_fields = ("id", "student", "score", "answers", "started_at", "submitted_at", "tenant")

    def validate_quiz(self, quiz):
        _validate_tenant_quiz(quiz, self.context.get("request"))
        return quiz


class QuizGenerateSerializer(serializers.Serializer):
    course_offering_id = serializers.UUIDField(required=False, allow_null=True)
    resource_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True
    )
    num_questions = serializers.IntegerField(min_value=1, max_value=20, default=5)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)


class QuizSubmitSerializer(serializers.Serializer):
    answers = serializers.DictField(child=serializers.JSONField())
