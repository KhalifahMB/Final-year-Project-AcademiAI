"""
Celery application for AcademiAI.
Broker = RabbitMQ. Result backend / cache = Redis.
"""
import os
import sys

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("academiai")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

# Explicit queues for routing
app.conf.task_queues = {
    "celery": {"exchange": "celery", "routing_key": "celery"},
    "ai": {"exchange": "ai", "routing_key": "ai"},
    "ingestion": {"exchange": "ingestion", "routing_key": "ingestion"},
    "email": {"exchange": "email", "routing_key": "email"},
}
app.conf.task_default_queue = "celery"

# Windows: billiard's prefork pool depends on POSIX-style shared semaphores
# and crashes ("Access is denied", invalid handle) when spawned on win32.
# The solo pool executes tasks sequentially in-process — fully compatible.
if sys.platform == "win32" and os.getenv("CELERY_FORCE_PREFORK", "").lower() not in (
    "1",
    "true",
    "yes",
):
    app.conf.worker_pool = "solo"
    app.conf.worker_concurrency = 1
