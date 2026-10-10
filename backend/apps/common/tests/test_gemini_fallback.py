"""
Model-chain fallback and retry for Gemini.

Google reports two different failures that reach the user as the same generic
"AI service unavailable": 503/429 "high demand" while a model is merely busy,
and 404 when a configured model name is retired. Capacity for any single model
also moves minute to minute — gemini-3.6-flash passed six calls then failed
every subsequent one — so pinning one default model cannot hold.

These tests pin generate_content_with_fallback's contract:

  - transient (408/429/5xx) -> retry the same model, then advance the chain
  - 404 (retired model)      -> skip to the next model with no retry
  - non-retryable (400/403)  -> raise at once; another model cannot help
  - chain exhausted          -> AIServiceUnavailableError, never a fake answer
"""
import pytest
from unittest.mock import patch

from google.genai.errors import APIError

from apps.common.ai.gemini import (
    AIServiceUnavailableError,
    generate_content_stream_with_fallback,
    generate_content_with_fallback,
    model_chain,
)

PRIMARY = "model-primary"
SECOND = "model-second"
THIRD = "model-third"


def _api_error(status: int) -> APIError:
    return APIError(status, {"error": {"code": status, "message": "upstream", "status": "X"}})


class FakeResponse:
    def __init__(self, text="answer"):
        self.text = text


class FakeModels:
    """Serves a scripted outcome per model, recording every call."""

    def __init__(self, script):
        self.script = {name: list(outcomes) for name, outcomes in script.items()}
        self.calls = []

    def generate_content(self, *, model, contents, config):
        self.calls.append(model)
        queue = self.script.get(model, [])
        if not queue:
            raise AssertionError(f"unexpected call to {model} (script exhausted)")
        outcome = queue.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


class FakeClient:
    def __init__(self, script):
        self.models = FakeModels(script)


@pytest.fixture
def no_sleep():
    with patch("apps.common.ai.gemini.time") as mock_time:
        yield mock_time


def test_chain_is_primary_then_fallbacks_in_order(settings):
    settings.GEMINI_MODEL = PRIMARY
    settings.GEMINI_MODEL_FALLBACKS = [SECOND, PRIMARY, THIRD]
    # Duplicate of the primary must not be attempted twice.
    assert model_chain() == [PRIMARY, SECOND, THIRD]


def test_capacity_blocked_primary_falls_back(no_sleep, settings):
    settings.GEMINI_MODEL = PRIMARY
    settings.GEMINI_MODEL_FALLBACKS = [SECOND, THIRD]
    settings.GEMINI_RETRY_ATTEMPTS = 2

    client = FakeClient({
        PRIMARY: [_api_error(503), _api_error(503)],
        SECOND: [FakeResponse("from second")],
    })

    resp = generate_content_with_fallback("hi", {}, client=client)

    assert resp.text == "from second"
    assert client.models.calls == [PRIMARY, PRIMARY, SECOND]
    # Backoff was scheduled for the transient failure before advancing.
    assert no_sleep.sleep.called


def test_retried_model_recovers_without_walking_the_chain(no_sleep, settings):
    settings.GEMINI_MODEL = PRIMARY
    settings.GEMINI_MODEL_FALLBACKS = [SECOND]
    settings.GEMINI_RETRY_ATTEMPTS = 2

    client = FakeClient({
        PRIMARY: [_api_error(429), FakeResponse("recovered")],
        SECOND: [],
    })

    resp = generate_content_with_fallback("hi", {}, client=client)

    assert resp.text == "recovered"
    assert client.models.calls == [PRIMARY, PRIMARY]


def test_retired_model_is_skipped_without_retrying(no_sleep, settings):
    settings.GEMINI_MODEL = PRIMARY
    settings.GEMINI_MODEL_FALLBACKS = [SECOND]
    settings.GEMINI_RETRY_ATTEMPTS = 2

    client = FakeClient({
        PRIMARY: [_api_error(404)],
        SECOND: [FakeResponse("from second")],
    })

    resp = generate_content_with_fallback("hi", {}, client=client)

    assert resp.text == "from second"
    # Exactly one attempt against the retired model — a 404 will not heal.
    assert client.models.calls == [PRIMARY, SECOND]
    assert not no_sleep.sleep.called


