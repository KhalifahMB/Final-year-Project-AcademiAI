"""
Shared abstract models and utilities.
"""
import uuid

from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base with created/updated timestamps.

    created_at is intentionally NOT indexed here: indexing every tenant-scoped
    table wastes disk + write cost for tables that never order/filter by
    creation time. Models that actually do (audit trail, chat history, stats
    filters, etc.) opt in via ``Meta.indexes``.
    """

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    """Abstract base with UUID primary key."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TenantScopedModel(UUIDModel, TimeStampedModel):
    """
    Abstract base for all tenant-scoped entities.
    tenant_id is mandatory; never accept untrusted client values without membership checks.
    """

    tenant = models.ForeignKey(
        "tenants.Tenant",
        # PROTECT: deleting a tenant is a catastrophic, irreversible event in a
        # multi-tenant platform. Any row referencing the tenant must be removed
        # first (the app suspends tenants via status instead of deleting), so an
        # accidental delete can never cascade through the institution's data.
        on_delete=models.PROTECT,
        related_name="%(class)s_set",
        db_index=True,
    )

    class Meta:
        abstract = True
