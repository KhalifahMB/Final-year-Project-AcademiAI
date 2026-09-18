"""
Calendar API + service tests: RBAC layered access, ICS export, tenant isolation.
"""
import datetime

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.calendar.models import CalendarEvent, CalendarLayer, CalendarSchedule
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
    _event(tenant, layer="personal", user=student, created_by=student, title="Old",
           start=past, end=past + datetime.timedelta(hours=1))
    _event(tenant, layer="personal", user=student, created_by=student, title="New",
           start=future, end=future + datetime.timedelta(hours=1))

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


# ---------------------------------------------------------------- Layers

@pytest.mark.django_db
def test_layers_returns_role_defaults():
    tenant = _tenant("cal-layers")
    student = _user("stu@cal-layers.edu", tenant)
    lecturer = _user("lec@cal-layers.edu", tenant, role="lecturer")
    admin = _user("adm@cal-layers.edu", tenant, role="tenant_admin")

    student_layers = _auth(student).get("/api/v1/calendar/events/layers/")
    assert student_layers.status_code == 200
    assert student_layers.data["default_layers"] == ["personal", "academic", "exams", "institution"]

    lecturer_layers = _auth(lecturer).get("/api/v1/calendar/events/layers/")
    assert lecturer_layers.status_code == 200
    assert lecturer_layers.data["default_layers"] == [
        "personal", "academic", "office_hours", "institution",
    ]

    admin_layers = _auth(admin).get("/api/v1/calendar/events/layers/")
    assert admin_layers.status_code == 200
    assert {"personal", "academic", "exams", "office_hours", "institution"} == {
        item["key"] for item in admin_layers.data["all_layers"]
    }


# ---------------------------------------------------------------- Import wizard