def test_non_retryable_error_raises_and_never_falls_back(no_sleep, settings):
    settings.GEMINI_MODEL = PRIMARY
    settings.GEMINI_MODEL_FALLBACKS = [SECOND]
    settings.GEMINI_RETRY_ATTEMPTS = 3

    client = FakeClient({PRIMARY: [_api_error(400)], SECOND: []})

    with pytest.raises(APIError) as excinfo:
        generate_content_with_fallback("hi", {}, client=client)

    assert excinfo.value.code == 400
    assert client.models.calls == [PRIMARY]


def test_exhausted_chain_raises_ai_unavailable_not_a_fake_answer(no_sleep, settings):
    settings.GEMINI_MODEL = PRIMARY
    settings.GEMINI_MODEL_FALLBACKS = [SECOND, THIRD]
    settings.GEMINI_RETRY_ATTEMPTS = 1

    client = FakeClient({
        PRIMARY: [_api_error(503)],
        SECOND: [_api_error(503)],
        THIRD: [_api_error(503)],
    })

    with pytest.raises(AIServiceUnavailableError) as excinfo:
        generate_content_with_fallback("hi", {}, client=client)

    assert client.models.calls == [PRIMARY, SECOND, THIRD]
    # The original status stays available for logs/diagnostics.
    cause = excinfo.value.__cause__
    assert isinstance(cause, APIError)
    assert cause.code == 503


def test_missing_client_is_unavailable_not_a_crash():
    with patch("apps.common.ai.gemini._get_client", return_value=None):
        with pytest.raises(AIServiceUnavailableError):
            generate_content_with_fallback("hi", {}, client=None)


def test_preferred_model_leads_the_chain(settings):
    settings.GEMINI_MODEL = PRIMARY
    settings.GEMINI_MODEL_FALLBACKS = [SECOND]

    client = FakeClient({SECOND: [FakeResponse("from second")]})

    resp = generate_content_with_fallback(
        "hi", {}, client=client, preferred=SECOND
    )

    assert resp.text == "from second"
    # preferred is tried first and deduplicated out of the rest of the chain
    assert client.models.calls == [SECOND]


@pytest.mark.django_db
def test_grounded_answer_uses_the_fallback_chain(no_sleep, settings):
    """The user-facing chat path must survive a capacity-blocked primary."""
    from apps.common.ai.gemini import generate_grounded_answer

    settings.GEMINI_MODEL = PRIMARY
    settings.GEMINI_MODEL_FALLBACKS = [SECOND]
    settings.GEMINI_RETRY_ATTEMPTS = 1

    client = FakeClient({
        PRIMARY: [_api_error(503)],
        SECOND: [FakeResponse("grounded from second")],
    })

    with patch("apps.common.ai.gemini._get_client", return_value=client):
        answer, meta = generate_grounded_answer(
            "What is a primary key?", [{"id": "c1", "content": "A key..."}]
        )

    assert answer == "grounded from second"
    assert meta and meta[0]["chunk_id"] == "c1"
    assert client.models.calls == [PRIMARY, SECOND]


@pytest.mark.django_db
def test_grounded_answer_reports_unavailability_when_every_model_fails(
    no_sleep, settings
):
    from apps.common.ai.gemini import generate_grounded_answer

    settings.GEMINI_MODEL = PRIMARY
    settings.GEMINI_MODEL_FALLBACKS = [SECOND]
    settings.GEMINI_RETRY_ATTEMPTS = 1

    client = FakeClient({PRIMARY: [_api_error(503)], SECOND: [_api_error(503)]})

    with patch("apps.common.ai.gemini._get_client", return_value=client):
        with pytest.raises(AIServiceUnavailableError):
            generate_grounded_answer("q", [{"id": "c1", "content": "x"}])


# ---------------------------------------------------------------------------
# Streaming
# ---------------------------------------------------------------------------
# generate_content_stream() returns a generator without doing the HTTP call,
# so a failure surfaces on the first next() rather than at the call site. That
# is why the fallback cannot wrap the call: it has to pull the first chunk
# inside the retry loop.
class FakeChunk:
    def __init__(self, text):
        self.text = text


