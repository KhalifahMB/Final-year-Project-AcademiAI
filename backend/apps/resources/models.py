"""
Resource metadata, versions, and chunks (embeddings via pgvector).
Binary files live in object storage; only metadata and chunks in PostgreSQL.
"""
from django.db import models
from pgvector.django import VectorField

from apps.common.models import TenantScopedModel
from django.conf import settings


class Resource(TenantScopedModel):
    class Visibility(models.TextChoices):
        PRIVATE = "private", "Private"
        COURSE = "course", "Course"
        PROGRAMME = "programme", "Programme"
        DEPARTMENT = "department", "Department"
        FACULTY = "faculty", "Faculty"
        INSTITUTION = "institution", "Institution"

    class ProcessingStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    course_offering = models.ForeignKey(
        "academics.CourseOffering",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resources",
    )
    programme = models.ForeignKey(
        "academics.Programme",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resources",
    )
    department = models.ForeignKey(
        "academics.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resources",
    )
    faculty = models.ForeignKey(
        "academics.Faculty",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resources",
    )
    uploaded_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="uploaded_resources"
    )
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    visibility_scope = models.CharField(
        max_length=20, choices=Visibility.choices, default=Visibility.COURSE
    )
    mime_type = models.CharField(max_length=128, blank=True)
    storage_key = models.CharField(max_length=1024, blank=True)  # current version key
    processing_status = models.CharField(
        max_length=20,
        choices=ProcessingStatus.choices,
        default=ProcessingStatus.PENDING,
        db_index=True,
    )
    processing_error = models.TextField(blank=True)
    has_extractable_text = models.BooleanField(default=True)

    class Meta:
        db_table = "resources"
        indexes = [
            models.Index(fields=["tenant", "processing_status"]),
            models.Index(fields=["tenant", "visibility_scope"]),
            models.Index(fields=["course_offering"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class ResourceVersion(TenantScopedModel):
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name="versions")
    version_number = models.PositiveIntegerField()
    storage_key = models.CharField(max_length=1024)
    checksum = models.CharField(max_length=128, blank=True)
    created_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="+"
    )
    file_size_bytes = models.BigIntegerField(null=True, blank=True)

    class Meta:
        db_table = "resource_versions"
        constraints = [
            models.UniqueConstraint(
                fields=["resource", "version_number"], name="uniq_resource_version"
            )
        ]
        ordering = ["-version_number"]


class ResourceChunk(TenantScopedModel):
    resource_version = models.ForeignKey(
        ResourceVersion, on_delete=models.CASCADE, related_name="chunks"
    )
    chunk_index = models.PositiveIntegerField()
    content = models.TextField()
    embedding = VectorField(dimensions=settings.EMBEDDING_DIMENSION, null=True, blank=True)
    token_count = models.PositiveIntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "resource_chunks"
        constraints = [
            models.UniqueConstraint(
                fields=["resource_version", "chunk_index"], name="uniq_chunk_index"
            )
        ]
        indexes = [
            models.Index(fields=["tenant", "resource_version"]),
        ]


class ResourcePermission(TenantScopedModel):
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name="permissions")
    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )
    role = models.CharField(max_length=20, blank=True, null=True)
    course_offering = models.ForeignKey(
        "academics.CourseOffering",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="+",
    )
    permission = models.CharField(max_length=50, default="read")  # read, write, manage

    class Meta:
        db_table = "resource_permissions"


class ResourceSummary(TenantScopedModel):
    """Persisted AI summary for a resource version.

    Every time a user clicks "Summarize with AI" we store the result here so
    the same (or other authorized) users can revisit past summaries without
    re-calling Gemini. Users can regenerate; we keep history ordered by
    recency.
    """

    resource = models.ForeignKey(
        Resource, on_delete=models.CASCADE, related_name="summaries"
    )
    version_number = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resource_summaries",
    )
    summary = models.TextField()
    key_points = models.JSONField(default=list, blank=True)
    word_count = models.PositiveIntegerField(default=0)
    model_name = models.CharField(max_length=128, blank=True)

    class Meta:
        db_table = "resource_summaries"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant", "resource", "-created_at"]),
        ]

    def __str__(self):
        return f"Summary of {self.resource_id} @ {self.created_at}"
