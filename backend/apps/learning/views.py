from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

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
    PlanTemplateSerializer,
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


class PlanTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PlanTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from django.db import models as django_models
        return PlanTemplate.objects.filter(
            django_models.Q(tenant=self.request.user.tenant) | django_models.Q(tenant__isnull=True),
        )
