"""
Celery application for AcademiAI.
Broker = RabbitMQ. Result backend / cache = Redis.
"""
import importlib
import os
import sys

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("academiai")
app.config_from_object("django.conf:settings", namespace="CELERY")

# Discover <app>/tasks.py in every installed Django app. We pass the
# explicit list so that autodiscovery runs even when the Celery app is
# imported early (e.g. by manage.py shell or at settings import time),
# and force=True to ensure it doesn't silently skip on re-import.
app.autodiscover_tasks(
    [
        "apps.accounts",
        "apps.assessments",
        "apps.resources",
        "apps.knowledge",
        "apps.chat",
        "apps.learning",
        "apps.audit",
        "apps.platform",
        "apps.tenants",
        "apps.common",
        "apps.academics",
    ],
    force=True,
)

# Non-standard task modules live in files whose names don't follow the
# <app>/tasks.py convention (summary_tasks.py lives on the dedicated
# "ai" queue). Import them eagerly so @shared_task registers with the
# app — this fixes:
#   "Task of kind 'apps.resources.summary_tasks.summarize_resource_task'
#    never registered, please make sure it's imported."
# for BOTH standalone Celery workers AND inline eager mode (when
# CELERY_TASK_ALWAYS_EAGER=True in .env for dev on Windows).
_EXTRA_TASK_MODULES = (
    "apps.resources.summary_tasks",
)
for _mod in _EXTRA_TASK_MODULES:
    importlib.import_module(_mod)

# Explicit queue declarations so workers started without -Q know every
# routing target and celery inspect lists them all.
app.conf.task_queues = {
    "celery": {"exchange": "celery", "routing_key": "celery"},
    "ai": {"exchange": "ai", "routing_key": "ai"},
    "ingestion": {"exchange": "ingestion", "routing_key": "ingestion"},
    "email": {"exchange": "email", "routing_key": "email"},
}
app.conf.task_default_queue = "celery"

# Windows: billiard's prefork pool depends on POSIX semaphores and
# crashes ("Access is denied", invalid handle) on win32. The solo pool
# executes tasks sequentially in-process — fully compatible.
if sys.platform == "win32" and os.getenv("CELERY_FORCE_PREFORK", "").lower() not in (
    "1",
    "true",
    "yes",
):
    app.conf.worker_pool = "solo"
    app.conf.worker_concurrency = 1
