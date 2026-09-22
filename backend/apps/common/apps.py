import logging

from django.apps import AppConfig
from django.db.models.signals import post_migrate

logger = logging.getLogger(__name__)


def _apply_rls_after_migrate(sender, app_config, verbosity, **kwargs):
    """Enforce RLS on every tenant-scoped table after each migrate.

    The mid-graph ``0001_rls_tenant_isolation`` migration can only cover
    tables that already exist when it runs, so tables created by later
    migrations would otherwise be left unprotected until a manual step.
    ``post_migrate`` fires once the whole graph has been applied, so the model
    registry — and therefore ``rls.TABLES`` — is complete here. The DDL is
    idempotent (guarded DO blocks), so re-running on every migrate is safe and
    removes the need for a separate ``apply_rls`` deploy step.
    """
    from django.db import connection

    if connection.vendor != "postgresql":
        return

    from apps.common import rls

    try:
        with connection.cursor() as cursor:
            for stmt in rls.all_policy_statements(teardown=False):
                cursor.execute(stmt)
    except Exception:
        # Never block a migrate on RLS re-application (e.g. a role without
        # DDL rights); log loudly so the gap is visible instead of silent.
        logger.exception("Failed to auto-apply RLS policies after migrate")
        return

    if verbosity >= 1:
        logger.info("RLS enforced on %d tenant-scoped tables", len(rls.TABLES))


class CommonConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.common"
    label = "common"

    def ready(self):
        # Gate on this app's own post_migrate so the full DDL runs exactly once
        # per migrate (the schema is fully built by the time any app emits it).
        post_migrate.connect(
            _apply_rls_after_migrate,
            sender=self,
            dispatch_uid="common_auto_apply_rls",
        )
