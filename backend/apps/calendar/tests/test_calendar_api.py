"""
Calendar API + service tests: RBAC layered access, ICS export, tenant isolation.
"""
import datetime

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.calendar.models import CalendarEvent, CalendarLayer
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


def _auth(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _event(tenant, **overrides):
    base = datetime.datetime(2026, 10, 5, 10, 0, tzinfo=datetime.timezone.utc)
    data = {
        "title": "Linear Algebra Lecture",
        "event_type": "lecture",
        "layer": CalendarLayer.ACADEMIC,
        "start": base,
        "end": base + datetime.timedelta(hours=1),
        "venue": "Room 101",
        "course_code": "MAT101",
    }
    data.update(overrides)
    if "created_by" not in data:
        data["created_by"] = None
    return CalendarEvent.objects.create(tenant=tenant, **data)


# ---------------------------------------------------------------- CRUD / RBAC

@pytest.mark.django_db
def test_student_can_create_personal_event():
    tenant = _tenant("cal-stu-create")
    student = _user("stu@cal-stu-create.edu", tenant)

    resp = _auth(student).post(
        "/api/v1/calendar/events/",
        {
            "title": "Study session",
            "layer": "personal",
            "start": "2026-10-06T09:00:00Z",
            "end": "2026-10-06T10:00:00Z",
        },
        format="json",
    )

    assert resp.status_code == 201, resp.data
    event = CalendarEvent.objects.get(title="Study session")
    assert event.tenant == tenant
    assert event.created_by == student
    assert event.user == student
    assert event.visibility == "private"


@pytest.mark.django_db
def test_student_cannot_create_institution_event():
    tenant = _tenant("cal-stu-inst")
    student = _user("stu@cal-stu-inst.edu", tenant)

    resp = _auth(student).post(
        "/api/v1/calendar/events/",
        {
            "title": "Convocation",
            "layer": "institution",
            "start": "2026-10-06T09:00:00Z",
        },
        format="json",
    )

    assert resp.status_code in (400, 403)


@pytest.mark.django_db
def test_tenant_admin_can_create_institution_event():
    tenant = _tenant("cal-admin-inst")
    admin = _user("adm@cal-admin-inst.edu", tenant, role="tenant_admin")

    resp = _auth(admin).post(
        "/api/v1/calendar/events/",
        {
            "title": "Foundation Day",
            "layer": "institution",
            "visibility": "tenant",
            "start": "2026-10-06T09:00:00Z",
            "all_day": True,
        },
        format="json",
    )

    assert resp.status_code == 201, resp.data
    event = CalendarEvent.objects.get(title="Foundation Day")
    assert event.layer == "institution"
    assert event.visibility == "tenant"


@pytest.mark.django_db
def test_lecturer_can_create_office_hours():
    tenant = _tenant("cal-lec-office")
    lecturer = _user("lec@cal-lec-office.edu", tenant, role="lecturer")

    resp = _auth(lecturer).post(
        "/api/v1/calendar/events/",
        {
            "title": "Office Hours",
            "layer": "office_hours",
            "start": "2026-10-07T14:00:00Z",
            "end": "2026-10-07T15:00:00Z",
        },
        format="json",
    )

    assert resp.status_code == 201, resp.data
    event = CalendarEvent.objects.get(title="Office Hours")
    assert event.user == lecturer


@pytest.mark.django_db
def test_student_sees_only_visible_layers():
    tenant = _tenant("cal-see")
    student = _user("stu@cal-see.edu", tenant)
    other_student = _user("other@cal-see.edu", tenant)

    # Personal event for student A.
    personal_a = _event(tenant, layer="personal", user=student, created_by=student,
                        title="A personal", start=datetime.datetime(2026, 10, 5, 9, 0, tzinfo=datetime.timezone.utc))
    # Personal event for student B (should be hidden).
    personal_b = _event(tenant, layer="personal", user=other_student, created_by=other_student,
                        title="B personal", start=datetime.datetime(2026, 10, 5, 11, 0, tzinfo=datetime.timezone.utc))

    resp = _auth(student).get("/api/v1/calendar/events/")
    assert resp.status_code == 200
    data = resp.data.get("results", resp.data)
    titles = [e["title"] for e in data]
    assert "A personal" in titles
    assert "B personal" not in titles


@pytest.mark.django_db
def test_tenant_admin_sees_all_events_in_tenant():
    tenant = _tenant("cal-admin-see")
    student = _user("stu@cal-admin-see.edu", tenant)
    admin = _user("adm@cal-admin-see.edu", tenant, role="tenant_admin")

    _event(tenant, layer="personal", user=student, created_by=student, title="Stu private")

    resp = _auth(admin).get("/api/v1/calendar/events/")
    assert resp.status_code == 200
    data = resp.data.get("results", resp.data)
    assert any(e["title"] == "Stu private" for e in data)


@pytest.mark.django_db
def test_cross_tenant_isolation():
    tenant_a = _tenant("cal-x-a")
    tenant_b = _tenant("cal-x-b")
    user_a = _user("a@cal-x-a.edu", tenant_a)
    user_b = _user("b@cal-x-b.edu", tenant_b)

    event = _event(tenant_a, layer="personal", user=user_a, created_by=user_a, title="SecretA")

    # User B cannot see tenant A's event in list nor detail.
    resp = _auth(user_b).get("/api/v1/calendar/events/")
    data = resp.data.get("results", resp.data)
    assert all(e["id"] != str(event.id) for e in data)

    detail = _auth(user_b).get(f"/api/v1/calendar/events/{event.id}/")
    assert detail.status_code == 404


# ---------------------------------------------------------------- ICS export

@pytest.mark.django_db
def test_ics_export_builds_valid_payload():
    tenant = _tenant("cal-ics")
    student = _user("stu@cal-ics.edu", tenant)
    _event(tenant, layer="personal", user=student, created_by=student,
           title="Study Linear Algebra", description="Ch 1-3",
           start=datetime.datetime(2026, 10, 5, 10, 0, tzinfo=datetime.timezone.utc),
           end=datetime.datetime(2026, 10, 5, 11, 0, tzinfo=datetime.timezone.utc),
           venue="Library")

    from apps.calendar.services.ics import build_ics
    payload = build_ics(CalendarEvent.objects.filter(tenant=tenant))
    assert "BEGIN:VCALENDAR" in payload
    assert "BEGIN:VEVENT" in payload
    assert "SUMMARY:Study Linear Algebra" in payload
    assert "LOCATION:Library" in payload
    assert "DTSTART:20261005T100000Z" in payload
    assert "DTEND:20261005T110000Z" in payload
    assert "END:VCALENDAR" in payload


@pytest.mark.django_db
def test_ics_export_endpoint_returns_download():
    tenant = _tenant("cal-ics-api")
    student = _user("stu@cal-ics-api.edu", tenant)
    _event(tenant, layer="personal", user=student, created_by=student, title="Download me")

    resp = _auth(student).get("/api/v1/calendar/events/export/")
    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("text/calendar")
    assert "BEGIN:VCALENDAR" in resp.content.decode()
    assert "Download me" in resp.content.decode()


@pytest.mark.django_db
def test_ics_escapes_special_characters():
    from apps.calendar.services.ics import build_ics
    tenant = _tenant("cal-ics-esc")
    student = _user("stu@cal-ics-esc.edu", tenant)
    event = _event(tenant, layer="personal", user=student, created_by=student,
                   title="Math; 101, Intro\\Advanced",
                   description="line1\nline2")
    payload = build_ics([event])
    assert r"Math\; 101\, Intro\\Advanced" in payload
    assert "line1\\nline2" in payload


# ---------------------------------------------------------------- Upcoming

@pytest.mark.django_db
def test_upcoming_returns_future_events_only():
    tenant = _tenant("cal-upcoming")
    student = _user("stu@cal-upcoming.edu", tenant)
    past = datetime.datetime(2025, 1, 1, 10, 0, tzinfo=datetime.timezone.utc)
    future = datetime.datetime(2027, 1, 1, 10, 0, tzinfo=datetime.timezone.utc)
    _event(tenant, layer="personal", user=student, created_by=student, title="Old", start=past)
    _event(tenant, layer="personal", user=student, created_by=student, title="New", start=future)

    resp = _auth(student).get("/api/v1/calendar/events/upcoming/")
    assert resp.status_code == 200
    titles = [e["title"] for e in resp.data]
    assert "New" in titles
    assert "Old" not in titles


# ---------------------------------------------------------------- Schedule

@pytest.mark.django_db
def test_only_admin_can_create_schedule():
    tenant = _tenant("cal-schedule")
    student = _user("stu@cal-schedule.edu", tenant)
    admin = _user("adm@cal-schedule.edu", tenant, role="tenant_admin")

    payload = {"import_type": "lecture", "title": "Sem 1 lectures"}

    resp_student = _auth(student).post("/api/v1/calendar/schedules/", payload, format="json")
    assert resp_student.status_code == 403

    resp_admin = _auth(admin).post("/api/v1/calendar/schedules/", payload, format="json")
    assert resp_admin.status_code == 201, resp_admin.data
    assert resp_admin.data["uploaded_by"] == admin.id
    assert resp_admin.data["import_type"] == "lecture"
