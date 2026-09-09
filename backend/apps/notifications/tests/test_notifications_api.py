"""
Contract tests for the notifications feed (apps/notifications):

- Per-role alert derivation from live dashboard state (student/lecturer/admin)
- Badge counts warn/critical only; info items stay in the feed
- Mark-read / mark-all-read
- Unread alerts dropped when the condition clears, read rows kept
- Cross-user and cross-tenant isolation
- Permission gates (anonymous 401, tenant-less 403)
"""
import datetime
from uuid import uuid4

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.academics.models import (
    AcademicSession,
    Course,
    CourseEnrollment,
    CourseOffering,
    Department,
    Faculty,
    LecturerCourseAssignment,
    Semester,
)
from apps.assessments.models import Quiz, QuizAttempt
from apps.notifications import services
from apps.notifications.models import Notification
from apps.resources.models import Resource
from apps.tenants.models import Tenant


PASSWORD = "StrongPass!2026"


def _tenant(slug):
    return Tenant.objects.create(name=f"Uni {slug}", slug=f"{slug}-{uuid4().hex[:8]}")


def _user(email, tenant, role="student"):
    return User.objects.create_user(
        email=email,
        password=PASSWORD,
        tenant=tenant,
        role=role,
        first_name="Test",
        last_name="User",
        is_active=True,
        is_email_verified=True,
    )


