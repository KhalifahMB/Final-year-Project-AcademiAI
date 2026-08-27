"""
Tenant model — institution boundary.
"""
from django.db import models

from apps.common.models import UUIDModel, TimeStampedModel


class Tenant(UUIDModel, TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"
        PENDING = "pending", "Pending"

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100, unique=True)
    domain = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True
    )
    plan = models.CharField(max_length=50, default="standard")
    storage_quota_bytes = models.BigIntegerField(default=10 * 1024 * 1024 * 1024)  # 10 GB
    # Set when status moves to suspended; drives the 24h grace-period
    # login-restriction scheduled task. Cleared on reactivation.
    suspended_at = models.DateTimeField(null=True, blank=True)
    # Future: restrict signups to institutional email domains, e.g.
    # ["atbu.edu.ng"]. Not enforced anywhere yet (documented roadmap item).
    allowed_email_domains = models.JSONField(default=list, blank=True)
    # Future: per-tenant branding (logo key, primary colour, tagline).
    branding = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "tenants"
        ordering = ["name"]

    def __str__(self):
        return self.name


class TenantRequest(UUIDModel, TimeStampedModel):
    """
    Self-serve institution sign-up request.

    Public visitors can ask for their university to be provisioned.
    A superuser reviews in the platform console; on approval we
    create the Tenant automatically.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    # Requester
    requester_name = models.CharField(max_length=255)
    requester_email = models.EmailField(db_index=True)
    requester_role = models.CharField(max_length=80, blank=True)
    phone_number = models.CharField(max_length=32, blank=True)

    # Institution
    institution_name = models.CharField(max_length=255)
    institution_slug = models.SlugField(max_length=100, blank=True)
    institution_domain = models.CharField(max_length=255, blank=True)
    institution_type = models.CharField(
        max_length=50,
        blank=True,
        choices=[
            ("university", "University"),
            ("polytechnic", "Polytechnic"),
            ("college", "College"),
            ("other", "Other"),
        ],
        default="university",
    )
    estimated_students = models.PositiveIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)

    # Review
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True,
    )
    reviewed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="reviewed_tenant_requests",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)
    provisioned_tenant = models.ForeignKey(
        Tenant,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="signup_request",
    )

    class Meta:
        db_table = "tenant_requests"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self):
        return f"{self.institution_name} — {self.status}"
