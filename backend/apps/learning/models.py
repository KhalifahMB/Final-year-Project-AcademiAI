"""
Personal learning: notes, bookmarks, progress, reading positions, study sessions, plans.
"""
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.common.models import TenantScopedModel


class Note(TenantScopedModel):
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="notes")
    resource = models.ForeignKey(
        "resources.Resource",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notes",
    )
    title = models.CharField(max_length=255)
    content = models.TextField()

    class Meta:
        db_table = "notes"
        ordering = ["-updated_at"]


class Bookmark(TenantScopedModel):
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="bookmarks")
    resource = models.ForeignKey(
        "resources.Resource", on_delete=models.CASCADE, related_name="bookmarks"
    )

    class Meta:
        db_table = "bookmarks"
        constraints = [
            models.UniqueConstraint(fields=["user", "resource"], name="uniq_user_resource_bookmark")
        ]
        ordering = ["-created_at"]


class ProgressRecord(TenantScopedModel):
    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="progress_records"
    )
    concept = models.ForeignKey(
        "knowledge.Concept", on_delete=models.CASCADE, related_name="progress_records"
    )
    progress_value = models.FloatField(default=0.0)  # 0–1 or percentage
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "progress_records"
        constraints = [
            models.UniqueConstraint(fields=["user", "concept"], name="uniq_user_concept_progress")
        ]


class ResourceReadingPosition(TenantScopedModel):
    """Tracks where a student left off reading a resource."""
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="reading_positions")
    resource = models.ForeignKey("resources.Resource", on_delete=models.CASCADE, related_name="reading_positions")
    resource_version = models.ForeignKey(
        "resources.ResourceVersion", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="reading_positions",
    )
    section = models.CharField(max_length=255, blank=True, default="")
    scroll_percentage = models.FloatField(default=0.0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    last_read_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "resource_reading_positions"
        ordering = ["-last_read_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "resource"], name="uniq_user_resource_position")
        ]


class StudySession(TenantScopedModel):
    """Records a learning session (chat, reading, quiz, note-taking)."""
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="study_sessions")
    course_offering = models.ForeignKey(
        "academics.CourseOffering", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="study_sessions",
    )
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)
    activity_type = models.CharField(
        max_length=20,
        choices=[
            ("chat", "Chat"),
            ("reading", "Reading"),
            ("quiz", "Quiz"),
            ("note", "Note-taking"),
        ],
        default="chat",
    )

    class Meta:
        db_table = "study_sessions"
        ordering = ["-started_at"]


class ConceptInteraction(TenantScopedModel):
    """Fine-grained concept tracking from various user activities."""
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="concept_interactions")
    concept = models.ForeignKey("knowledge.Concept", on_delete=models.CASCADE, related_name="interactions")
    interaction_type = models.CharField(
        max_length=20,
        choices=[
            ("chat_mentioned", "Chat Mentioned"),
            ("quiz_answered", "Quiz Answered"),
            ("resource_read", "Resource Read"),
            ("note_created", "Note Created"),
        ],
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    context = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "concept_interactions"
        ordering = ["-timestamp"]


class Plan(TenantScopedModel):
    """A study, workflow, or personal plan."""
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="plans")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    plan_type = models.CharField(
        max_length=20,
        choices=[
            ("study", "Study Plan"),
            ("workflow", "Workflow Plan"),
            ("personal", "Personal Plan"),
        ],
        default="study",
    )
    status = models.CharField(
        max_length=20,
        choices=[
            ("active", "Active"),
            ("completed", "Completed"),
            ("paused", "Paused"),
            ("archived", "Archived"),
        ],
        default="active",
    )
    start_date = models.DateField(null=True, blank=True)
    target_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "plans"
        ordering = ["-updated_at"]


class PlanMilestone(TenantScopedModel):
    """A milestone within a plan."""
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name="milestones")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "Pending"),
            ("in_progress", "In Progress"),
            ("completed", "Completed"),
            ("skipped", "Skipped"),
        ],
        default="pending",
    )
    order = models.IntegerField(default=0)
    progress_value = models.FloatField(default=0.0)

    class Meta:
        db_table = "plan_milestones"
        ordering = ["order", "created_at"]


class PlanTask(TenantScopedModel):
    """A task within a milestone."""
    milestone = models.ForeignKey(PlanMilestone, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    estimated_minutes = models.IntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ("todo", "To Do"),
            ("in_progress", "In Progress"),
            ("done", "Done"),
        ],
        default="todo",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    resource = models.ForeignKey(
        "resources.Resource", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="plan_tasks",
    )

    class Meta:
        db_table = "plan_tasks"
        ordering = ["created_at"]


class PlanTemplate(TenantScopedModel):
    """Reusable plan template.

    Public templates are visible to every member of the tenant; private
    templates are visible only to their creator (`created_by`). Anyone in the
    tenant may create a template; only its creator (or a tenant admin for
    public templates) may edit or delete it.
    """
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    plan_type = models.CharField(
        max_length=20,
        choices=[
            ("study", "Study Plan"),
            ("workflow", "Workflow Plan"),
            ("personal", "Personal Plan"),
        ],
        default="study",
    )
    template_data = models.JSONField(default=dict, blank=True)
    is_public = models.BooleanField(
        default=False,
        help_text="Public templates are visible to the whole institution; "
                  "private templates are visible only to their creator.",
    )
    created_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="plan_templates",
    )

    class Meta:
        db_table = "plan_templates"
        ordering = ["name"]
