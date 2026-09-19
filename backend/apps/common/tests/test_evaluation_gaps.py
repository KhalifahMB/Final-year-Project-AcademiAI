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


# ---------------------------------------------------------------------------
# TC-05 / SEC-02: expired and tampered JWTs are rejected with 401
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_expired_access_token_rejected():
    """An access token whose exp claim is in the past must be rejected."""
    from datetime import timedelta

    from rest_framework_simplejwt.tokens import AccessToken

    tenant = _tenant("exp-jwt")
    user = _user(tenant, "s@m.edu", role="student")
    token = AccessToken.for_user(user)
    token["exp"] = 1  # epoch start: clearly expired
    expired = str(token)

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {expired}")
    resp = client.get("/api/v1/auth/me/")
    assert resp.status_code == 401, resp.data


@pytest.mark.django_db
def test_tampered_access_token_rejected():
    """A signature-corrupted bearer token must be rejected with 401."""
    from rest_framework_simplejwt.tokens import RefreshToken

    tenant = _tenant("tamper-jwt")
    user = _user(tenant, "s@m.edu", role="student")
    valid = str(RefreshToken.for_user(user).access_token)
    tampered = valid[:-4] + ("AAAA" if not valid.endswith("AAAA") else "BBBB")

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tampered}")
    resp = client.get("/api/v1/auth/me/")
    assert resp.status_code == 401, resp.data


# ---------------------------------------------------------------------------
# TC-20: malformed JSON body is rejected with 400, no crash
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_malformed_json_rejected_with_400():
    tenant = _tenant("bad-json")
    user = _user(tenant, "s@m.edu", role="student")
    client = APIClient()
    client.force_authenticate(user)
    resp = client.post(
        "/api/v1/chat/sessions/",
        data=b"{this is not json",
        content_type="application/json",
    )
    assert resp.status_code == 400, resp.data
    assert "detail" in resp.data or "error" in resp.data


# ---------------------------------------------------------------------------
# TC-16: quiz attempt submission is scored server-side; answers not leaked
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_quiz_submission_scores_server_side_and_does_not_leak_answers():
    from apps.assessments.models import Quiz, QuizAttempt, QuizQuestion

    tenant = _tenant("quiz-submit")
    student = _user(tenant, "s@m.edu", role="student")
    quiz = Quiz.objects.create(
        tenant=tenant, title="Algorithms quiz",
        status=Quiz.Status.PUBLISHED,
    )
    q1 = QuizQuestion.objects.create(
        tenant=tenant, quiz=quiz, question_text="Q1",
        question_type="multiple_choice", options=["A", "B"],
        correct_answer={"index": 0}, explanation="expl1", order_index=0,
    )
    q2 = QuizQuestion.objects.create(
        tenant=tenant, quiz=quiz, question_text="Q2",
        question_type="multiple_choice", options=["A", "B", "C"],
        correct_answer={"index": 2}, explanation="expl2", order_index=1,
    )

    client = APIClient()
    client.force_authenticate(student)

    # Before submission, a student listing the quiz must NOT see the answers.
    quiz_resp = client.get(f"/api/v1/quizzes/{quiz.id}/")
    if quiz_resp.status_code == 200:
        q_payload = quiz_resp.data.get("questions") or []
        for q in q_payload:
            assert "correct_answer" not in q, q
            assert "explanation" not in q, q

    attempt_resp = client.post(
        "/api/v1/quiz-attempts/", {"quiz": str(quiz.id)}, format="json",
    )
    assert attempt_resp.status_code == 201, attempt_resp.data
    attempt_id = attempt_resp.data["id"]

    # Submit: q1 correct, q2 wrong -> score = 50%.
    submit_resp = client.post(
        f"/api/v1/quiz-attempts/{attempt_id}/submit/",
        {"answers": {str(q1.id): {"index": 0}, str(q2.id): {"index": 0}}},
        format="json",
    )
    assert submit_resp.status_code == 200, submit_resp.data
    assert submit_resp.data["score"] == 50.0, submit_resp.data["score"]
    assert submit_resp.data["submitted_at"] is not None

    attempt = QuizAttempt.objects.get(id=attempt_id)
    assert attempt.score == 50.0
    assert len(attempt.answers) == 2

    # A second submission is rejected — scores are final.
    dup = client.post(
        f"/api/v1/quiz-attempts/{attempt_id}/submit/",
        {"answers": {str(q1.id): {"index": 1}, str(q2.id): {"index": 2}}},
        format="json",
    )
    assert dup.status_code == 409, dup.data