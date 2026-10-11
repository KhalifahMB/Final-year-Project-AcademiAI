"""
Acceptance matrix — one test per row of the verification brief.

Each test is named after its matrix row (``test_row_NN_*``) so the pytest
report maps 1:1 onto the table. Docstrings state the brief's expected
behaviour; where the shipped implementation differs, the test asserts the
*actual* behaviour and the docstring records the deviation.

Rows (as verified here):
  01  RBAC  — student cannot read admin analytics
  02  RBAC  — lecturer cannot read another course's roster
  03  Auth  — valid login returns JWT access+refresh
  04  Auth  — wrong password is rejected (401)
  05  Auth  — an expired access token is rejected (401)
  06  Upload (lecturer) — create tenant-visible PDF + presigned + complete
  07  Upload (student)  — create with no scope; owner-only visibility
  08a Upload           — disallowed file type rejected (400)
  08b Upload           — malware (EICAR) rejected (400)
  09  Ingestion        — PDF chunked + embedded, resource becomes ready
  10  Summarize        — async summary queued then persisted
  11  Chat RAG         — answer cites the retrieved chunk

Run:  pytest apps/common/tests/test_acceptance_matrix.py -v -s -n 0
"""
from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

import pytest
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import User
from apps.academics.models import (
    AcademicSession,
    Course,
    CourseEnrollment,
    CourseOffering,
    Department,
    Faculty,
    Semester,
)
from apps.audit.models import AuditLog
from apps.chat.models import ChatMessageSource, ChatSession
from apps.resources.models import Resource, ResourceChunk, ResourceSummary, ResourceVersion
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026"


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _tenant(slug):
    return Tenant.objects.create(name=f"Univ {slug}", slug=slug)


def _user(tenant, email, role="student", **extra):
    return User.objects.create_user(
        email=email,
        password=PASSWORD,
        tenant=tenant,
        role=role,
        is_active=True,
        is_email_verified=True,
        **extra,
    )


def _auth(user):
    """Force-authenticated client with the per-request authz cache reset.

    ``force_authenticate`` reuses the same Python user instance across
    requests, and ``_authorized_resource_ids`` memoizes on it — so clear the
    memo before each request to avoid a stale scope from an earlier write.
    """
    if hasattr(user, "_authorized_resource_ids_cache"):
        del user._authorized_resource_ids_cache
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _make_pdf(text="Water cycle: evaporation, condensation, precipitation."):
    """Minimal single-page PDF with extractable text (no external libs)."""
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
    ]
    stream = ("BT /F1 18 Tf 72 720 Td (%s) Tj ET" % text).encode("latin-1")
    objs.append(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    out = b"%PDF-1.4\n"
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    xref_pos = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for off in offsets:
        out += ("%010d 00000 n \n" % off).encode()
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objs) + 1,
        xref_pos,
    )
    return out


def _structure(tenant):
    fac = Faculty.objects.create(tenant=tenant, name="Science", code="SCI")
    dept = Department.objects.create(tenant=tenant, faculty=fac, name="CS", code="CS")
    session = AcademicSession.objects.create(
        tenant=tenant, name="2025/2026", is_current=True,
        start_date="2025-09-01", end_date="2026-08-31",
    )
    semester = Semester.objects.create(
        tenant=tenant, academic_session=session, name="First", is_current=True,
        start_date="2025-09-01", end_date="2026-01-31",
    )
    return dept, session, semester


def _offering(tenant, dept, session, semester, code):
    course = Course.objects.create(tenant=tenant, department=dept, code=code, title=f"Course {code}")
    return CourseOffering.objects.create(
        tenant=tenant, course=course, academic_session=session, semester=semester, status="active",
    )


def _ready_resource(tenant, owner, scope=Resource.Visibility.INSTITUTION, chunk_text=None):
    res = Resource.objects.create(
        tenant=tenant, title="Notes", uploaded_by=owner,
        visibility_scope=scope, mime_type="application/pdf",
        processing_status=Resource.ProcessingStatus.READY, has_extractable_text=True,
        storage_key=f"tenants/{tenant.id}/resources/x/stub",
    )
    version = ResourceVersion.objects.create(
        tenant=tenant, resource=res, version_number=1,
        storage_key=res.storage_key, created_by=owner,
    )
    chunk = None
    if chunk_text:
        chunk = ResourceChunk.objects.create(
            tenant=tenant, resource_version=version, chunk_index=0,
            content=chunk_text, embedding=[0.0] * settings.EMBEDDING_DIMENSION,
        )
    return res, version, chunk


