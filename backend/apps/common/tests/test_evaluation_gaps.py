"""
Executable functional/security test cases called out in the evaluation
matrix of Chapter 4 that the surrounding suites did not cover:

  TC-08b  EICAR file quarantined by worker scan; no chunks/embeddings created
  TC-21   Gemini outage during a chat turn  ->  user-facing error, no stack leak
  SEC-10  AI rate limit exceeded            ->  HTTP 429
"""
import pytest
from unittest.mock import patch

from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.common.security.file_validation import (
    FileValidationError,
    validate_upload_bytes,
)
from apps.resources.models import Resource, ResourceVersion
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026x"


def _tenant(slug="ev-m"):
    return Tenant.objects.create(name=f"Ev {slug}", slug=slug)


def _user(t, email, role="student"):
    return User.objects.create_user(
        email=email, password=PASSWORD, role=role, tenant=t,
        is_active=True, is_email_verified=True,
    )


# ---------------------------------------------------------------------------
# TC-08b / SEC-14: EICAR malware file
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_eicar_signature_rejected_at_validation():
    """The EICAR test signature must fail the scan regardless of clamd."""
    eicar = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    with pytest.raises(FileValidationError, match="EICAR"):
        validate_upload_bytes(eicar, content_type="text/plain", filename="bad.txt")


@pytest.mark.django_db
def test_ingestion_quarantines_eicar():
    """Worker ingestion of a stored EICAR file must fail; resource marked FAILED
    and no ResourceChunk rows may be created."""
    import apps.resources.tasks as tasks

    tenant = _tenant("quarantine")
    owner = _user(tenant, "o@m.edu", role="tenant_admin")
    res = Resource.objects.create(
        tenant=tenant, title="evil", uploaded_by=owner,
        visibility_scope="institution",
    )
    version = ResourceVersion.objects.create(
        tenant=tenant, resource=res, version_number=1,
        storage_key=f"tenants/{tenant.id}/resources/{res.id}/eicar",
    )

    with patch(
        "apps.common.storage.get_s3_client"
    ) as mock_client, patch(
        "apps.common.ai.generate_embeddings"
    ) as embed_spy, patch(
        "apps.common.ai.extract_concepts"
    ) as concept_spy, patch.object(
        tasks.process_resource_ingestion, "retry", side_effect=AttributeError("stop")
    ):
        mock_client.return_value.get_object.return_value = {
            "Body": type("B", (), {"read": lambda self: b"%PDF-1.4 EICAR-STANDARD-ANTIVIRUS-TEST-FILE"})(),
            "ContentType": "application/pdf",
        }
        concept_spy.return_value = {"concepts": [], "relations": []}

        with pytest.raises(AttributeError, match="stop"):
            tasks.process_resource_ingestion.run(res.id, version.id, tenant.id)

    res.refresh_from_db()
    assert res.processing_status == Resource.ProcessingStatus.FAILED
    assert "EICAR" in (res.processing_error or "")
    assert not ResourceVersion.objects.get(id=version.id).chunks.exists()
    # embeddings + concept extraction must never run on a quarantined file
    assert embed_spy.call_count == 0
    assert concept_spy.call_count == 0


# ---------------------------------------------------------------------------
# TC-21: Gemini failure is handled gracefully (user-facing, no stack trace)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_gemini_error_surfaces_user_facing_error_not_stack():
    from apps.common.ai.gemini import generate_grounded_answer

    horizon = {"id": "c1", "content": "Algorithms course material.", "score": 0.9, "method": "hybrid"}
    with patch("apps.common.ai.gemini._get_client") as client:
        client.return_value.models.generate_content.side_effect = TimeoutError("boom")
        answer, source_meta = generate_grounded_answer("What is a red-black tree?", [horizon], "student")

    assert "temporarily unavailable" in answer.lower()
    assert "traceback" not in answer.lower() and "boom" not in answer.lower()
    assert len(source_meta) == 1


@pytest.mark.django_db
def test_chat_turn_with_gemini_outage_persists_graceful_message():
    """End-to-end: a chat POST during a Gemini outage must return a graceful
    answer and persist it — the UI should never see an exception."""
    from apps.chat.models import ChatSession
    from apps.chat.views import ChatSessionViewSet  # noqa: F401 (route discovery)

    tenant = _tenant("chat-down")
    student = _user(tenant, "s@m.edu")

    session = ChatSession.objects.create(tenant=tenant, user=student, title="t")

    with patch(
        "apps.chat.services.turns.generate_grounded_answer",
        return_value=(
            "The AI service is temporarily unavailable. Please try again later.",
            [],
        ),
    ):
        client = APIClient()
        client.force_authenticate(student)
        resp = client.post(
            f"/api/v1/chat/sessions/{session.id}/messages/",
            {"content": "What is dynamic programming?"},
            format="json",
        )

    assert resp.status_code == 201, resp.data
    assert "temporarily unavailable" in resp.data["assistant_message"]["content"].lower()


# ---------------------------------------------------------------------------
# SEC-10: AI rate throttle returns 429
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_ai_rate_limit_returns_429():
    """SEC-10: Exceeding the per-user AI request quota must yield 429."""
    tenant = _tenant("throttle")
    lecturer = _user(tenant, "l@m.edu", role="lecturer")
    res = Resource.objects.create(
        tenant=tenant, title="notes", uploaded_by=lecturer,
        visibility_scope="institution",
        processing_status=Resource.ProcessingStatus.READY,
        has_extractable_text=True,
    )

    client = APIClient()
    client.force_authenticate(lecturer)

    # The default AI rate is 30/min. Compute the exact cache key the throttle
    # will use for this request, then pre-fill a full history so the very next
    # request is throttled.
    import time as _time
    from apps.common.throttling import AiRateThrottle
    from rest_framework.test import APIRequestFactory

    req = APIRequestFactory().post("/api/v1/quizzes/generate/")
    req.user = lecturer  # type: ignore[attr-defined]
    key = AiRateThrottle().get_cache_key(req, None)
    assert key is not None

    from django.core.cache import cache as _cache
    _cache.set(key, [_time.time()] * 31, 120)

    resp = client.post(
        "/api/v1/quizzes/generate/",
        {"resource_id": str(res.id)},
        format="json",
    )
    assert resp.status_code == 429, resp.data
    assert "available" in resp.data.get("detail", "").lower() or "throttl" in str(resp.data).lower()