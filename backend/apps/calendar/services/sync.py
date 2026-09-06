"""
Bi-directional sync between learning Plans and the layered Calendar.

Plans (learning.Plan / PlanMilestone / PlanTask) and CalendarEvent are
separate tenant-scoped models. This module keeps them consistent so a
change in one surface is immediately reflected in the other:

  Plan -> Calendar
    A Plan with a start/target date renders as a single personal study
    event spanning the window. A milestone with a due_date renders as an
    all-day study event. Deleting a plan deletes its linked events.

  Calendar -> Plan
    A personal study-layer CalendarEvent created on the Calendar page
    upserts a matching Plan (plus milestone) so it appears on Plans.

Linkage + recursion guard
    CalendarEvent.plan is the single source of truth for linkage. Events
    generated from a plan are tagged metadata["source"] == "plan"; events
    created directly on the calendar and mirrored into a plan are tagged
    metadata["source"] == "calendar". A contextvar recursion guard
    prevents a plan->event update from re-triggering the event->plan path
    (and vice versa).
"""
import contextvars
import datetime
from uuid import uuid4
from zoneinfo import ZoneInfo

from django.utils import timezone

SYNC_GUARD = contextvars.ContextVar("calendar_plan_sync_guard", default=frozenset())

SYNC_PLAN_EVENT = "academiai:sync:plan:event"
SYNC_PLAN_MILESTONE_KEYS = "academiai:sync:milestone_keys"
SYNC_EVENT_PLAN = "academiai:sync:event:plan"


class SyncGuard:
    """Context manager that marks object pks currently being synced so the
    corresponding reverse-signal bails out instead of re-syncing (which is
    what would otherwise cause an infinite round-trip)."""

    def __init__(self, keys):
        self.keys = set(keys)

    def __enter__(self):
        self._prev = SYNC_GUARD.get()
        SYNC_GUARD.set(self._prev | self.keys)
        return self

    def __exit__(self, *exc):
        SYNC_GUARD.set(self._prev)


def _guard_active(key):
    return key in SYNC_GUARD.get()


def _local_now():
    """Server-local now (the platform default tz)."""
    tz = ZoneInfo(timezone.get_current_timezone_name())
    return timezone.now().astimezone(tz)


def _project_tz():
    return ZoneInfo(timezone.get_current_timezone_name())


def _day_start(dt):
    return timezone.make_aware(
        datetime.datetime(dt.year, dt.month, dt.day),
        timezone=_project_tz(),
    )


def _day_end(dt):
    return _day_start(dt) + datetime.timedelta(days=1)


# --------------------------------------------------------------------------
# Plan -> Calendar
# --------------------------------------------------------------------------

def sync_plan_to_calendar(plan, *, creating=False):
    """Create/update the calendar representation of a Plan span window."""
    event_key = SYNC_PLAN_EVENT
    if _guard_active(event_key) or _guard_active(f"plan:{plan.id}"):
        return

    if not plan.start_date and not plan.target_date:
        # A plan with no dates has no calendar presence. If a synced event
        # exists for it, remove it (dates were cleared).
        CalendarEvent.objects.filter(tenant_id=plan.tenant_id, plan=plan, metadata__source="plan",
                                    metadata__sync_key="plan").delete()
        return

    with SyncGuard([event_key, f"plan:{plan.id}"]):
        start = _day_start(
            plan.start_date or datetime.date.today(),
        )
        end = _day_end(
            plan.target_date or plan.start_date
            or datetime.date.today(),
        )
        if plan.target_date:
            end = _day_end(plan.target_date)
        else:
            end = start + datetime.timedelta(days=1)

        defaults = {
            "title": plan.title or "Study Plan",
            "description": plan.description,
            "event_type": "study",
            "layer": "personal",
            "start": start,
            "end": end,
            "all_day": True,
            "visibility": "private",
            "user": plan.user,
            "status": "confirmed",
            "metadata": {"source": "plan", "sync_key": "plan"},
        }

        try:
            event = CalendarEvent.objects.get(
                tenant_id=plan.tenant_id, plan=plan, metadata__source="plan",
                metadata__sync_key="plan",
            )
        except CalendarEvent.DoesNotExist:
            CalendarEvent.objects.create(tenant_id=plan.tenant_id, plan=plan, **defaults)
        else:
            event.title = defaults["title"]
            event.description = defaults["description"]
            event.start = defaults["start"]
            event.end = defaults["end"]
            event.all_day = defaults["all_day"]
            event.status = "confirmed"
            event.metadata = {"source": "plan", "sync_key": "plan"}
            event.save(update_fields=[
                "title", "description", "start", "end", "all_day",
                "status", "metadata", "updated_at",
            ])


def _milestone_event_defaults(milestone):
    start = _day_start(milestone.due_date)
    end = start + datetime.timedelta(days=1)
    return {
        "title": milestone.title or f"Milestone · {milestone.plan.title}",
        "description": milestone.description,
        "event_type": "study",
        "layer": "personal",
        "start": start,
        "end": end,
        "all_day": True,
        "visibility": "private",
        "user": milestone.plan.user,
        "status": "confirmed",
        "metadata": {
            "source": "plan",
            "sync_key": f"milestone:{milestone.id}",
        },
    }


