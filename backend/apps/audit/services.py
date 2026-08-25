"""
Audit logging for security-sensitive actions.

log_action is best-effort: an audit write must never break the primary
operation, but failures are logged loudly instead of being swallowed so
operations can investigate gaps in the trail.

Note: audit writes run inside the request's tenant transaction established
by TenantContextMiddleware (RLS requires it). Callers running outside a
request (Celery tasks) must wrap calls in apps.common.db.tenant_scope.
"""
import logging
import uuid

from .models import AuditLog

logger = logging.getLogger(__name__)


def log_action(*, tenant, actor, action: str, entity_type: str = "", entity_id: str = "", metadata: dict | None = None):
    """
    Append an append-only audit record for a sensitive action.

    entity_id is a UUID column; non-UUID identifiers are preserved in
    metadata.entity_ref instead of failing the whole audit write.
    """
    try:
        metadata = dict(metadata or {})
        entity_uuid = None
        if entity_id:
            try:
                entity_uuid = uuid.UUID(str(entity_id))
            except (ValueError, AttributeError):
                metadata.setdefault("entity_ref", str(entity_id))
        return AuditLog.objects.create(
            tenant=tenant,
            actor=actor if actor and getattr(actor, "is_authenticated", False) else None,
            action=action,
            entity_type=entity_type or "",
            entity_id=entity_uuid,
            metadata=metadata,
        )
    except Exception:
        logger.exception("Audit write failed action=%s entity=%s", action, entity_type)
        return None
