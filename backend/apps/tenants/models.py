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

    class Meta:
        db_table = "tenants"
        ordering = ["name"]

    def __str__(self):
        return self.name
