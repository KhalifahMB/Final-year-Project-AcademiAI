"""
Notifications feed service.

Alerts are *derived on read* from the same aggregates the role dashboards
show (apps.common.dashboard), then persisted as idempotent Notification rows
keyed by a stable per-user `key`. Because sync runs inside the request (with
the tenant context the middleware bound), RLS is satisfied and cross-tenant
leaks are impossible — including for the user column, which is always set to
the caller.

Unread semantics:
  - The badge counts unread WARN/CRITICAL notifications only (info items are
    shown in the feed but do not light up the badge).
  - When a condition clears (e.g. a pipeline retry succeeds), any *unread*
    notification for that key is removed automatically. Read rows are kept as
    dismissible history until the condition returns.
"""
import logging

from django.core.cache import cache

from .models import Notification, NotificationPreference

logger = logging.getLogger(__name__)

SYNC_TTL = 60  # seconds; mirrors the dashboard cache staleness

BADGE_SEVERITIES = (Notification.Severity.WARN, Notification.Severity.CRITICAL)

# Catalog of every notification kind the engine can emit, with a human
# label/description/category and default severity. The settings UI lists
# these so users can mute any kind explicitly. Severity here is informational
# (rows drive live severity), except `always_on` kinds which cannot be muted.
KIND_CATALOG = [
    # student
    {"kind": "course_behind", "label": "Courses falling behind", "category": "Learning", "severity": "warn",
     "description": "When a course's progress drops behind its schedule."},
    {"kind": "concept_low", "label": "Low concept mastery", "category": "Learning", "severity": "warn",
     "description": "Concepts where your average is below 50%."},
    {"kind": "quiz_available", "label": "Practice quizzes ready", "category": "Learning", "severity": "info",
     "description": "New practice quizzes available for your material."},
    {"kind": "new_material", "label": "New study material", "category": "Library", "severity": "info",
     "description": "Fresh study material added to your library."},
    # lecturer
    {"kind": "students_at_risk", "label": "Students at risk", "category": "Teaching", "severity": "critical",
     "description": "Cohort averages that have fallen below 50%."},
    {"kind": "weak_concept", "label": "Weak concepts", "category": "Teaching", "severity": "warn",
     "description": "Topics your cohort is averaging below 50% on."},
    {"kind": "pipeline_failed", "label": "Processing failures", "category": "Library", "severity": "critical", "always_on": True,
     "description": "Uploads that failed to process and need re-uploading."},
    {"kind": "pipeline_indexing", "label": "Indexing in progress", "category": "Library", "severity": "info",
     "description": "Uploads still being indexed and made searchable."},
    # admin
    {"kind": "material_uploaded", "label": "Materials uploaded", "category": "Library", "severity": "info",
     "description": "New materials uploaded to the institution library."},
]

KIND_CATALOG_BY_KIND = {item["kind"]: item for item in KIND_CATALOG}


def _disabled_kinds(user):
    """Return the set of kinds currently muted by the user.

    `always_on` kinds (e.g. processing failures) cannot be muted and are
    always excluded from the disabled set regardless of stored state.
    """
    muted = NotificationPreference.objects.filter(
        tenant_id=user.tenant_id, user=user, enabled=False
    ).values_list("kind", flat=True)
    always_on = {k for k, v in KIND_CATALOG_BY_KIND.items() if v.get("always_on")}
    return set(muted) - always_on


def _sync_cache_key(user):
    return f"notifications:alerts:{user.tenant_id}:{user.id}:v1"


def invalidate_cache(user):
    """Drop the sync cache for a user (used by tests and post-change hooks)."""
    cache.delete(_sync_cache_key(user))


def _role(user):
    """Notifications follow the dashboard the user actually sees."""
    if user.is_superuser or getattr(user, "is_tenant_admin", False):
        return "admin"
    return user.role or "student"


# ----------------------------------------------------------------------
# Alert derivation (reuses the dashboard aggregate builders 1:1)
# ----------------------------------------------------------------------