class _FakeS3:
    """Minimal S3 stand-in for ingestion's get_object call."""

    def __init__(self, data, content_type):
        self._data = data
        self._content_type = content_type

    def get_object(self, Bucket=None, Key=None):  # noqa: N803 - boto3 kwarg names
        return {"Body": BytesIO(self._data), "ContentType": self._content_type}


# --------------------------------------------------------------------------- #
# row 01 — RBAC: student blocked from admin analytics
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_row_01_student_blocked_from_admin_analytics():
    tenant = _tenant("rbac-01")
    student = _user(tenant, "s@rbac01.edu")

    # The brief's literal path does not exist -> 404 (not 403).
    literal = _auth(student).get("/api/v1/admin/usage/")
    assert literal.status_code == 404

    # The real admin-analytics surface in this codebase is /dashboard/admin/.
    real = _auth(student).get("/api/v1/dashboard/admin/")
    assert real.status_code == 403

    print("ROW 01 actual: /admin/usage -> 404 (route absent); /dashboard/admin -> 403")


# --------------------------------------------------------------------------- #
# row 02 — RBAC: lecturer cannot read another course's roster
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_row_02_lecturer_blocked_from_other_course_roster():
    tenant = _tenant("rbac-02")
    dept, session, semester = _structure(tenant)
    offering_a = _offering(tenant, dept, session, semester, "A101")
    offering_b = _offering(tenant, dept, session, semester, "B101")

    lecturer = _user(tenant, "l@rbac02.edu", role="lecturer")
    student = _user(tenant, "st@rbac02.edu", role="student")
    CourseEnrollment.objects.create(
        tenant=tenant, course_offering=offering_b, student=student,
        status=CourseEnrollment.Status.ENROLLED,
    )

    client = _auth(lecturer)
    # The brief's literal path does not exist -> 404.
    literal = client.get(f"/api/v1/courses/{offering_b.course_id}/roster/")
    assert literal.status_code == 404

    # Real roster surface is the admin-only enrollment list -> 403 for a lecturer,
    # even when filtered to another course's offering.
    real = _auth(lecturer).get(f"/api/v1/course-enrollments/?course_offering={offering_b.id}")
    assert real.status_code == 403

    print("ROW 02 actual: /courses/{id}/roster -> 404; /course-enrollments -> 403")


# --------------------------------------------------------------------------- #
# row 03 — Auth: valid login returns a JWT
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_row_03_login_valid_returns_jwt():
    tenant = _tenant("auth-03")
    user = _user(tenant, "u@auth03.edu", role="lecturer")

    resp = APIClient().post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": PASSWORD},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data.get("access") and resp.data.get("refresh")
    assert resp.data["user"]["email"] == user.email

    print("ROW 03 actual: 200 with access+refresh tokens")


# --------------------------------------------------------------------------- #
# row 04 — Auth: wrong password rejected
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_row_04_login_wrong_password_401():
    tenant = _tenant("auth-04")
    user = _user(tenant, "u@auth04.edu")

    resp = APIClient().post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": "definitely-wrong"},
        format="json",
    )
    assert resp.status_code == 401

    print("ROW 04 actual: 401 invalid credentials")


# --------------------------------------------------------------------------- #
# row 05 — Auth: expired token rejected
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_row_05_expired_token_401():
    tenant = _tenant("auth-05")
    user = _user(tenant, "u@auth05.edu")

    token = AccessToken()
    token["user_id"] = str(user.id)
    # exp = (now - 1 day) + 30s  -> already expired.
    token.set_exp(from_time=timezone.now() - timedelta(days=1), lifetime=timedelta(seconds=30))

    client = APIClient()
    resp = client.get("/api/v1/auth/me/", HTTP_AUTHORIZATION=f"Bearer {token}")
    assert resp.status_code == 401

    print("ROW 05 actual: 401 for expired access token")


