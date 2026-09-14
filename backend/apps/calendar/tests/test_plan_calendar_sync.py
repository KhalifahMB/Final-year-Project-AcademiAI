"""
Bi-directional Plan <-> Calendar sync tests.

Plans (and dated milestones) surface onto the Calendar as personal study
events; personal study events created on the Calendar mirror into Plans.
Both directions run via signal handlers in apps.calendar.signals and
apps.learning.signals, guarded so no infinite round-trip occurs.
"""
import datetime

import pytest

from apps.accounts.models import User
from apps.calendar.models import CalendarEvent, CalendarLayer
from apps.learning.models import Plan, PlanMilestone
from apps.tenants.models import Tenant


PASSWORD = "StrongPass!2026"


def _tenant(slug):
    return Tenant.objects.create(name=f"Uni {slug}", slug=slug)


def _user(email, tenant, role="student"):
    return User.objects.create_user(
        email=email,
        password=PASSWORD,
        tenant=tenant,
        role=role,
        is_active=True,
        is_email_verified=True,
    )


# ----------------------------------------------------------- Plan -> Calendar

@pytest.mark.django_db
def test_plan_with_dates_creates_personal_study_event():
    tenant = _tenant("sync-plan-event")
    user = _user("stu@sync-plan-event.edu", tenant)

    plan = Plan.objects.create(
        tenant=tenant, user=user, title="Revise Calculus",
        plan_type="study", status="active",
        start_date=datetime.date(2026, 10, 10),
        target_date=datetime.date(2026, 10, 14),
    )

    events = CalendarEvent.objects.filter(plan=plan)
    assert events.count() == 1
    event = events.get()
    assert event.layer == CalendarLayer.PERSONAL
    assert event.event_type == "study"
    assert event.user == user
    assert event.visibility == "private"
    assert event.all_day is True
    assert event.start.date() == datetime.date(2026, 10, 10)
    assert event.end.date() == datetime.date(2026, 10, 15)  # exclusive end
    assert event.metadata.get("source") == "plan"


@pytest.mark.django_db
def test_plan_without_dates_has_no_calendar_event():
    tenant = _tenant("sync-plan-nodate")
    user = _user("stu@sync-plan-nodate.edu", tenant)

    Plan.objects.create(
        tenant=tenant, user=user, title="Draft plan", plan_type="study",
        status="active", start_date=None, target_date=None,
    )

    assert CalendarEvent.objects.filter(title="Draft plan").count() == 0


@pytest.mark.django_db
def test_plan_update_refreshes_linked_event():
    tenant = _tenant("sync-plan-update")
    user = _user("stu@sync-plan-update.edu", tenant)

    plan = Plan.objects.create(
        tenant=tenant, user=user, title="Original title",
        plan_type="study", status="active",
        start_date=datetime.date(2026, 10, 10),
        target_date=datetime.date(2026, 10, 14),
    )
    event = CalendarEvent.objects.get(plan=plan)
    assert event.title == "Original title"

    plan.title = "Updated title"
    plan.start_date = datetime.date(2026, 11, 1)
    plan.target_date = datetime.date(2026, 11, 5)
    plan.save()

    event.refresh_from_db()
    assert event.title == "Updated title"
    assert event.start.date() == datetime.date(2026, 11, 1)
    assert event.end.date() == datetime.date(2026, 11, 6)


@pytest.mark.django_db
def test_plan_dates_cleared_removes_linked_event():
    tenant = _tenant("sync-plan-clear")
    user = _user("stu@sync-plan-clear.edu", tenant)

    plan = Plan.objects.create(
        tenant=tenant, user=user, title="Temp window",
        plan_type="study", status="active",
        start_date=datetime.date(2026, 10, 10),
        target_date=datetime.date(2026, 10, 14),
    )
    assert CalendarEvent.objects.filter(plan=plan).count() == 1

    plan.start_date = None
    plan.target_date = None
    plan.save()

    assert CalendarEvent.objects.filter(plan=plan).count() == 0


@pytest.mark.django_db
def test_plan_delete_removes_linked_events():
    tenant = _tenant("sync-plan-delete")
    user = _user("stu@sync-plan-delete.edu", tenant)

    plan = Plan.objects.create(
        tenant=tenant, user=user, title="Doomed",
        plan_type="study", status="active",
        start_date=datetime.date(2026, 10, 10),
        target_date=datetime.date(2026, 10, 14),
    )
    milestone = PlanMilestone.objects.create(
        tenant=tenant, plan=plan, title="Doomed MS",
        due_date=datetime.date(2026, 10, 12),
    )
    assert CalendarEvent.objects.filter(plan=plan).count() == 2

    event_ids = set(
        CalendarEvent.objects.filter(plan=plan).values_list("id", flat=True)
    )
    tenant_id = plan.tenant_id
    plan.delete()

    assert CalendarEvent.objects.filter(id__in=event_ids).count() == 0
    assert CalendarEvent.objects.filter(tenant_id=tenant_id, plan_id=plan.id).count() == 0