def _alerts_for_student(payload):
    alerts = []
    for c in payload.get("continue_courses") or []:
        if c.get("status") == "behind":
            alerts.append({
                "key": f"course_behind:{c['id']}",
                "kind": "course_behind",
                "severity": Notification.Severity.WARN,
                "title": f"{c.get('title') or 'A course'} needs attention",
                "body": (
                    f"You're at {c.get('progress_pct', 0)}% progress. "
                    "Open the course to pick it back up."
                ),
                "link": f"/courses/{c['id']}",
            })
    for m in payload.get("concept_mastery") or []:
        pct = m.get("pct", 0)
        if pct < 50:
            alerts.append({
                "key": f"concept_low:{m.get('name') or 'concept'}",
                "kind": "concept_low",
                "severity": Notification.Severity.WARN,
                "title": f"Concept to review: {m.get('name') or 'unknown'}",
                "body": f"Your average here is {pct}% — try a practice quiz.",
                "link": "/quizzes",
            })
    for q in (payload.get("up_next") or [])[:2]:
        if q.get("id"):
            alerts.append({
                "key": f"quiz_available:{q['id']}",
                "kind": "quiz_available",
                "severity": Notification.Severity.INFO,
                "title": f"{q.get('title') or 'A quiz'} is ready",
                "body": f"A new practice quiz for {q.get('context') or 'your course'} is available.",
                "link": f"/quizzes/{q['id']}/take",
            })
    for r in (payload.get("recent_resources") or [])[:2]:
        if r.get("id"):
            alerts.append({
                "key": f"resource:{r['id']}",
                "kind": "new_material",
                "severity": Notification.Severity.INFO,
                "title": f"New material: {r.get('title') or 'Untitled'}",
                "body": "Fresh study material is available in the library.",
                "link": "/resources",
            })
    return alerts


def _alerts_for_lecturer(payload):
    alerts = []
    at_risk = [
        s for s in (payload.get("students_needing_attention") or [])
        if s.get("status") == "at_risk"
    ]
    if at_risk:
        names = ", ".join(s.get("name") or "Student" for s in at_risk[:3])
        alerts.append({
            "key": "students_at_risk",
            "kind": "students_at_risk",
            "severity": Notification.Severity.CRITICAL,
            "title": f"{len(at_risk)} student{'s' if len(at_risk) != 1 else ''} at risk",
            "body": f"Lowest cohort averages are below 50%: {names}.",
            "link": "/dashboard",
        })
    for w in (payload.get("weak_concepts") or []):
        if w.get("mastery_pct", 100) < 50:
            alerts.append({
                "key": f"weak_concept:{w.get('quiz_id') or w.get('label')}",
                "kind": "weak_concept",
                "severity": Notification.Severity.WARN,
                "title": f"Reinforce: {w.get('label') or 'a topic'}",
                "body": f"Average is {w.get('mastery_pct', 0)}% across {w.get('attempts', 0)} attempt(s).",
                "link": "/quizzes",
            })
    pipeline = payload.get("pipeline") or {}
    failed = pipeline.get("failed", 0) or 0
    if failed > 0:
        alerts.append({
            "key": "pipeline_failed",
            "kind": "pipeline_failed",
            "severity": Notification.Severity.CRITICAL,
            "title": f"{failed} material{'s' if failed != 1 else ''} failed processing",
            "body": "Review and re-upload the failed files to make them searchable.",
            "link": "/resources/upload",
        })
    indexing = pipeline.get("indexing", 0) or 0
    if indexing > 0:
        alerts.append({
            "key": "pipeline_indexing",
            "kind": "pipeline_indexing",
            "severity": Notification.Severity.INFO,
            "title": f"{indexing} material{'s' if indexing != 1 else ''} still indexing",
            "body": "Uploads are processing and will be searchable shortly.",
            "link": "/resources/upload",
        })
    return alerts


def _alerts_for_admin(payload):
    alerts = []
    for s in payload.get("materials_by_status") or []:
        if s.get("name") == "Failed" and s.get("value", 0) > 0:
            alerts.append({
                "key": "pipeline_failed",
                "kind": "pipeline_failed",
                "severity": Notification.Severity.CRITICAL,
                "title": f"{s['value']} material{'s' if s['value'] != 1 else ''} failed processing",
                "body": "Review the failing uploads so institutional materials stay searchable.",
                "link": "/resources",
            })
    for r in (payload.get("recent_resources") or [])[:2]:
        if r.get("id"):
            alerts.append({
                "key": f"resource:{r['id']}",
                "kind": "material_uploaded",
                "severity": Notification.Severity.INFO,
                "title": f"{r.get('title') or 'Material'} was uploaded",
                "body": "New material is available in the institution library.",
                "link": "/resources",
            })
    return alerts


_ROLE_BUILDERS = {
    "student": ("apps.common.dashboard.StudentDashboardView", "_alerts_for_student"),
    "lecturer": ("apps.common.dashboard.LecturerDashboardView", "_alerts_for_lecturer"),
    "admin": ("apps.common.dashboard.AdminDashboardView", "_alerts_for_admin"),
}


def _compute_alerts(user):
    """Compute the current alert set for the user's role without any cache."""
    import importlib

    role = _role(user)
    view_path, fn_name = _ROLE_BUILDERS[role]
    module_path, _, attr = view_path.rpartition(".")
    view_cls = getattr(importlib.import_module(module_path), attr)
    payload = view_cls._build(user) or {}
    fn = globals()[fn_name]
    return fn(payload)


# ----------------------------------------------------------------------
# Persistence + sync
# ----------------------------------------------------------------------