# --------------------------------------------------------------------------- #
# row 06 — Upload: lecturer PDF, tenant-visible
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
@patch("apps.resources.tasks.process_resource_ingestion.delay")
def test_row_06_lecturer_uploads_tenant_visible_pdf(mock_delay):
    mock_delay.return_value.id = "task-06"
    tenant = _tenant("up-06")
    lecturer = _user(tenant, "l@up06.edu", role="lecturer")
    client = _auth(lecturer)

    # "public" is not a valid scope token in this codebase; the tenant-wide
    # equivalent is "institution". Assert the rejection and use the real token.
    bad = client.post(
        "/api/v1/resources/",
        {"title": "Bad", "visibility_scope": "public", "mime_type": "application/pdf"},
        format="json",
    )
    assert bad.status_code == 400, bad.data

    created = _auth(lecturer).post(
        "/api/v1/resources/",
        {"title": "Lecture notes", "visibility_scope": "institution", "mime_type": "application/pdf"},
        format="json",
    )
    assert created.status_code == 201, created.data
    rid = created.data["id"]
    assert created.data["visibility_scope"] == "institution"

    presign = _auth(lecturer).post(
        f"/api/v1/resources/{rid}/request_upload_url/",
        {"content_type": "application/pdf"},
        format="json",
    )
    assert presign.status_code == 200, presign.data
    key = presign.data["storage_key"]
    assert key.startswith(f"tenants/{tenant.id}/resources/{rid}/")

    done = _auth(lecturer).post(
        f"/api/v1/resources/{rid}/complete_upload/",
        {"storage_key": key, "content_type": "application/pdf"},
        format="json",
    )
    assert done.status_code == 200, done.data
    assert done.data["status"] == "pending"
    mock_delay.assert_called_once()

    print(f"ROW 06 actual: 201+presign+200; visibility_scope='institution' (public=>400); job={done.data['job_id']}")