@pytest.mark.django_db
def test_schedule_preview_returns_validated_rows():
    tenant = _tenant("cal-preview")
    admin = _user("adm@cal-preview.edu", tenant, role="tenant_admin")

    csv_bytes = (
        "title,start,end,layer,venue\n"
        "Intro to CS,2026-09-15 09:00,2026-09-15 10:00,academic,LT-1\n"
        "Bad row,2026-09-16 09:00,2026-09-16 08:00,academic,LT-2\n"
        "Broken session,,,personal,\n"
    ).encode("utf-8")

    import io
    from rest_framework.parsers import MultiPartParser

    client = _auth(admin)
    resp = client.post(
        "/api/v1/calendar/schedules/preview/",
        {"source_format": "csv", "file": io.BytesIO(csv_bytes)},
        format="multipart",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["row_count"] == 1
    assert any("Bad row" in w for w in resp.data["warnings"])
    assert any("Broken session" in w for w in resp.data["warnings"])


@pytest.mark.django_db
def test_schedule_preview_requires_admin():
    tenant = _tenant("cal-preview-rbac")
    student = _user("stu@cal-preview-rbac.edu", tenant)

    import io

    csv_bytes = b"title,start,end,layer\nA,2026-09-15 09:00,2026-09-15 10:00,academic"
    resp = _auth(student).post(
        "/api/v1/calendar/schedules/preview/",
        {"source_format": "csv", "file": io.BytesIO(csv_bytes)},
        format="multipart",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_schedule_commit_creates_events():
    tenant = _tenant("cal-commit")
    admin = _user("adm@cal-commit.edu", tenant, role="tenant_admin")

    csv_bytes = (
        "title,start,end,layer,venue,course_code\n"
        "Intro to CS,2026-09-15 09:00,2026-09-15 10:00,academic,LT-1,CS101\n"
        "Final Exam,2026-12-01 09:00,2026-12-01 11:00,exams,MC-2,CS101\n"
    ).encode("utf-8")

    import io

    resp = _auth(admin).post(
        "/api/v1/calendar/schedules/preview-commit/",
        {
            "source_format": "csv",
            "import_type": "lecture",
            "title": "Sem 1 timetable",
            "file": io.BytesIO(csv_bytes),
        },
        format="multipart",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["success"] is True
    assert resp.data["event_count"] == 2

    schedule = CalendarSchedule.objects.get(tenant=tenant)
    assert schedule.committed is True
    assert schedule.import_type == "lecture"

    events = CalendarEvent.objects.filter(tenant=tenant)
    assert events.count() == 2
    assert events.filter(layer=CalendarLayer.ACADEMIC, course_code="CS101").exists()
    assert events.filter(layer=CalendarLayer.EXAMS, course_code="CS101").exists()


@pytest.mark.django_db
def test_schedule_template_download():
    tenant = _tenant("cal-template")
    admin = _user("adm@cal-template.edu", tenant, role="tenant_admin")

    resp = _auth(admin).get("/api/v1/calendar/schedules/template/")
    assert resp.status_code == 200
    body = resp.content.decode("utf-8")
    assert body.startswith("title,start,end")
    assert "Intro to CS" in body


# ── Offering linkage + student visibility ────────────────────────────

def _academics_structure(tenant):
    from apps.academics.models import (
        AcademicSession, Course, CourseOffering, Department, Faculty, Semester,
    )
    fac = Faculty.objects.create(tenant=tenant, name="Computing", code="FOC")
    dept = Department.objects.create(tenant=tenant, faculty=fac, name="CS", code="CS")
    session = AcademicSession.objects.create(
        tenant=tenant, name="2025/2026", is_current=True,
        start_date="2025-09-01", end_date="2026-08-31",
    )
    semester = Semester.objects.create(
        tenant=tenant, academic_session=session, name="Second Semester", is_current=True,
        start_date="2026-02-01", end_date="2026-07-01",
    )
    return fac, dept, session, semester


def _make_offering(tenant, dept, session, semester, code="CS524"):
    from apps.academics.models import Course, CourseOffering
    course = Course.objects.create(tenant=tenant, department=dept, code=code, title=code)
    offering = CourseOffering.objects.create(
        tenant=tenant, course=course, academic_session=session, semester=semester,
    )
    return course, offering


@pytest.mark.django_db
def test_imported_exam_links_to_offering():
    tenant = _tenant("cal-link-offering")
    admin = _user("adm@cal-link-offering.edu", tenant, role="tenant_admin")
    fac, dept, session, semester = _academics_structure(tenant)
    _make_offering(tenant, dept, session, semester, "CS524")

    csv_bytes = (
        "title,start,end,layer,course_code\n"
        "CS524 Exam,2026-10-01 09:30,2026-10-01 12:30,exams,CS524\n"
    ).encode()
    import io

    resp = _auth(admin).post(
        "/api/v1/calendar/schedules/preview-commit/",
        {
            "source_format": "csv",
            "import_type": "exam",
            "title": "Exam timetable",
            "file": io.BytesIO(csv_bytes),
        },
        format="multipart",
    )
    assert resp.status_code == 200
    event = CalendarEvent.objects.get(tenant=tenant, course_code="CS524")
    assert event.course_offering is not None
    assert event.course_offering.course.code == "CS524"


@pytest.mark.django_db
def test_student_sees_imported_exam_for_enrolled_offering():
    from apps.academics.models import CourseEnrollment

    tenant = _tenant("cal-stu-exam-vis")
    admin = _user("adm@cal-stu-exam-vis.edu", tenant, role="tenant_admin")
    student = _user("stu@cal-stu-exam-vis.edu", tenant, role="student")
    fac, dept, session, semester = _academics_structure(tenant)
    _, offering = _make_offering(tenant, dept, session, semester, "CS524")
    CourseEnrollment.objects.create(
        tenant=tenant, course_offering=offering, student=student,
        status=CourseEnrollment.Status.ENROLLED,
    )

    csv_bytes = (
        "title,start,end,layer,course_code\n"
        "CS524 Exam,2026-10-01 09:30,2026-10-01 12:30,exams,CS524\n"
    ).encode()
    import io

    resp = _auth(admin).post(
        "/api/v1/calendar/schedules/preview-commit/",
        {
            "source_format": "csv",
            "import_type": "exam",
            "title": "Exam timetable",
            "file": io.BytesIO(csv_bytes),
        },
        format="multipart",
    )
    assert resp.status_code == 200

    student_resp = _auth(student).get("/api/v1/calendar/events/")
    assert student_resp.status_code == 200
    titles = [e["title"] for e in student_resp.data.get("results", student_resp.data)]
    assert "CS524 Exam" in titles


@pytest.mark.django_db
def test_student_invisible_to_unlinked_exam():
    tenant = _tenant("cal-stu-invis")
    admin = _user("adm@cal-stu-invis.edu", tenant, role="tenant_admin")
    student = _user("stu@cal-stu-invis.edu", tenant, role="student")

    csv_bytes = (
        "title,start,end,layer,course_code\n"
        "Mystery Exam,2026-10-01 09:30,2026-10-01 12:30,exams,UNKNOWN99\n"
    ).encode()
    import io

    resp = _auth(admin).post(
        "/api/v1/calendar/schedules/preview-commit/",
        {
            "source_format": "csv",
            "import_type": "exam",
            "title": "Exam timetable",
            "file": io.BytesIO(csv_bytes),
        },
        format="multipart",
    )
    assert resp.status_code == 200

    student_resp = _auth(student).get("/api/v1/calendar/events/")
    assert student_resp.status_code == 200
    results = student_resp.data.get("results", student_resp.data)
    assert len([e for e in results if e.get("layer") == "exams"]) == 0


@pytest.mark.django_db
def test_multi_day_event_spanning_month_boundary_shows_in_both_months():
    """An event that starts in one month but ends in the next must be
    returned by the lightweight grid query for BOTH month ranges.
    """
    tenant = _tenant("cal-span-boundary")
    admin = _user("adm@cal-span-boundary.edu", tenant, role="tenant_admin")

    event = _event(
        tenant,
        title="Field Trip",
        layer=CalendarLayer.INSTITUTION,
        visibility="tenant",
        start=datetime.datetime(2026, 9, 28, 8, 0, tzinfo=datetime.timezone.utc),
        end=datetime.datetime(2026, 10, 2, 17, 0, tzinfo=datetime.timezone.utc),
    )

    def light_titles(month_start, month_end):
        resp = _auth(admin).get(
            "/api/v1/calendar/events/",
            {
                "light": "1",
                "start": month_start,
                "end": month_end,
            },
        )
        assert resp.status_code == 200
        return [str(e["id"]) for e in resp.data.get("results", resp.data)]

    september = light_titles("2026-09-01T00:00:00Z", "2026-09-30T23:59:59Z")
    october = light_titles("2026-10-01T00:00:00Z", "2026-10-31T23:59:59Z")

    assert str(event.id) in september
    assert str(event.id) in october

    # A November range that the event does not touch must NOT return it.
    november = light_titles("2026-11-01T00:00:00Z", "2026-11-30T23:59:59Z")
    assert str(event.id) not in november