def _auth(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _campus(tenant):
    faculty = Faculty.objects.create(tenant=tenant, name="Science", code="SCI")
    department = Department.objects.create(
        tenant=tenant, faculty=faculty, name="Computing", code="COMP",
    )
    course = Course.objects.create(
        tenant=tenant, department=department, code="CS101", title="Computing 101",
    )
    session = AcademicSession.objects.create(
        tenant=tenant, name="2026/2027",
        start_date="2026-09-01", end_date="2027-07-31",
    )
    semester = Semester.objects.create(
        tenant=tenant, academic_session=session, name="First",
        start_date="2026-09-01", end_date="2027-01-31",
    )
    offering = CourseOffering.objects.create(
        tenant=tenant, course=course, academic_session=session, semester=semester,
    )
    return faculty, department, course, session, semester, offering


def _resource(tenant, uploader, **overrides):
    data = {
        "title": "Lecture Notes",
        "visibility_scope": Resource.Visibility.INSTITUTION,
        "processing_status": Resource.ProcessingStatus.READY,
        "uploaded_by": uploader,
        "mime_type": "application/pdf",
    }
    data.update(overrides)
    return Resource.objects.create(tenant=tenant, **data)


def _quiz(tenant, offering, created_by, title="Pop Quiz"):
    quiz = Quiz.objects.create(
        tenant=tenant, course_offering=offering, created_by=created_by,
        title=title, status=Quiz.Status.PUBLISHED,
        due_date=timezone.now() + datetime.timedelta(days=3),
    )
    return quiz


def _notify(user):
    """GET the feed with a guaranteed fresh sync (no stale sync-cache reuse)."""
    services.invalidate_cache(user)
    return _auth(user).get("/api/v1/notifications/")


# ---------------------------------------------------------------- Student


@pytest.mark.django_db
def test_student_alerts_from_dashboard_state():
    tenant = _tenant("ntf-stu")
    student = _user("stu@ntf-stu.edu", tenant, role="student")
    _fac, _dep, _course, _session, _semester, offering = _campus(tenant)

    CourseEnrollment.objects.create(
        tenant=tenant, course_offering=offering, student=student,
    )
    _resource(tenant, student, title="Chem Slides")
    quiz = _quiz(tenant, offering, student, title="Midterm")
    QuizAttempt.objects.create(
        tenant=tenant, quiz=quiz,
        student=student, score=40.0, submitted_at=timezone.now(),
    )

    resp = _notify(student)
    assert resp.status_code == 200
    payload = resp.json()

    keys = {n["kind"] for n in payload["results"]}
    assert "course_behind" in keys
    assert "concept_low" in keys
    assert "quiz_available" in keys
    assert "new_material" in keys

    # Badge counts warn/critical only: course_behind + concept_low.
    assert payload["unread_count"] == 2
    unread_resp = _auth(student).get("/api/v1/notifications/unread-count/")
    assert unread_resp.json()["unread_count"] == 2


@pytest.mark.django_db
def test_info_alerts_stay_in_feed_but_never_light_badge():
    tenant = _tenant("ntf-info")
    student = _user("stu@ntf-info.edu", tenant, role="student")
    _fac, _dep, _course, _session, _semester, offering = _campus(tenant)

    CourseEnrollment.objects.create(
        tenant=tenant, course_offering=offering, student=student,
    )
    _resource(tenant, student, title="OnTrack handout")
    quiz = _quiz(tenant, offering, student, title="Great Quiz")
    for _ in range(5):
        QuizAttempt.objects.create(
            tenant=tenant, quiz=quiz, student=student,
            score=90.0, submitted_at=timezone.now(),
        )

    payload = _notify(student).json()
    kinds = {n["kind"] for n in payload["results"]}
    assert "quiz_available" in kinds
    assert "new_material" in kinds
    assert "course_behind" not in kinds
    assert "concept_low" not in kinds
    assert payload["unread_count"] == 0


@pytest.mark.django_db
def test_mark_read_and_mark_all_read():
    tenant = _tenant("ntf-read")
    student = _user("stu@ntf-read.edu", tenant, role="student")
    _fac, _dep, _course, _session, _semester, offering = _campus(tenant)

    CourseEnrollment.objects.create(
        tenant=tenant, course_offering=offering, student=student,
    )
    quiz = _quiz(tenant, offering, student, title="Read Quiz")
    QuizAttempt.objects.create(
        tenant=tenant, quiz=quiz, student=student,
        score=40.0, submitted_at=timezone.now(),
    )

    feed = _notify(student).json()
    course_behind = next(
        n for n in feed["results"] if n["kind"] == "course_behind"
    )

    resp = _auth(student).post(
        f"/api/v1/notifications/{course_behind['id']}/read/"
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    count = _auth(student).get("/api/v1/notifications/unread-count/").json()
    assert count["unread_count"] == 1

    assert Notification.objects.get(id=course_behind["id"]).is_read is True
    assert Notification.objects.filter(is_read=True).count() == 1

    resp_all = _auth(student).post("/api/v1/notifications/read-all/")
    assert resp_all.status_code == 200
    assert resp_all.json()["updated"] == 2
    assert _auth(student).get("/api/v1/notifications/unread-count/").json()["unread_count"] == 0

    # Re-reading the feed keeps the read history rows.
    kinds = {n["kind"] for n in _notify(student).json()["results"]}
    assert kinds == {"course_behind", "concept_low", "quiz_available"}


@pytest.mark.django_db
def test_unread_alert_dropped_when_condition_clears_read_rows_kept():
    tenant = _tenant("ntf-clear")
    student = _user("stu@ntf-clear.edu", tenant, role="student")
    _fac, _dep, _course, _session, _semester, offering = _campus(tenant)

    CourseEnrollment.objects.create(
        tenant=tenant, course_offering=offering, student=student,
    )
    quiz = _quiz(tenant, offering, student, title="Recover Quiz")
    QuizAttempt.objects.create(
        tenant=tenant, quiz=quiz, student=student,
        score=40.0, submitted_at=timezone.now(),
    )

    feed = _notify(student).json()
    course_behind = next(n for n in feed["results"] if n["kind"] == "course_behind")

    # Dismiss the course-behind alert (read -> kept as history), then the
    # student's performance recovers: 6 attempts * 12 >= 35 means on_track.
    # The still-unread concept_low alert drops entirely when it clears.
    _auth(student).post(f"/api/v1/notifications/{course_behind['id']}/read/")
    for _ in range(5):
        QuizAttempt.objects.create(
            tenant=tenant, quiz=quiz, student=student,
            score=90.0, submitted_at=timezone.now(),
        )

    feed_after = _notify(student).json()
    kinds = {n["kind"] for n in feed_after["results"]}
    assert "course_behind" in kinds  # read row kept as history
    assert "quiz_available" in kinds
    assert "concept_low" not in kinds  # unread alert dropped
    # The recovered course is no longer flagged as behind (unread one gone).
    unread_after = _auth(student).get("/api/v1/notifications/unread-count/").json()
    assert unread_after["unread_count"] == 0
    assert Notification.objects.filter(
        tenant=tenant, user=student,
        key=f"concept_low:{quiz.title}",
    ).count() == 0


# ---------------------------------------------------------------- Roles


@pytest.mark.django_db
def test_lecturer_alerts():
    tenant = _tenant("ntf-lect")
    lecturer = _user("lect@ntf-lect.edu", tenant, role="lecturer")
    student = _user("stu@ntf-lect.edu", tenant, role="student")
    _fac, _dep, _course, _session, _semester, offering = _campus(tenant)

    LecturerCourseAssignment.objects.create(
        tenant=tenant, lecturer=lecturer, course_offering=offering,
    )
    CourseEnrollment.objects.create(
        tenant=tenant, course_offering=offering, student=student,
    )
    quiz = _quiz(tenant, offering, lecturer, title="Risk Quiz")
    QuizAttempt.objects.create(
        tenant=tenant, quiz=quiz, student=student,
        score=30.0, submitted_at=timezone.now(),
    )
    _resource(
        tenant, lecturer, title="Broken slides",
        visibility_scope=Resource.Visibility.COURSE,
        course_offering=offering,
        processing_status=Resource.ProcessingStatus.FAILED,
    )

    payload = _notify(lecturer).json()
    kinds = {n["kind"] for n in payload["results"]}
    assert "students_at_risk" in kinds
    assert "weak_concept" in kinds
    assert "pipeline_failed" in kinds
    assert payload["unread_count"] == 3

    # An unassigned lecturer in the same tenant sees none of it.
    other = _user("other@ntf-lect.edu", tenant, role="lecturer")
    other_feed = _notify(other).json()
    assert other_feed["results"] == []
    assert other_feed["unread_count"] == 0


@pytest.mark.django_db
def test_admin_alerts():
    tenant = _tenant("ntf-admin")
    admin = _user("admin@ntf-admin.edu", tenant, role="tenant_admin")
    _resource(tenant, admin, title="Good material")
    _resource(
        tenant, admin, title="Broken material",
        processing_status=Resource.ProcessingStatus.FAILED,
    )

    payload = _notify(admin).json()
    kinds = {n["kind"] for n in payload["results"]}
    assert "pipeline_failed" in kinds
    assert "material_uploaded" in kinds
    assert payload["unread_count"] == 1


# ---------------------------------------------------------------- Isolation


@pytest.mark.django_db
def test_cross_user_and_cross_tenant_isolation():
    tenant_a = _tenant("ntf-iso-a")
    tenant_b = _tenant("ntf-iso-b")
    student_a = _user("a@ntf-iso-a.edu", tenant_a, role="student")
    student_b = _user("b@ntf-iso-a.edu", tenant_a, role="student")
    student_c = _user("c@ntf-iso-b.edu", tenant_b, role="student")
    _fac, _dep, _course, _session, _semester, offering = _campus(tenant_a)

    CourseEnrollment.objects.create(
        tenant=tenant_a, course_offering=offering, student=student_a,
    )

    feed_a = _notify(student_a).json()
    assert feed_a["results"]

    feed_b = _notify(student_b).json()
    assert feed_b["results"] == []
    assert feed_b["unread_count"] == 0

    # Mark-read cannot touch another user's notification (404).
    other_id = feed_a["results"][0]["id"]
    resp = _auth(student_b).post(f"/api/v1/notifications/{other_id}/read/")
    assert resp.status_code == 404
    assert Notification.objects.filter(user=student_a, is_read=True).count() == 0

    feed_c = _notify(student_c).json()
    assert feed_c["results"] == []
    assert feed_c["unread_count"] == 0


# ---------------------------------------------------------------- Permissions


@pytest.mark.django_db
def test_permission_gates():
    tenant = _tenant("ntf-perm")
    orphan = User.objects.create_user(
        email="orphan@ntf-perm.edu", password=PASSWORD,
        role="student", is_active=True, is_email_verified=True,
    )

    assert APIClient().get("/api/v1/notifications/").status_code == 401
    assert _auth(orphan).get("/api/v1/notifications/").status_code == 403
    assert _auth(orphan).get("/api/v1/notifications/unread-count/").status_code == 403

    user = _user("user@ntf-perm.edu", tenant, role="student")
    # Non-UUID pk is rejected by URL routing; a well-formed unknown UUID 404s.
    assert _auth(user).get("/api/v1/notifications/not-a-uuid/read/").status_code in (400, 404)
    assert _auth(user).post(
        f"/api/v1/notifications/{uuid4()}/read/"
    ).status_code == 404


# ----------------------------------------------------------------------
# Notification kind preferences
# ----------------------------------------------------------------------

def _student_with_course(tenant):
    """A student enrolled in a course, producing a course_behind alert."""
    user = _user("pref@ntf.edu", tenant, role="student")
    _fac, _dep, _course, _session, _semester, offering = _campus(tenant)
    CourseEnrollment.objects.create(
        tenant=tenant, student=user, course_offering=offering,
        status=CourseEnrollment.Status.ENROLLED,
    )
    quiz = _quiz(tenant, offering, user, title="Midterm")
    QuizAttempt.objects.create(
        tenant=tenant, quiz=quiz, student=user,
        score=40.0, submitted_at=timezone.now(),
    )
    return user, offering


@pytest.mark.django_db
def test_preferences_list_returns_full_catalog():
    tenant = _tenant("ntf-pref-list")
    user = _user("prefs@ntf-pref-list.edu", tenant)
    resp = _auth(user).get("/api/v1/notifications/preferences/")
    assert resp.status_code == 200
    kinds = {p["kind"]: p for p in resp.data["preferences"]}
    assert "course_behind" in kinds
    assert kinds["course_behind"]["mutable"] is True
    assert kinds["course_behind"]["enabled"] is True
    # always_on kinds are locked on.
    assert "pipeline_failed" in kinds
    assert kinds["pipeline_failed"]["mutable"] is False
    assert kinds["pipeline_failed"]["enabled"] is True


@pytest.mark.django_db
def test_patch_mutes_kind_and_sync_suppresses_alerts():
    tenant = _tenant("ntf-pref-mute")
    user, offering = _student_with_course(tenant)
    client = _auth(user)

    # Baseline: the course_behind alert is present in the persisted feed.
    services.sync_user_notifications(user, force=True)
    assert Notification.objects.filter(
        tenant_id=tenant.id, user=user, kind="course_behind"
    ).count() == 1

    # Mute course_behind.
    resp = client.patch(
        "/api/v1/notifications/preferences/",
        {"kind": "course_behind", "enabled": False},
        format="json",
    )
    assert resp.status_code == 200
    by_kind = {p["kind"]: p for p in resp.data["preferences"]}
    assert by_kind["course_behind"]["enabled"] is False

    # A fresh sync suppresses the muted kind entirely.
    services.sync_user_notifications(user, force=True)
    assert Notification.objects.filter(
        tenant_id=tenant.id, user=user, kind="course_behind"
    ).count() == 0


@pytest.mark.django_db
def test_always_on_kind_cannot_be_muted():
    tenant = _tenant("ntf-pref-always")
    user = _user("always@ntf-pref-always.edu", tenant, role="lecturer")
    resp = _auth(user).patch(
        "/api/v1/notifications/preferences/",
        {"kind": "pipeline_failed", "enabled": False},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_unknown_kind_rejected_and_tenant_isolated():
    t1 = _tenant("ntf-pref-iso-a")
    t2 = _tenant("ntf-pref-iso-b")
    u1 = _user("iso-a@ntf-pref.edu", t1)
    u2 = _user("iso-b@ntf-pref.edu", t2)

    assert _auth(u1).patch(
        "/api/v1/notifications/preferences/",
        {"kind": "totally_unknown", "enabled": False},
        format="json",
    ).status_code == 400

    _auth(u2).patch(
        "/api/v1/notifications/preferences/",
        {"kind": "concept_low", "enabled": False},
        format="json",
    )
    # Muting one tenant's user must not affect another tenant's user.
    other = {p["kind"]: p for p in _auth(u1).get(
        "/api/v1/notifications/preferences/"
    ).data["preferences"]}
    assert other["concept_low"]["enabled"] is True