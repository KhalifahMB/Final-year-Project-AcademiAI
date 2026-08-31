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
# routing target and celery inspect lists them all. Each work queue is
# dead-lettered: messages that are rejected / negatively acknowledged (e.g.
# after a worker is lost, or explicitly rejected by a task) land on the "dlq"
# queue via the "dlx" exchange, where they stay for inspection instead of
# being silently dropped.
from kombu import Exchange, Queue

_DLX = Exchange("dlx", type="direct")
_DLQ = Queue("dlq", exchange=_DLX, routing_key="dlq")


def _work_queue(name):
    return Queue(
        name,
        Exchange(name, type="direct"),
        routing_key=name,
        queue_arguments={
            "x-dead-letter-exchange": "dlx",
            "x-dead-letter-routing-key": "dlq",
        },
    )


app.conf.task_queues = (
    _work_queue("celery"),
    _work_queue("ai"),
    _work_queue("ingestion"),
    _work_queue("email"),
    _DLQ,
)
app.conf.task_default_queue = "celery"

# Late-ack + reject-on-worker-lost so a crashed worker negatively acks the
# in-flight message, routing it to the dead-letter queue rather than losing
# it. Finished (acked) messages are never redelivered.
app.conf.acks_late = True
app.conf.task_reject_on_worker_lost = True

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