@pytest.mark.django_db
def test_milestone_with_due_date_creates_study_event():
    tenant = _tenant("sync-ms-event")
    user = _user("stu@sync-ms-event.edu", tenant)

    plan = Plan.objects.create(
        tenant=tenant, user=user, title="Thesis",
        plan_type="study", status="active",
    )
    milestone = PlanMilestone.objects.create(
        tenant=tenant, plan=plan, title="Submit draft",
        due_date=datetime.date(2026, 10, 20),
    )

    event = CalendarEvent.objects.get(
        plan=plan, metadata__sync_key=f"milestone:{milestone.id}"
    )
    assert event.event_type == "study"
    assert event.title == "Submit draft"
    assert event.all_day is True
    assert event.start.date() == datetime.date(2026, 10, 20)


@pytest.mark.django_db
def test_milestone_due_date_change_moves_event():
    tenant = _tenant("sync-ms-move")
    user = _user("stu@sync-ms-move.edu", tenant)

    plan = Plan.objects.create(
        tenant=tenant, user=user, title="Thesis",
        plan_type="study", status="active",
    )
    milestone = PlanMilestone.objects.create(
        tenant=tenant, plan=plan, title="Draft v1",
        due_date=datetime.date(2026, 10, 20),
    )
    event = CalendarEvent.objects.get(
        plan=plan, metadata__sync_key=f"milestone:{milestone.id}"
    )
    assert event.start.date() == datetime.date(2026, 10, 20)

    milestone.due_date = datetime.date(2026, 10, 25)
    milestone.save()

    event.refresh_from_db()
    assert event.start.date() == datetime.date(2026, 10, 25)


@pytest.mark.django_db
def test_milestone_delete_removes_event():
    tenant = _tenant("sync-ms-delete")
    user = _user("stu@sync-ms-delete.edu", tenant)

    plan = Plan.objects.create(
        tenant=tenant, user=user, title="Thesis",
        plan_type="study", status="active",
    )
    milestone = PlanMilestone.objects.create(
        tenant=tenant, plan=plan, title="Draft v2",
        due_date=datetime.date(2026, 10, 20),
    )
    event = CalendarEvent.objects.get(
        plan=plan, metadata__sync_key=f"milestone:{milestone.id}"
    )

    milestone.delete()

    assert not CalendarEvent.objects.filter(id=event.id).exists()


# --------------------------------------------------------- Calendar -> Plan

@pytest.mark.django_db
def test_personal_study_event_creates_linked_plan():
    tenant = _tenant("sync-ev-plan")
    user = _user("stu@sync-ev-plan.edu", tenant)

    event = CalendarEvent.objects.create(
        tenant=tenant, created_by=user, user=user,
        title="Focused study session",
        event_type="study",
        layer=CalendarLayer.PERSONAL,
        start=datetime.datetime(2026, 10, 6, 9, 0, tzinfo=datetime.timezone.utc),
        end=datetime.datetime(2026, 10, 6, 10, 0, tzinfo=datetime.timezone.utc),
        visibility="private",
    )

    event.refresh_from_db()
    assert event.plan_id is not None
    plan = event.plan

    assert plan.user == user
    assert plan.plan_type == "study"
    assert plan.status == "active"
    assert plan.title == "Focused study session"
    assert plan.start_date == datetime.date(2026, 10, 6)
    assert plan.target_date == datetime.date(2026, 10, 6)
    assert event.metadata.get("source") == "calendar"


@pytest.mark.django_db
def test_personal_study_event_does_not_roundtrip_to_duplicate_event():
    tenant = _tenant("sync-ev-norecurse")
    user = _user("stu@sync-ev-norecurse.edu", tenant)

    CalendarEvent.objects.create(
        tenant=tenant, created_by=user, user=user,
        title="Study hard",
        event_type="study",
        layer=CalendarLayer.PERSONAL,
        start=datetime.datetime(2026, 10, 6, 9, 0, tzinfo=datetime.timezone.utc),
        end=datetime.datetime(2026, 10, 6, 10, 0, tzinfo=datetime.timezone.utc),
        visibility="private",
    )

    # The mirrored plan must NOT generate its own plan-span event (that
    # would double-represent one calendar entry and could infinitely recurse).
    plan = Plan.objects.get(title="Study hard")
    assert CalendarEvent.objects.filter(plan=plan, metadata__source="plan").count() == 0
    assert CalendarEvent.objects.filter(plan=plan).count() == 1


