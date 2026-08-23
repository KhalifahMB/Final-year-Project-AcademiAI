"""
Celery job status helpers for API polling.
"""
from celery.result import AsyncResult
from config.celery import app as celery_app


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
        try:
            payload["result"] = result.result if result.successful() else None
            if not result.successful():
                payload["error"] = str(result.result)
        except Exception as exc:
            payload["error"] = str(exc)
    return payload
