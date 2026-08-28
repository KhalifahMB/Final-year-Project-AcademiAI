"""
Celery job status helpers for API polling.

Every dispatch point records the owning user in the cache (Redis) so that
GET /jobs/{id}/ can authorize polling. Job results can carry tenant-private
payloads (summaries, quiz ids), so ownership must be verified — knowing a
task UUID must not grant access to its result.
"""
import logging

from celery.result import AsyncResult
from django.core.cache import cache
from config.celery import app as celery_app

logger = logging.getLogger(__name__)

JOB_OWNER_TTL = 24 * 60 * 60  # results are short-lived operational data


def claim_job(task_id: str, user_id) -> None:
    """Record which user dispatched a job. Call immediately after .delay()."""
    try:
        cache.set(f"job-owner:{task_id}", str(user_id), JOB_OWNER_TTL)
    except Exception:
        # Ownership metadata is a security control; failure must be loud.
        logger.exception("Failed to record job owner for task=%s", task_id)


def is_job_owner(task_id: str, user_id) -> bool:
    """
    True when the user dispatched this job. Unknown tasks are denied —
    after a cache flush it is safer to re-dispatch than to leak results.
    Superusers (platform operators) may inspect any job.
    """
    cached = cache.get(f"job-owner:{task_id}")
    return bool(cached) and str(cached) == str(user_id)


def get_job_status(task_id: str) -> dict:
    result = AsyncResult(task_id, app=celery_app)
    state = result.state or "PENDING"
    payload = {
        "job_id": task_id,
        "status": state.lower(),
        "ready": result.ready(),
        "successful": result.successful() if result.ready() else None,
    }
    if result.ready():
        if result.successful():
            try:
                payload["result"] = result.result
            except Exception as exc:
                logger.exception("Could not read job result task=%s", task_id)
                payload["result"] = None
        else:
            # Never expose internal exception reprs (task paths, tracebacks)
            # to API clients; log the full detail server-side instead so it
            # shows up in both Django and Celery logs.
            try:
                tb = getattr(result.result, "__traceback__", None)
                logger.error(
                    "Job failed task=%s state=%s error=%r",
                    task_id,
                    state,
                    result.result,
                    exc_info=(type(result.result), result.result, tb)
                    if isinstance(result.result, BaseException)
                    else None,
                )
            except Exception:  # noqa: S110 — logging must never raise
                logger.error(
                    "Job failed task=%s state=%s error=%r",
                    task_id,
                    state,
                    result.result,
                )
            payload["error"] = (
                "This job failed while processing. You can retry it from "
                "where you started it."
            )
    return payload
