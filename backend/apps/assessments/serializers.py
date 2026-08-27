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
        # Hide correct answers from students unless they are reviewing a
        # submitted attempt of their own (set via context key
        # `reveal_answers=True`).
        user = getattr(request, "user", None) if request else None
        is_staff = bool(
            user
            and (
                getattr(user, "is_superuser", False)
                or getattr(user, "role", None) in ("admin", "lecturer")
            )
        )
        if not is_staff and not self.context.get("reveal_answers", False):
            data.pop("correct_answer", None)
            data.pop("explanation", None)
        return data


class QuizSerializer(serializers.ModelSerializer):
    questions = QuizQuestionSerializer(many=True, read_only=True)
    attempt_count = serializers.SerializerMethodField()
    best_score = serializers.SerializerMethodField()
    last_attempt_at = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = (
            "id", "title", "description", "status", "course_offering",
            "created_by", "generation_job_id", "questions", "tenant",
            "created_at", "attempt_count", "best_score", "last_attempt_at",
        )
        read_only_fields = (
            "id", "created_by", "generation_job_id", "tenant",
            "created_at", "attempt_count", "best_score", "last_attempt_at",
        )

    def _viewer(self):
        return getattr(self.context.get("request"), "user", None)

    def get_attempt_count(self, obj):
        user = self._viewer()
        if not user or getattr(user, "role", None) != "student":
            return None
        return obj.attempts.filter(student=user).count()

    def get_best_score(self, obj):
        user = self._viewer()
        if not user or getattr(user, "role", None) != "student":
            return None
        return (
            obj.attempts.filter(student=user, submitted_at__isnull=False)
            .order_by("-score")
            .values_list("score", flat=True)
            .first()
        )

    def get_last_attempt_at(self, obj):
        user = self._viewer()
        if not user or getattr(user, "role", None) != "student":
            return None
        last = (
            obj.attempts.filter(student=user)
            .order_by("-started_at")
            .values_list("started_at", flat=True)
            .first()
        )
        return last.isoformat() if last else None


class QuizReviewEntry(serializers.Serializer):
    """Per-question review shown to a student after submission."""
    question_id = serializers.UUIDField()
    question_text = serializers.CharField()
    options = serializers.ListField()
    question_type = serializers.CharField()
    user_answer = serializers.JSONField()
    correct_answer = serializers.JSONField()
    is_correct = serializers.BooleanField()
    explanation = serializers.CharField()


class QuizAttemptSerializer(serializers.ModelSerializer):
    quiz_title = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()
    total_questions = serializers.SerializerMethodField()
    correct_count = serializers.SerializerMethodField()

    class Meta:
        model = QuizAttempt
        fields = (
            "id", "quiz", "quiz_title", "student", "score", "answers",
            "started_at", "submitted_at", "tenant",
            "review", "total_questions", "correct_count",
        )
        read_only_fields = (
            "id", "student", "score", "answers", "started_at",
            "submitted_at", "tenant", "quiz_title", "review",
            "total_questions", "correct_count",
        )

    def validate_quiz(self, quiz):
        _validate_tenant_quiz(quiz, self.context.get("request"))
        return quiz

    def get_quiz_title(self, obj):
        return obj.quiz.title if obj.quiz_id else None

    def get_total_questions(self, obj):
        return obj.quiz.questions.count() if obj.quiz_id else 0

    def get_correct_count(self, obj):
        total = self.get_total_questions(obj)
        if not obj.score or not total:
            return 0
        return int(round((obj.score or 0) * total / 100.0))

    def get_review(self, obj):
        """Reveal correct/incorrect feedback only after submission."""
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if not obj.submitted_at:
            return None
        # Only the owning student or staff may see the review.
        is_owner = user and str(getattr(user, "id", "")) == str(obj.student_id)
        is_staff = bool(
            user
            and (
                getattr(user, "is_superuser", False)
                or getattr(user, "role", None) in ("admin", "lecturer")
            )
        )
        if not (is_owner or is_staff):
            return None

        def _norm(value):
            return value.strip().lower() if isinstance(value, str) else value

        review = []
        for q in obj.quiz.questions.all().order_by("order_index"):
            user_ans = obj.answers.get(str(q.id)) if obj.answers else None
            ca = q.correct_answer or {}
            # Correct if either: matches the whole correct_answer object,
            # matches `index`, or matches `value` (case-insensitive for
            # strings).
            is_correct = bool(
                user_ans is not None
                and (
                    user_ans == ca
                    or _norm(user_ans) == _norm(ca.get("index"))
                    or _norm(user_ans) == _norm(ca.get("value"))
                )
            )
            review.append(
                {
                    "question_id": str(q.id),
                    "question_text": q.question_text,
                    "question_type": q.question_type,
                    "options": q.options or [],
                    "user_answer": user_ans,
                    "correct_answer": ca,
                    "is_correct": is_correct,
                    "explanation": q.explanation or "",
                }
            )
        return review


class QuizGenerateSerializer(serializers.Serializer):
    course_offering_id = serializers.UUIDField(required=False, allow_null=True)
    resource_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True
    )
    num_questions = serializers.IntegerField(min_value=1, max_value=20, default=5)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)


class QuizSubmitSerializer(serializers.Serializer):
    answers = serializers.DictField(child=serializers.JSONField())
