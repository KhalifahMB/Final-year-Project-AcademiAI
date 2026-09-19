"""
Regression tests for the material-experience improvements:

- retry_processing: failed materials can be re-queued (owner/admin only)
- preview: text content inline, PDFs via signed URL
- summarize: visibility authorization enforced
- quiz generation: available to students, scoped to authorized materials
- chat history: messages filterable by session, scoped to the owner
"""
import pytest
from unittest.mock import patch, MagicMock

from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.assessments.models import Quiz
from apps.chat.models import ChatSession, ChatMessage
from apps.resources.models import Resource
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026"


def make_tenant(slug):
    return Tenant.objects.create(name=f"Univ {slug}", slug=slug)


def make_user(email, tenant, role="student"):
    return User.objects.create_user(
        email=email,
        password=PASSWORD,
        tenant=tenant,
        role=role,
        is_active=True,
        is_email_verified=True,
    )


def auth_client(user):
    """Production-realistic client: Bearer token, so middleware sets the
    tenant GUC exactly like real traffic."""
    client = APIClient(enforce_csrf_checks=False)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}"
    )
    return client


@pytest.mark.django_db
def test_retry_processing_only_for_failed():
    from apps.resources.models import ResourceVersion

    t = make_tenant("retry")
    owner = make_user("o@retry.edu", t)
    key = f"tenants/{t.id}/resources/doc/file.pdf"
    res = Resource.objects.create(
        tenant=t, title="Broken doc", uploaded_by=owner,
        processing_status=Resource.ProcessingStatus.FAILED,
        processing_error="No extractable text",
        storage_key=key,
    )
    ResourceVersion.objects.create(
        tenant=t, resource=res, version_number=1, storage_key=key, created_by=owner
    )
    client = auth_client(owner)

    # Retry on a ready resource → 409
    res.processing_status = Resource.ProcessingStatus.READY
    res.save()
    resp = client.post(f"/api/v1/resources/{res.id}/retry_processing/")
    assert resp.status_code == 409

    # Retry on failed → 200 with job id, status back to pending
    res.processing_status = Resource.ProcessingStatus.FAILED
    res.save()
    with patch("apps.resources.tasks.process_resource_ingestion.delay") as d:
        d.return_value.id = "task-retry"
        resp = client.post(f"/api/v1/resources/{res.id}/retry_processing/")
    assert resp.status_code == 200
    res.refresh_from_db()
    assert res.processing_status == Resource.ProcessingStatus.PENDING


