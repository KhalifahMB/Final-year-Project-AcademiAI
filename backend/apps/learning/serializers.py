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

    class Meta:
        model = PlanMilestone
        fields = [
            "id", "title", "description", "due_date", "status",
            "order", "progress_value", "tasks",
        ]
        read_only_fields = ["id"]


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


class PlanTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanTemplate
        fields = ["id", "name", "description", "plan_type", "template_data"]
        read_only_fields = ["id"]
