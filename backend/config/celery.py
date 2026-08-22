"""
Celery application for AcademiAI.
Broker = RabbitMQ. Result backend / cache = Redis.
"""
import os

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