@pytest.mark.django_db
def test_non_personal_event_does_not_create_plan():
    tenant = _tenant("sync-ev-noplan")
    user = _user("stu@sync-ev-noplan.edu", tenant)

    CalendarEvent.objects.create(
        tenant=tenant, created_by=user,
        title="Linear Algebra",
        event_type="lecture",
        layer=CalendarLayer.ACADEMIC,
        start=datetime.datetime(2026, 10, 6, 9, 0, tzinfo=datetime.timezone.utc),
        end=datetime.datetime(2026, 10, 6, 10, 0, tzinfo=datetime.timezone.utc),
    )

    assert Plan.objects.count() == 0


@pytest.mark.django_db
def test_editing_calendar_event_updates_mirrored_plan():
    tenant = _tenant("sync-ev-update")
    user = _user("stu@sync-ev-update.edu", tenant)

    event = CalendarEvent.objects.create(
        tenant=tenant, created_by=user, user=user,
        title="Revise topic",
        event_type="study",
        layer=CalendarLayer.PERSONAL,
        start=datetime.datetime(2026, 10, 6, 9, 0, tzinfo=datetime.timezone.utc),
        end=datetime.datetime(2026, 10, 6, 10, 0, tzinfo=datetime.timezone.utc),
        visibility="private",
    )
    plan = Plan.objects.get(title="Revise topic")

    event.title = "Revise harder"
    event.start = datetime.datetime(2026, 10, 8, 9, 0, tzinfo=datetime.timezone.utc)
    event.end = datetime.datetime(2026, 10, 8, 10, 0, tzinfo=datetime.timezone.utc)
    event.save()

    plan.refresh_from_db()
    assert plan.title == "Revise harder"
    assert plan.start_date == datetime.date(2026, 10, 8)
    assert plan.target_date == datetime.date(2026, 10, 8)


@pytest.mark.django_db
def test_deleting_calendar_event_deletes_mirrored_plan():
    tenant = _tenant("sync-ev-delete")
    user = _user("stu@sync-ev-delete.edu", tenant)

    event = CalendarEvent.objects.create(
        tenant=tenant, created_by=user, user=user,
        title="Transient session",
        event_type="study",
        layer=CalendarLayer.PERSONAL,
        start=datetime.datetime(2026, 10, 6, 9, 0, tzinfo=datetime.timezone.utc),
        end=datetime.datetime(2026, 10, 6, 10, 0, tzinfo=datetime.timezone.utc),
        visibility="private",
    )
    plan_id = Plan.objects.get(title="Transient session").id

    event.delete()

    assert not Plan.objects.filter(id=plan_id).exists()


# ------------------------------------------------------------- Isolation

@pytest.mark.django_db
def test_sync_respects_tenant_scoping():
    tenant_a = _tenant("sync-iso-a")
    tenant_b = _tenant("sync-iso-b")
    user_a = _user("a@sync-iso-a.edu", tenant_a)
    user_b = _user("b@sync-iso-b.edu", tenant_b)

    Plan.objects.create(
        tenant=tenant_a, user=user_a, title="Plan A",
        plan_type="study", status="active",
        start_date=datetime.date(2026, 10, 10),
        target_date=datetime.date(2026, 10, 14),
    )
    CalendarEvent.objects.create(
        tenant=tenant_b, created_by=user_b, user=user_b,
        title="Session B", event_type="study",
        layer=CalendarLayer.PERSONAL,
        start=datetime.datetime(2026, 10, 6, 9, 0, tzinfo=datetime.timezone.utc),
        end=datetime.datetime(2026, 10, 6, 10, 0, tzinfo=datetime.timezone.utc),
        visibility="private",
    )

    assert CalendarEvent.objects.filter(tenant_id=tenant_a.id).count() == 1
    assert CalendarEvent.objects.filter(tenant_id=tenant_a.id).get().title == "Plan A"
    assert CalendarEvent.objects.filter(tenant_id=tenant_b.id).get().title == "Session B"
    assert Plan.objects.filter(tenant_id=tenant_a.id).count() == 1
    assert Plan.objects.filter(tenant_id=tenant_b.id).count() == 1


@pytest.mark.django_db
def test_plan_signal_fires_only_once_for_duplicate_saves():
    tenant = _tenant("sync-once")
    user = _user("stu@sync-once.edu", tenant)
    plan = Plan.objects.create(
        tenant=tenant, user=user, title="One event",
        plan_type="study", status="active",
        start_date=datetime.date(2026, 10, 10),
        target_date=datetime.date(2026, 10, 14),
    )

    # Re-save the same plan: the linked event is updated, not duplicated.
    plan.title = "One event v2"
    plan.save()
    assert CalendarEvent.objects.filter(plan=plan).count() == 1
    assert CalendarEvent.objects.filter(plan=plan).get().title == "One event v2"