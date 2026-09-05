from django.db.models import Q
from rest_framework import serializers

from apps.resources.models import Resource

from .models import (
    Note, Bookmark, ProgressRecord,
    ResourceReadingPosition, StudySession, ConceptInteraction,
    Plan, PlanMilestone, PlanTask, PlanTemplate,
)


def _resource_visible_to_user(resource, user) -> bool:
    """Return True iff `user` is permitted to bookmark/attach `resource`.

    Defends in depth against cross-tenant and cross-scope IDORs:
    - Admins/superusers may bookmark any resource in their tenant.
    - Other users must satisfy the same visibility rules that drive
      /resources/ (institution-wide + their academic profile + own
      private uploads).
    """
    if resource is None or user is None:
        return False
    if getattr(user, "is_superuser", False):
        return True
    if resource.tenant_id != getattr(user, "tenant_id", None):
        return False
    if getattr(user, "is_tenant_admin", False):
        return True
    from apps.resources.views import _authorized_resources_q
    return Resource.objects.filter(_authorized_resources_q(user), pk=resource.pk).exists()


class BookmarkResourceSerializer(serializers.ModelSerializer):
    """Lightweight material info embedded in bookmark listings."""

    class Meta:
        model = Resource
        fields = (
            "id", "title", "description", "visibility_scope",
            "processing_status", "mime_type",
        )


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ("id", "title", "content", "resource", "user", "tenant", "created_at", "updated_at")
        read_only_fields = ("id", "user", "tenant", "created_at", "updated_at")

    def validate_resource(self, value):
        request = self.context.get("request")
        if value is None:
            return value
        user = getattr(request, "user", None)
        if not _resource_visible_to_user(value, user):
            raise serializers.ValidationError("You cannot attach a note to a material you don't have access to.")
        return value


class BookmarkSerializer(serializers.ModelSerializer):
    resource_detail = BookmarkResourceSerializer(source="resource", read_only=True)

    class Meta:
        model = Bookmark
        fields = ("id", "resource", "resource_detail", "user", "tenant", "created_at")
        read_only_fields = ("id", "user", "tenant", "created_at")

    def validate_resource(self, value):
        # The bookmarked material must belong to the bookmarking user's
        # tenant AND be visible under the scoped visibility rules — never
        # store cross-tenant or out-of-scope references (IDOR defense).
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not _resource_visible_to_user(value, user):
            raise serializers.ValidationError("Material not found or not accessible.")
        return value


class ProgressRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgressRecord
        fields = ("id", "concept", "progress_value", "last_seen_at", "user", "tenant")
        read_only_fields = ("id", "user", "tenant", "last_seen_at", "progress_value")


class ResourceReadingPositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceReadingPosition
        fields = [
            "id", "resource", "resource_version", "section",
            "scroll_percentage", "last_read_at",
        ]
        read_only_fields = ["id", "last_read_at"]


class StudySessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudySession
        fields = [
            "id", "course_offering", "started_at", "ended_at",
            "duration_seconds", "activity_type",
        ]
        read_only_fields = ["id", "started_at"]


class ConceptInteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConceptInteraction
        fields = [
            "id", "concept", "interaction_type", "timestamp", "context",
        ]
        read_only_fields = ["id", "timestamp"]


class PlanTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanTask
        fields = [
            "id", "title", "description", "estimated_minutes",
            "status", "completed_at", "resource",
        ]
        read_only_fields = ["id", "completed_at"]