@pytest.mark.django_db
def test_retry_denied_for_non_owner():
    t = make_tenant("retry2")
    owner = make_user("o@retry2.edu", t)
    other = make_user("x@retry2.edu", t)
    # Default visibility is COURSE; for a non-owner/non-admin the resource
    # is not in the visible queryset (no course offering assigned), so the
    # view returns 404 (doesn't leak existence).
    res = Resource.objects.create(
        tenant=t, title="Doc", uploaded_by=owner,
        processing_status=Resource.ProcessingStatus.FAILED,
        visibility_scope=Resource.Visibility.PRIVATE,
    )
    client = auth_client(other)
    resp = client.post(f"/api/v1/resources/{res.id}/retry_processing/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_preview_text_and_pdf():
    t = make_tenant("preview")
    owner = make_user("o@preview.edu", t)

    txt = Resource.objects.create(
        tenant=t, title="Notes.txt", uploaded_by=owner,
        storage_key=f"tenants/{t.id}/r/txt/notes.txt",
        mime_type="text/plain", processing_status=Resource.ProcessingStatus.READY,
    )
    pdf = Resource.objects.create(
        tenant=t, title="Slides.pdf", uploaded_by=owner,
        storage_key=f"tenants/{t.id}/r/pdf/slides.pdf",
        mime_type="application/pdf", processing_status=Resource.ProcessingStatus.READY,
    )
    client = auth_client(owner)

    with patch("apps.resources.services.upload_service.get_s3_client") as s3:
        obj = MagicMock()
        obj["Body"].read.return_value = b"Hello preview content"
        s3.return_value.get_object.return_value = obj
        resp = client.get(f"/api/v1/resources/{txt.id}/preview/")
    assert resp.status_code == 200
    assert resp.data["kind"] == "text"
    assert "Hello preview content" in resp.data["content"]

    with patch("apps.resources.views.generate_presigned_download_url") as g:
        g.return_value = "https://signed.example/pdf"
        resp = client.get(f"/api/v1/resources/{pdf.id}/preview/")
    assert resp.status_code == 200
    assert resp.data["kind"] == "pdf"
    assert resp.data["preview_url"].startswith("https://signed")


@pytest.mark.django_db
@patch("apps.resources.views.ai_service_available", return_value=True)
def test_summarize_denied_for_private_material_of_other_user(ai_ok):
    t = make_tenant("sumvis")
    owner = make_user("o@sumvis.edu", t, role="lecturer")
    student = make_user("s@sumvis.edu", t)
    res = Resource.objects.create(
        tenant=t, title="Private", uploaded_by=owner,
        visibility_scope=Resource.Visibility.PRIVATE,
        processing_status=Resource.ProcessingStatus.READY,
    )
    client = auth_client(student)
    # Private resources of other users are filtered out of the queryset
    # so the view returns 404 (doesn't leak existence).
    resp = client.post(f"/api/v1/resources/{res.id}/summarize/")
    assert resp.status_code == 404

    # Owner may summarize their own private material.
    client = auth_client(owner)
    with patch("apps.resources.summary_tasks.summarize_resource_task.delay") as d:
        d.return_value.id = "task-sum"
        resp = client.post(f"/api/v1/resources/{res.id}/summarize/")
    assert resp.status_code == 202


@pytest.mark.django_db
@patch("apps.resources.views.ai_service_available", return_value=True)
def test_student_can_summarize_institution_resource(ai_ok):
    t = make_tenant("sumvis-inst")
    uploader = make_user("u@sumvis-inst.edu", t, role="lecturer")
    student = make_user("s@sumvis-inst.edu", t)
    res = Resource.objects.create(
        tenant=t, title="Institution notes", uploaded_by=uploader,
        visibility_scope=Resource.Visibility.INSTITUTION,
        processing_status=Resource.ProcessingStatus.READY,
        has_extractable_text=True,
    )
    client = auth_client(student)
    with patch("apps.resources.summary_tasks.summarize_resource_task.delay") as d:
        d.return_value.id = "task-sum-inst"
        resp = client.post(f"/api/v1/resources/{res.id}/summarize/")
    assert resp.status_code == 202


@pytest.mark.django_db
@patch("apps.resources.views.ai_service_available", return_value=False)
def test_summarize_unavailable_service_rejected_before_queueing(ai_off):
    t = make_tenant("sumvis-off")
    lecturer = make_user("l@sumvis-off.edu", t, role="lecturer")
    res = Resource.objects.create(
        tenant=t, title="Institution notes", uploaded_by=lecturer,
        visibility_scope=Resource.Visibility.INSTITUTION,
        processing_status=Resource.ProcessingStatus.READY,
        has_extractable_text=True,
    )
    client = auth_client(lecturer)
    with patch("apps.resources.summary_tasks.summarize_resource_task.delay") as d:
        resp = client.post(f"/api/v1/resources/{res.id}/summarize/")
    d.assert_not_called()
    assert resp.status_code == 503
    detail = resp.data["error"]["detail"]
    assert "AI service is currently unavailable" in detail


@pytest.mark.django_db
def test_student_can_generate_quiz_and_get_scoped_error():
    t = make_tenant("quizgen")
    student = make_user("s@quizgen.edu", t)
    client = auth_client(student)

    resp = client.post(
        "/api/v1/quizzes/generate/", {"num_questions": 3}, format="json"
    )
    assert resp.status_code == 202
    assert resp.data["job_id"]

    # With zero authorized materials the task reports a friendly failure.
    from apps.assessments.tasks import generate_quiz_task

    result = generate_quiz_task.apply(
        args=(str(student.id), str(t.id), {"num_questions": 3})
    )
    assert result.result["status"] == "failed"
    assert "No authorized materials" in result.result["error"]


@pytest.mark.django_db
def test_chat_history_scoped_to_owner_and_session():
    t = make_tenant("chathist")
    u1 = make_user("u1@chathist.edu", t)
    u2 = make_user("u2@chathist.edu", t)

    s1 = ChatSession.objects.create(tenant=t, user=u1, title="S1")
    ChatMessage.objects.create(tenant=t, session=s1, role="user", content="hi from u1")

    s2 = ChatSession.objects.create(tenant=t, user=u2, title="S2")
    ChatMessage.objects.create(tenant=t, session=s2, role="user", content="secret from u2")

    client = auth_client(u1)

    # u1 lists their sessions only
    resp = client.get("/api/v1/chat/sessions/")
    titles = [s["title"] for s in resp.data["results"]]
    assert titles == ["S1"]

    # u1 filters messages by session
    resp = client.get(f"/api/v1/chat/messages/?session={s1.id}")
    contents = [m["content"] for m in resp.data["results"]]
    assert contents == ["hi from u1"]

    # u1 cannot read u2's session messages even by guessing the id
    resp = client.get(f"/api/v1/chat/messages/?session={s2.id}")
    assert all("secret" not in m["content"] for m in resp.data["results"])


@pytest.mark.django_db
def test_preview_office_format_serves_extracted_text():
    from apps.resources.models import ResourceChunk, ResourceVersion

    t = make_tenant("officepreview")
    owner = make_user("o@officepreview.edu", t)
    key = f"tenants/{t.id}/resources/deck/slides.pptx"
    res = Resource.objects.create(
        tenant=t, title="Slides.pptx", uploaded_by=owner,
        storage_key=key,
        mime_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        processing_status=Resource.ProcessingStatus.READY,
        has_extractable_text=True,
    )
    ver = ResourceVersion.objects.create(
        tenant=t, resource=res, version_number=1, storage_key=key, created_by=owner
    )
    ResourceChunk.objects.create(
        tenant=t, resource_version=ver, chunk_index=0,
        content="Big-O notation describes algorithm growth.",
    )
    ResourceChunk.objects.create(
        tenant=t, resource_version=ver, chunk_index=1,
        content="Merge sort runs in O(n log n).",
    )
    client = auth_client(owner)

    # Classification falls back to "other" when the magic sniff can't reach
    # storage; the office-format branch must still serve the chunk text.
    with patch("apps.resources.views.get_s3_client") as s3:
        s3.side_effect = Exception("no storage in test")
        resp = client.get(f"/api/v1/resources/{res.id}/preview/")

    assert resp.status_code == 200
    assert resp.data["kind"] == "text"
    assert "Big-O notation" in resp.data["content"]
    assert "O(n log n)" in resp.data["content"]
    assert resp.data["truncated"] is False


@patch("apps.common.ai.gemini._get_client")
def test_summary_unavailable_raises_not_stub(get_client):
    from apps.common.ai import AIServiceUnavailableError, generate_summary

    get_client.return_value = None
    text = (
        "Photosynthesis converts light energy into chemical energy. "
        "Chlorophyll absorbs sunlight and drives the process. " * 20
    )
    with pytest.raises(AIServiceUnavailableError):
        generate_summary(text, max_words=60)


@patch("apps.common.ai.gemini._get_client")
def test_summary_unavailable_raises_for_empty_text(get_client):
    from apps.common.ai import AIServiceUnavailableError, generate_summary

    get_client.return_value = None
    with pytest.raises(AIServiceUnavailableError):
        generate_summary("   ", max_words=60)


def test_summary_call_failure_raises_not_fallback():
    from apps.common.ai import AIServiceUnavailableError, generate_summary

    class FlakyClient:
        class models:
            @staticmethod
            def generate_content(model=None, contents=None, config=None):
                raise ValueError("Content length is 17453 characters.")

    with patch("apps.common.ai.gemini._get_client", return_value=FlakyClient()):
        with pytest.raises(AIServiceUnavailableError) as exc_info:
            generate_summary("some academic text " * 30, max_words=60)
    assert "(Dev stub" not in str(exc_info.value)
    assert "unavailable" in str(exc_info.value).lower()


@pytest.mark.django_db
def test_job_error_never_leaks_task_paths():
    from apps.common.jobs import get_job_status

    # Simulate a failed Celery result whose error contains an internal path.
    with patch("apps.common.jobs.AsyncResult") as ar:
        inst = MagicMock()
        inst.state = "FAILURE"
        inst.ready.return_value = True
        inst.successful.return_value = False
        inst.result = Exception(
            "apps.resources.summary_tasks.summarize_resource_task"
        )
        ar.return_value = inst
        payload = get_job_status("task-x")

    assert payload["status"] == "failure"
    assert "apps.resources" not in payload["error"]
    assert "failed while processing" in payload["error"]
