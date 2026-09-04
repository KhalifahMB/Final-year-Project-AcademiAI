"""
Quizzes, questions, and attempts.
"""
from django.db import models

from apps.common.models import TenantScopedModel


class Quiz(TenantScopedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"

    course_offering = models.ForeignKey(
        "academics.CourseOffering",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="quizzes",
    )
    created_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="created_quizzes"
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    due_date = models.DateTimeField(null=True, blank=True)
    generation_job_id = models.CharField(max_length=64, blank=True)  # Celery task id if AI-generated

    class Meta:
        db_table = "quizzes"
        ordering = ["-created_at"]


class QuizQuestion(TenantScopedModel):
    class QuestionType(models.TextChoices):
        MULTIPLE_CHOICE = "multiple_choice", "Multiple Choice"
        TRUE_FALSE = "true_false", "True/False"
        SHORT_ANSWER = "short_answer", "Short Answer"

    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="questions")
    question_text = models.TextField()
    question_type = models.CharField(
        max_length=30, choices=QuestionType.choices, default=QuestionType.MULTIPLE_CHOICE
    )
    options = models.JSONField(default=list, blank=True)  # list of strings or {id, text}
    correct_answer = models.JSONField(default=dict, blank=True)
    explanation = models.TextField(blank=True)
    order_index = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "quiz_questions"
        ordering = ["order_index"]


class QuizAttempt(TenantScopedModel):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="attempts")
    student = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="quiz_attempts"
    )
    score = models.FloatField(null=True, blank=True)
    answers = models.JSONField(default=dict, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "quiz_attempts"
        ordering = ["-started_at"]