class PlanMilestoneSerializer(serializers.ModelSerializer):
    tasks = PlanTaskSerializer(many=True, read_only=True)
    plan = serializers.PrimaryKeyRelatedField(
        queryset=Plan.objects.none(), write_only=True,
    )

    class Meta:
        model = PlanMilestone
        fields = [
            "id", "plan", "title", "description", "due_date", "status",
            "order", "progress_value", "tasks",
        ]
        read_only_fields = ["id"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            self.fields["plan"].queryset = Plan.objects.filter(
                tenant=user.tenant, user=user,
            )


class PlanSerializer(serializers.ModelSerializer):
    milestones = PlanMilestoneSerializer(many=True, read_only=True)

    class Meta:
        model = Plan
        fields = [
            "id", "title", "description", "plan_type", "status",
            "start_date", "target_date", "milestones",
        ]
        read_only_fields = ["id"]


class PlanListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for plan list views (no nested milestones)."""
    milestone_count = serializers.SerializerMethodField()
    task_count = serializers.SerializerMethodField()
    completed_task_count = serializers.SerializerMethodField()

    class Meta:
        model = Plan
        fields = [
            "id", "title", "description", "plan_type", "status",
            "start_date", "target_date", "milestone_count", "task_count",
            "completed_task_count", "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]

    def get_milestone_count(self, obj):
        return obj.milestones.count() if hasattr(obj, 'milestones') else 0

    def get_task_count(self, obj):
        return PlanTask.objects.filter(milestone__plan=obj).count() if hasattr(obj, 'milestones') else 0

    def get_completed_task_count(self, obj):
        return PlanTask.objects.filter(milestone__plan=obj, status="done").count() if hasattr(obj, 'milestones') else 0


def _normalize_template_data(raw):
    """Validate `template_data` into [{"title", "description", "due_in_days", "tasks"}].

    Accepted schema::

        {"milestones": [
            {"title": str, "description": str = "",
             "due_in_days": int >= 0 | null,
             "tasks": [{"title": str, "description": str = "",
                        "estimated_minutes": int > 0 | null}]},
        ]}

    Unknown keys are ignored. Anything else raises ValueError with a
    human-readable message. Shared by:
    - the admin create/update path (validation + canonical storage), and
    - PlanTemplateViewSet.instantiate (which iterates the returned milestones).
    """
    if not isinstance(raw, dict):
        raise ValueError("Template data must be an object with a 'milestones' list.")
    milestones = raw.get("milestones", [])
    if not isinstance(milestones, list):
        raise ValueError("Template data must be an object with a 'milestones' list.")
    spec = []
    for i, m in enumerate(milestones):
        if not isinstance(m, dict):
            raise ValueError(f"Milestone #{i + 1} must be an object.")
        title = (m.get("title") or "").strip() if isinstance(m.get("title"), str) else ""
        if not title:
            raise ValueError(f"Milestone #{i + 1} needs a title.")
        due = m.get("due_in_days", None)
        if due is not None and (not isinstance(due, int) or isinstance(due, bool) or due < 0):
            raise ValueError(f"Milestone '{title}' needs due_in_days as days from today (0 or more).")
        tasks = m.get("tasks", [])
        if not isinstance(tasks, list):
            raise ValueError(f"Milestone '{title}' needs tasks as a list.")
        norm_tasks = []
        for j, t in enumerate(tasks):
            if not isinstance(t, dict):
                raise ValueError(f"Task #{j + 1} in milestone '{title}' must be an object.")
            t_title = (t.get("title") or "").strip() if isinstance(t.get("title"), str) else ""
            if not t_title:
                raise ValueError(f"Task #{j + 1} in milestone '{title}' needs a title.")
            est = t.get("estimated_minutes", None)
            if est is not None and (not isinstance(est, int) or isinstance(est, bool) or est <= 0):
                raise ValueError(f"Task '{t_title}' needs estimated_minutes as minutes above zero.")
            desc = t.get("description") if isinstance(t.get("description"), str) else ""
            norm_tasks.append({
                "title": t_title[:255],
                "description": desc,
                "estimated_minutes": est,
            })
        desc = m.get("description") if isinstance(m.get("description"), str) else ""
        spec.append({
            "title": title[:255],
            "description": desc,
            "due_in_days": due,
            "tasks": norm_tasks,
        })
    return spec


class PlanTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PlanTemplate
        fields = [
            "id", "name", "description", "plan_type", "template_data",
            "is_public", "created_by", "created_by_name",
        ]
        read_only_fields = ["id", "created_by", "created_by_name"]

    def get_created_by_name(self, obj):
        user = obj.created_by
        if user is None:
            return None
        name = f"{user.first_name} {user.last_name}".strip()
        return name or user.email

    def validate_template_data(self, value):
        # Runs on create + (full) update; surfaces bad milestone/task shapes
        # as a DRF 400 so users get consistent error messages. Stores the
        # canonical shape (unknown keys dropped) for instantiate.
        try:
            return {"milestones": _normalize_template_data(value)}
        except ValueError as exc:
            raise serializers.ValidationError(str(exc))