def sync_milestone_to_calendar(milestone, *, creating=False):
    key = SYNC_PLAN_MILESTONE_KEYS
    guard_key = f"milestone:{milestone.id}"
    if _guard_active(key) or _guard_active(guard_key):
        return
    if not milestone.due_date:
        # Cleared due date -> drop the synced milestone event.
        CalendarEvent.objects.filter(
            tenant_id=milestone.plan.tenant_id,
            plan=milestone.plan,
            metadata__source="plan",
            metadata__sync_key=f"milestone:{milestone.id}",
        ).delete()
        return

    with SyncGuard([key, guard_key]):
        defaults = _milestone_event_defaults(milestone)
        try:
            event = CalendarEvent.objects.get(
                tenant_id=milestone.plan.tenant_id,
                plan=milestone.plan,
                metadata__source="plan",
                metadata__sync_key=f"milestone:{milestone.id}",
            )
        except CalendarEvent.DoesNotExist:
            CalendarEvent.objects.create(
                tenant_id=milestone.plan.tenant_id, plan=milestone.plan, **defaults,
            )
        else:
            for f in ("title", "description", "start", "end", "all_day", "status", "metadata"):
                setattr(event, f, defaults[f])
            event.save(update_fields=[
                "title", "description", "start", "end", "all_day",
                "status", "metadata", "updated_at",
            ])


def sync_remove_plan_events(plan_id, tenant_id, plan_pk=None):
    """Delete all calendar events linked to a deleted plan."""
    CalendarEvent.objects.filter(
        tenant_id=tenant_id, plan_id=plan_id, metadata__source="plan",
    ).delete()


# --------------------------------------------------------------------------
# Calendar -> Plan
# --------------------------------------------------------------------------

def sync_calendar_event_to_plan(event):
    """Mirror a personal study event created on the Calendar into a Plan.

    Only personal-layer study events that were NOT generated from a plan
    (metadata.source == "plan") are mirrored, to avoid round-tripping. The
    resulting plan is linked via event.plan and stamped
    metadata.source == "calendar" so delete/update flows stay consistent.
    """
    if event.metadata.get("source") == "plan":
        return
    if not (event.layer == "personal" and event.event_type == "study"):
        return
    if event.user is None:
        return

    key = SYNC_EVENT_PLAN
    guard_key = f"event:{event.id}"
    if _guard_active(key) or _guard_active(guard_key):
        return

    with SyncGuard([key, guard_key]):
        # If this event already mirrors a plan, sync dates/title instead.
        if event.plan_id is not None:
            plan = event.plan
            if event.all_day:
                plan.start_date = event.start.date()
                plan.target_date = (event.end or event.start).date()
            else:
                plan.start_date = event.start.date()
                plan.target_date = (event.end or event.start).date()
            plan.title = event.title
            # Guard the plan key so its own post_save cannot re-generate a
            # plan-span calendar event (double representation).
            with SyncGuard([f"plan:{plan.id}"]):
                plan.save(update_fields=["title", "start_date", "target_date", "updated_at"])
            return

        new_id = uuid4()
        # Guard the eventual Plan pk so plan.post_save -> sync_plan_to_calendar
        # bails out (no duplicate plan-span event for a calendar-sourced plan).
        with SyncGuard([f"plan:{new_id}"]):
            plan = Plan.objects.create(
                id=new_id,
                tenant_id=event.tenant_id,
                user=event.user,
                title=event.title or "Study session",
                description=event.description or "",
                plan_type="study",
                status="active",
                start_date=event.start.date(),
                target_date=(event.end or event.start).date(),
            )
        event.metadata = {**event.metadata, "source": "calendar", "plan_id": str(plan.id)}
        event.plan = plan
        event.save(update_fields=["metadata", "plan", "updated_at"])


def sync_update_plan_from_event(event):
    """Update an existing mirrored plan when a calendar event is edited."""
    if event.plan_id is None or event.metadata.get("source") != "calendar":
        return
    key = SYNC_EVENT_PLAN
    guard_key = f"event:{event.id}"
    if _guard_active(key) or _guard_active(guard_key):
        return
    with SyncGuard([key, guard_key]):
        plan = event.plan
        plan.title = event.title
        plan.start_date = event.start.date()
        plan.target_date = (event.end or event.start).date()
        plan.description = event.description or ""
        with SyncGuard([f"plan:{plan.id}"]):
            plan.save(update_fields=[
                "title", "start_date", "target_date", "description", "updated_at",
            ])


def sync_delete_plan_from_event(event):
    """Delete the mirrored plan when its calendar event is deleted."""
    if event.plan_id is None or event.metadata.get("source") != "calendar":
        return
    plan = Plan.objects.filter(id=event.plan_id).first()
    # Break the FK before delete so the pre_delete cascade does not double-run.
    event.plan = None
    if plan is not None:
        plan.delete(keep_parents=True)


# Late imports to avoid circular module resolution at import time.
from apps.calendar.models import CalendarEvent  # noqa: E402
from apps.learning.models import Plan  # noqa: E402