class _LazyBrokenStream:
    """Mimics the SDK: constructing is free, iterating raises."""

    def __init__(self, exc):
        self.exc = exc

    def __iter__(self):
        raise self.exc


class FakeStreamModels:
    def __init__(self, script):
        self.script = {name: list(outcomes) for name, outcomes in script.items()}
        self.calls = []

    def generate_content_stream(self, *, model, contents, config):
        self.calls.append(model)
        queue = self.script.get(model, [])
        if not queue:
            raise AssertionError(f"unexpected stream call to {model} (script exhausted)")
        outcome = queue.pop(0)
        if isinstance(outcome, Exception):
            return _LazyBrokenStream(outcome)
        return iter(outcome)


class FakeStreamClient:
    def __init__(self, script):
        self.models = FakeStreamModels(script)


def test_stream_falls_back_when_the_first_model_cannot_start(no_sleep, settings):
    settings.GEMINI_MODEL = PRIMARY
    settings.GEMINI_MODEL_FALLBACKS = [SECOND]
    settings.GEMINI_RETRY_ATTEMPTS = 1

    client = FakeStreamClient({
        PRIMARY: [_api_error(503)],
        SECOND: [[FakeChunk("hello "), FakeChunk("world")]],
    })

    chunks = list(generate_content_stream_with_fallback("hi", {}, client=client))

    assert [c.text for c in chunks] == ["hello ", "world"]
    assert client.models.calls == [PRIMARY, SECOND]


def test_healthy_stream_is_passed_through_without_walking_the_chain(no_sleep, settings):
    settings.GEMINI_MODEL = PRIMARY
    settings.GEMINI_MODEL_FALLBACKS = [SECOND]
    settings.GEMINI_RETRY_ATTEMPTS = 2

    client = FakeStreamClient({
        PRIMARY: [[FakeChunk("a"), FakeChunk("b")]],
        SECOND: [],
    })

    chunks = list(generate_content_stream_with_fallback("hi", {}, client=client))

    assert [c.text for c in chunks] == ["a", "b"]
    assert client.models.calls == [PRIMARY]


def test_stream_retries_the_same_model_before_advancing(no_sleep, settings):
    settings.GEMINI_MODEL = PRIMARY
    settings.GEMINI_MODEL_FALLBACKS = [SECOND]
    settings.GEMINI_RETRY_ATTEMPTS = 2

    client = FakeStreamClient({
        PRIMARY: [_api_error(429), [FakeChunk("recovered")]],
        SECOND: [],
    })

    chunks = list(generate_content_stream_with_fallback("hi", {}, client=client))

    assert [c.text for c in chunks] == ["recovered"]
    assert client.models.calls == [PRIMARY, PRIMARY]


def test_stream_transport_error_falls_back(no_sleep, settings):
    """A dropped connection has no HTTP status but must still advance."""
    settings.GEMINI_MODEL = PRIMARY
    settings.GEMINI_MODEL_FALLBACKS = [SECOND]
    settings.GEMINI_RETRY_ATTEMPTS = 1

    client = FakeStreamClient({
        PRIMARY: [TimeoutError("connection aborted")],
        SECOND: [[FakeChunk("still here")]],
    })

    chunks = list(generate_content_stream_with_fallback("hi", {}, client=client))

    assert [c.text for c in chunks] == ["still here"]
    assert client.models.calls == [PRIMARY, SECOND]


def test_stream_exhausted_chain_raises(no_sleep, settings):
    settings.GEMINI_MODEL = PRIMARY
    settings.GEMINI_MODEL_FALLBACKS = [SECOND]
    settings.GEMINI_RETRY_ATTEMPTS = 1

    client = FakeStreamClient({
        PRIMARY: [_api_error(503)],
        SECOND: [_api_error(503)],
    })

    with pytest.raises(AIServiceUnavailableError):
        list(generate_content_stream_with_fallback("hi", {}, client=client))


def test_stream_empty_start_yields_nothing_rather_than_raising(settings):
    """An empty stream must not crash the caller — it already treats a
    tokenless stream as a failed generation."""
    settings.GEMINI_MODEL = PRIMARY
    settings.GEMINI_MODEL_FALLBACKS = []

    client = FakeStreamClient({PRIMARY: [[]]})

    assert list(generate_content_stream_with_fallback("hi", {}, client=client)) == []
