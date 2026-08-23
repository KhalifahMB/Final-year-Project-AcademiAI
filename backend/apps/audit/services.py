"""Write audit log entries for sensitive actions."""
from .models import AuditLog


def log_action(*, tenant, actor, action: str, entity_type: str = "", entity_id: str = "", metadata: dict | None = None):
    return AuditLog.objects.create(
        tenant=tenant,
        actor=actor if actor and getattr(actor, "is_authenticated", False) else None,
        action=action,
        entity_type=entity_type or "",
        entity_id=str(entity_id) if entity_id else "",
        metadata=metadata or {},
    )