def _persist_alerts(user, alerts, disabled=()):
    if disabled:
        disabled_set = set(disabled)
        alerts = [a for a in alerts if a.get("kind") not in disabled_set]
    by_key = {a["key"]: a for a in alerts}
    unread = Notification.objects.filter(
        tenant_id=user.tenant_id, user=user, is_read=False,
    )
    stale = unread.exclude(key__in=by_key.keys())
    if stale.exists():
        stale.delete()
    if disabled:
        # Drop any lingering unread rows for a now-muted kind.
        muted_unread = unread.filter(kind__in=disabled_set)
        if muted_unread.exists():
            muted_unread.delete()
    for key, alert in by_key.items():
        defaults = {
            "kind": alert["kind"],
            "severity": alert["severity"],
            "title": alert["title"],
            "body": alert["body"],
            "link": alert["link"],
        }
        notification, created = Notification.objects.get_or_create(
            tenant_id=user.tenant_id,
            user=user,
            key=key,
            defaults=defaults,
        )
        if not created and (
            notification.kind != alert["kind"]
            or notification.severity != alert["severity"]
            or notification.title != alert["title"]
            or notification.body != alert["body"]
            or notification.link != alert["link"]
        ):
            for field, value in defaults.items():
                setattr(notification, field, value)
            notification.save(update_fields=list(defaults.keys()))


def sync_user_notifications(user, *, force=False):
    """
    Refresh the user's feed from live state and persist it.

    Returns the list of current alerts (each a dict), for callers that need
    the membership set. The upsert + stale-unread cleanup is idempotent.
    Alerts whose kind the user has muted are suppressed, and any still-unread
    rows for a now-muted kind are removed.
    """
    if not getattr(user, "tenant_id", None):
        return []
    cache_key = _sync_cache_key(user)
    alerts = None if force else cache.get(cache_key)
    if alerts is None:
        try:
            alerts = _compute_alerts(user)
        except Exception:
            logger.exception("Could not compute notifications for user=%s", user.id)
            alerts = []
        cache.set(cache_key, alerts, SYNC_TTL)
    try:
        _persist_alerts(user, alerts, _disabled_kinds(user))
    except Exception:
        logger.exception("Could not persist notifications for user=%s", user.id)
    return alerts


def unread_alert_count(user):
    """Badge count: unread WARN/CRITICAL alerts only."""
    sync_user_notifications(user)
    return Notification.objects.filter(
        tenant_id=user.tenant_id,
        user=user,
        is_read=False,
        severity__in=BADGE_SEVERITIES,
    ).count()


def mark_read(user, notification_id):
    """Mark one notification read (scoped to caller + tenant)."""
    updated = Notification.objects.filter(
        pk=notification_id,
        tenant_id=user.tenant_id,
        user=user,
    ).update(is_read=True)
    return updated > 0


def mark_all_read(user):
    """Dismiss every unread notification for the caller."""
    updated = Notification.objects.filter(
        tenant_id=user.tenant_id,
        user=user,
        is_read=False,
    ).update(is_read=True)
    return updated


def preferences_for_user(user):
    """Return the full kind catalog with each row's enabled state.

    Every catalog kind is included so the settings UI can render the complete
    list; an absent preference row means the kind is enabled by default.
    `always_on` kinds report `mutable: False` and are always enabled.
    """
    enabled_map = dict(
        NotificationPreference.objects.filter(
            tenant_id=user.tenant_id, user=user, enabled=False
        ).values_list("kind", "enabled")
    )
    hard_disabled = set(enabled_map)  # stored disabled rows
    rows = []
    for item in sorted(
        KIND_CATALOG, key=lambda k: (k["category"], k["label"])
    ):
        kind = item["kind"]
        always_on = bool(item.get("always_on"))
        enabled = True if always_on else (kind not in hard_disabled)
        rows.append({
            "kind": kind,
            "label": item["label"],
            "category": item["category"],
            "severity": item["severity"],
            "description": item["description"],
            "enabled": enabled,
            "mutable": not always_on,
        })
    return rows


def set_preference(user, kind, enabled):
    """Set (or clear) a per-kind mute. `always_on` kinds are never muted."""
    if kind not in KIND_CATALOG_BY_KIND:
        return False
    if KIND_CATALOG_BY_KIND[kind].get("always_on"):
        return False
    pref, created = NotificationPreference.objects.get_or_create(
        tenant_id=user.tenant_id,
        user=user,
        kind=kind,
        defaults={"enabled": enabled},
    )
    if not created and pref.enabled != enabled:
        pref.enabled = enabled
        pref.save(update_fields=["enabled"])
    if enabled:
        # Turning a kind back on clears any still-unread rows of that kind
        # so the restored kind recomputes fresh on next sync.
        Notification.objects.filter(
            tenant_id=user.tenant_id, user=user, kind=kind
        ).delete()
    invalidate_cache(user)
    return True