# --------------------------------------------------------------------------- #
# row 07 — Upload: student default scope + owner-only visibility
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_row_07_student_default_scope_owner_only():
    tenant = _tenant("up-07")
    student = _user(tenant, "s@up07.edu")
    other = _user(tenant, "o@up07.edu")

    resp = _auth(student).post(
        "/api/v1/resources/",
        {"title": "My PDF", "mime_type": "application/pdf"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    rid = resp.data["id"]

    # Brief expects "private"; the shipped default is "course" (model default).
    actual_scope = resp.data["visibility_scope"]
    assert actual_scope == "course"

    # But the effective behaviour matches the brief: only the uploader can read
    # it (a COURSE resource with no offering is uploader-only).
    assert _auth(student).get(f"/api/v1/resources/{rid}/").status_code == 200
    assert _auth(other).get(f"/api/v1/resources/{rid}/").status_code == 404

    print(f"ROW 07 actual: 201; visibility_scope='{actual_scope}' (brief says private); other user -> 404")


# --------------------------------------------------------------------------- #
# row 08a — Upload: disallowed file type rejected
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_row_08a_disallowed_file_type_400():
    tenant = _tenant("up-08a")
    student = _user(tenant, "s@up08a.edu")

    upload = SimpleUploadedFile("evil.exe", b"MZ\x90\x00fake-binary", content_type="application/x-msdownload")
    resp = _auth(student).post("/api/v1/chat/upload/", {"file": upload}, format="multipart")

    assert resp.status_code == 400, resp.data
    assert "Disallowed content type" in str(resp.data)
    assert Resource.objects.filter(tenant=tenant).count() == 0

    print("ROW 08a actual: 400 'Disallowed content type' (rejected before storage)")


# --------------------------------------------------------------------------- #
# row 08b — Upload: malware (EICAR) rejected
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_row_08b_malware_eicar_rejected():
    tenant = _tenant("up-08b")
    student = _user(tenant, "s@up08b.edu")

    eicar = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    upload = SimpleUploadedFile("sneaky.pdf", eicar, content_type="application/pdf")
    resp = _auth(student).post("/api/v1/chat/upload/", {"file": upload}, format="multipart")

    assert resp.status_code == 400, resp.data
    assert "EICAR" in str(resp.data)
    # Brief expects quarantine + status=failed + no chunks. Actual: the upload
    # is rejected outright, so no resource/version/chunk is ever created.
    assert Resource.objects.filter(tenant=tenant).count() == 0
    assert ResourceChunk.objects.filter(tenant=tenant).count() == 0

    print("ROW 08b actual: 400 'Malware signature detected (EICAR)' — rejected pre-storage, no quarantine row")


# --------------------------------------------------------------------------- #
# row 09 — Ingestion: PDF chunked + embedded
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_row_09_ingestion_chunks_and_embeds():
    from apps.resources.tasks import process_resource_ingestion

    tenant = _tenant("ing-09")
    lecturer = _user(tenant, "l@ing09.edu", role="lecturer")
    pdf = _make_pdf()
    res = Resource.objects.create(
        tenant=tenant, title="Long PDF", uploaded_by=lecturer,
        visibility_scope=Resource.Visibility.PRIVATE, mime_type="application/pdf",
        processing_status=Resource.ProcessingStatus.PENDING,
    )
    version = ResourceVersion.objects.create(
        tenant=tenant, resource=res, version_number=1,
        storage_key=f"tenants/{tenant.id}/resources/{res.id}/file.pdf", created_by=lecturer,
    )

    dim = settings.EMBEDDING_DIMENSION
    with patch("apps.common.storage.get_s3_client", return_value=_FakeS3(pdf, "application/pdf")), \
         patch("apps.common.ai.generate_embeddings", side_effect=lambda texts: [[0.1] * dim for _ in texts]), \
         patch("apps.common.ai.extract_concepts", return_value={"concepts": [], "relations": []}):
        result = process_resource_ingestion.run(str(res.id), str(version.id), str(tenant.id))

    res.refresh_from_db()
    chunks = list(ResourceChunk.objects.filter(tenant=tenant, resource_version=version))

    assert result["status"] == "completed", result
    assert len(chunks) >= 1
    assert res.processing_status == Resource.ProcessingStatus.READY
    assert all(c.embedding is not None and len(c.embedding) == dim for c in chunks)

    # The brief also claims an AuditLog row is written by ingestion. It is not:
    # ingestion writes no audit entry (resource.create does, when going via API).
    assert AuditLog.objects.filter(tenant=tenant).count() == 0

    print(f"ROW 09 actual: status=ready, chunks={len(chunks)}, embeddings non-null; AuditLog rows=0 (claim false)")


# --------------------------------------------------------------------------- #
# row 10 — Summarize: async summary queued + persisted
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
@patch("apps.resources.views.ai_service_available", return_value=True)
def test_row_10_summarize_async_then_persisted(_ai_ok):
    from apps.resources.summary_tasks import summarize_resource_task

    tenant = _tenant("sum-10")
    student = _user(tenant, "s@sum10.edu")
    res, _version, _chunk = _ready_resource(
        tenant, student, chunk_text="Evaporation and condensation drive the water cycle.",
    )

    with patch("apps.resources.summary_tasks.summarize_resource_task.delay") as delay:
        delay.return_value.id = "task-10"
        resp = _auth(student).post(f"/api/v1/resources/{res.id}/summarize/")
    assert resp.status_code == 202, resp.data
    assert resp.data["job_id"] == "task-10"

    with patch(
        "apps.common.ai.generate_summary",
        return_value={"summary": "Water moves through evaporation and condensation.", "key_points": ["evaporation"]},
    ):
        result = summarize_resource_task.run(str(res.id), str(tenant.id), str(student.id))

    assert result["status"] == "completed", result
    saved = ResourceSummary.objects.filter(tenant=tenant, resource=res).first()
    assert saved is not None and saved.summary

    print("ROW 10 actual: 202 + job_id (async, not streamed); summary persisted on task run")


# --------------------------------------------------------------------------- #
# row 11 — Chat RAG: answer cites the retrieved chunk
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_row_11_chat_rag_cites_retrieved_chunk():
    tenant = _tenant("rag-11")
    lecturer = _user(tenant, "l@rag11.edu", role="lecturer")
    student = _user(tenant, "s@rag11.edu")
    res, _version, chunk = _ready_resource(
        tenant, lecturer, chunk_text="Photosynthesis converts light into chemical energy.",
    )
    session = ChatSession.objects.create(tenant=tenant, user=student, title="t")

    captured = {}

    def _fake_grounded(query, chunks, role):
        captured["chunks"] = chunks
        meta = [
            {
                "chunk_id": str(c["id"]),
                "rank": i + 1,
                "similarity_score": 1.0,
                "retrieval_method": c.get("method", "attached"),
            }
            for i, c in enumerate(chunks)
        ]
        return "Light energy is captured during photosynthesis.", meta

    dim = settings.EMBEDDING_DIMENSION
    with patch("apps.chat.services.turns.ai_service_available", return_value=True), \
         patch("apps.chat.services.turns.generate_grounded_answer", side_effect=_fake_grounded), \
         patch("apps.common.ai.generate_embeddings", side_effect=lambda texts: [[0.0] * dim for _ in texts]):
        resp = _auth(student).post(
            f"/api/v1/chat/sessions/{session.id}/messages/",
            {"content": "How does photosynthesis work?", "resource_ids": [str(res.id)]},
            format="json",
        )

    assert resp.status_code == 201, resp.data
    assistant = resp.data["assistant_message"]
    assert assistant["retrieved_chunk_ids"] == [str(chunk.id)]
    # The generation step really received the retrieved (attached-fold) chunk.
    assert str(chunk.id) in [str(c["id"]) for c in captured["chunks"]]
    assert ChatMessageSource.objects.filter(
        tenant=tenant, message_id=assistant["id"], chunk_id=chunk.id,
    ).count() == 1

    print("ROW 11 actual: 201; assistant cites the attached resource chunk (retrieved_chunk_ids populated)")
