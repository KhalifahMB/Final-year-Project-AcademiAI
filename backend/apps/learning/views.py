from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import IsTenantMember
from apps.common.viewsets import TenantModelViewSet
from .models import (
    Note, Bookmark, ProgressRecord,
    ResourceReadingPosition, StudySession, ConceptInteraction,
    Plan, PlanMilestone, PlanTask, PlanTemplate,
)
from .serializers import (
    NoteSerializer, BookmarkSerializer, ProgressRecordSerializer,
    ResourceReadingPositionSerializer, StudySessionSerializer, ConceptInteractionSerializer,
    PlanSerializer, PlanListSerializer, PlanMilestoneSerializer, PlanTaskSerializer,
    PlanTemplateSerializer, _normalize_template_data,
)


@extend_schema(tags=["Notes"])
class NoteViewSet(TenantModelViewSet):
    queryset = Note.objects.select_related("resource")
    serializer_class = NoteSerializer
    search_fields = ["title", "content"]

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, user=self.request.user)


@extend_schema(tags=["Bookmarks"])
class BookmarkViewSet(TenantModelViewSet):
    queryset = Bookmark.objects.select_related("resource")
    serializer_class = BookmarkSerializer
    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, user=self.request.user)


@extend_schema(tags=["Progress"])
class ProgressRecordViewSet(TenantModelViewSet):
    queryset = ProgressRecord.objects.select_related("concept")
    serializer_class = ProgressRecordSerializer

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, user=self.request.user)


class ResourceReadingPositionViewSet(viewsets.ModelViewSet):
    serializer_class = ResourceReadingPositionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ResourceReadingPosition.objects.filter(user=self.request.user)
        resource = self.request.query_params.get("resource")
        if resource:
            qs = qs.filter(resource_id=resource)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            tenant=self.request.user.tenant,
            user=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)


class StudySessionViewSet(viewsets.ModelViewSet):
    serializer_class = StudySessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return StudySession.objects.filter(
            tenant=self.request.user.tenant, user=self.request.user,
        )

    def perform_create(self, serializer):
        serializer.save(
            tenant=self.request.user.tenant,
            user=self.request.user,
        )

    @action(detail=True, methods=["post"], url_path="end")
    def end_session(self, request, pk=None):
        """Mark a study session as ended."""
        session = self.get_object()
        from django.utils import timezone
        session.ended_at = timezone.now()
        session.duration_seconds = int((session.ended_at - session.started_at).total_seconds())
        session.save(update_fields=["ended_at", "duration_seconds"])
        return Response(StudySessionSerializer(session).data)


class ConceptInteractionViewSet(viewsets.ModelViewSet):
    serializer_class = ConceptInteractionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ConceptInteraction.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(
            tenant=self.request.user.tenant,
            user=self.request.user,
        )


class PlanViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "list":
            return PlanListSerializer
        return PlanSerializer

    def get_queryset(self):
        qs = Plan.objects.filter(
            tenant=self.request.user.tenant, user=self.request.user,
        ).prefetch_related("milestones", "milestones__tasks")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        plan_type = self.request.query_params.get("plan_type")
        if plan_type:
            qs = qs.filter(plan_type=plan_type)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            tenant=self.request.user.tenant,
            user=self.request.user,
        )


class PlanMilestoneViewSet(viewsets.ModelViewSet):
    serializer_class = PlanMilestoneSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PlanMilestone.objects.filter(
            plan__user=self.request.user,
            plan__tenant=self.request.user.tenant,
        )

    def perform_create(self, serializer):
        serializer.save(
            tenant=self.request.user.tenant,
        )


class PlanTaskViewSet(viewsets.ModelViewSet):
    serializer_class = PlanTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PlanTask.objects.filter(
            milestone__plan__user=self.request.user,
            milestone__plan__tenant=self.request.user.tenant,
        )

    def perform_create(self, serializer):
        serializer.save(
            tenant=self.request.user.tenant,
        )

    @action(detail=True, methods=["post"], url_path="complete")
    def complete_task(self, request, pk=None):
        """Mark a task as done."""
        from django.utils import timezone
        task = self.get_object()
        task.status = "done"
        task.completed_at = timezone.now()
        task.save(update_fields=["status", "completed_at"])
        return Response(PlanTaskSerializer(task).data)


class PlanTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = PlanTemplateSerializer
    permission_classes = [IsTenantMember]

    def get_queryset(self):
        # Anyone in the tenant sees public templates plus their own private
        # ones; private templates are never exposed to other users. Drives
        # list, retrieve AND instantiate (which resolve through get_object()).
        user = self.request.user
        from django.db import models as django_models
        return PlanTemplate.objects.filter(
            tenant=user.tenant,
        ).filter(
            django_models.Q(is_public=True) | django_models.Q(created_by=user),
        )

    def _can_modify(self, obj):
        """Only the creator may edit/delete a template — or a tenant admin
        for public (institution) templates. Never a peer on another user's
        private template."""
        user = self.request.user
        return obj.created_by_id == user.id or (
            obj.is_public and getattr(user, "is_tenant_admin", False)
        )

    def perform_create(self, serializer):
        serializer.save(
            tenant=self.request.user.tenant,
            created_by=self.request.user,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self._can_modify(instance):
            return Response(
                {"error": {"detail": "You can only delete templates you own."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self._can_modify(instance):
            return Response(
                {"error": {"detail": "You can only edit templates you own."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        partial = kwargs.pop("partial", False)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @extend_schema(
        tags=["Plans"],
        summary="Start a plan from a template",
        description=(
            "Creates a personal plan (plus its milestones and tasks) from this "
            "template's `template_data`. Only templates visible to the caller "
            "can be instantiated."
        ),
        responses={201: PlanSerializer},
    )
    @action(detail=True, methods=["post"], url_path="instantiate")
    def instantiate(self, request, pk=None):
        from django.db import transaction
        from django.utils import timezone

        template = self.get_object()
        title = (request.data.get("title") or "").strip() or template.name
        if len(title) > 255:
            return Response(
                {"error": {"detail": "Title must be 255 characters or fewer."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            spec = _normalize_template_data(template.template_data)
        except ValueError as e:
            return Response(
                {"error": {"detail": str(e)}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        today = timezone.now().date()
        with transaction.atomic():
            plan = Plan.objects.create(
                tenant=request.user.tenant,
                user=request.user,
                title=title,
                description=template.description or "",
                plan_type=template.plan_type,
                status="active",
            )
            for order, ms in enumerate(spec):
                due = (
                    today + timezone.timedelta(days=ms["due_in_days"])
                    if ms["due_in_days"] is not None
                    else None
                )
                milestone = PlanMilestone.objects.create(
                    tenant=request.user.tenant,
                    plan=plan,
                    title=ms["title"],
                    description=ms["description"],
                    due_date=due,
                    status="pending",
                    order=order,
                )
                for task in ms["tasks"]:
                    PlanTask.objects.create(
                        tenant=request.user.tenant,
                        milestone=milestone,
                        title=task["title"],
                        description=task["description"],
                        estimated_minutes=task["estimated_minutes"],
                        status="todo",
                    )
        return Response(PlanSerializer(plan).data, status=status.HTTP_201_CREATED)
