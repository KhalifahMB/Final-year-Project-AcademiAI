"""
Apply the RabbitMQ dead-letter policy so failed tasks land on the "dlq" queue.

RabbitMQ lets a queue owner set an x-dead-letter-exchange as a *queue argument*
or as a *policy*. The Celery declarations in config/celery.py already carry the
queue arguments, but they only take effect when a queue is (re)declared. If the
work queues already exist in the broker (declared earlier without the argument)
the worker declaration will raise "PRECONDITION_FAILED - inequivalent arg".

This command applies an operator *policy* to the live queues via the RabbitMQ
management HTTP API, so the dead-letter exchange is enforced regardless of how
the queues were originally declared. Run it once after deploying:

    python manage.py setup_dlq
"""
import base64
import json
import os
import urllib.error
import urllib.request

from django.core.management.base import BaseCommand

WORK_QUEUES = ("celery", "ai", "ingestion", "email")
DLX = "dlx"
DLQ = "dlq"


class Command(BaseCommand):
    help = "Configure RabbitMQ dead-letter policy (dlx -> dlq) on work queues."

    def add_arguments(self, parser):
        parser.add_argument(
            "--vhost",
            default="/",
            help="RabbitMQ virtual host (default: '/').",
        )

    def handle(self, *args, **options):
        vhost = options["vhost"]
        user = os.getenv("RABBITMQ_DEFAULT_USER", "academiai")
        password = os.getenv("RABBITMQ_DEFAULT_PASS", "academiai")
        host = os.getenv("RABBITMQ_HOST", "localhost")
        port = os.getenv("RABBITMQ_MGMT_PORT", "15672")
        base = f"http://{host}:{port}"
        credentials = base64.b64encode(f"{user}:{password}".encode()).decode()
        headers = {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
        }

        # Declare the dead-letter destination exchange + queue via the API so
        # it exists even if a worker hasn't started yet.
        self._put(f"{base}/api/exchanges/{self._q(vhost)}/dlx", headers, {})
        self._put(
            f"{base}/api/queues/{self._q(vhost)}/dlq",
            headers,
            {"durable": True, "arguments": {}},
        )

        # Apply a policy that routes rejected/unroutable messages to the DLX.
        policy = {
            "pattern": "^(celery|ai|ingestion|email)$",
            "definition": {
                "dead-letter-exchange": DLX,
                "dead-letter-routing-key": DLQ,
            },
            "priority": 100,
            "apply-to": "queues",
        }
        self._put(
            f"{base}/api/policies/{self._q(vhost)}/academiai-dlx",
            headers,
            policy,
        )
        self.stdout.write(self.style.SUCCESS(
            f"Dead-letter policy applied on vhost {vhost!r} to queues "
            f"{', '.join(WORK_QUEUES)} -> {DLX}/{DLQ}."
        ))

    @staticmethod
    def _q(vhost):
        return urllib.request.quote(vhost, safe="")

    def _put(self, url, headers, payload):
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode(),
            headers=headers,
            method="PUT",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status >= 400:
                    self.stderr.write(
                        self.style.ERROR(f"{url} returned {resp.status}")
                    )
        except urllib.error.HTTPError as e:
            # 201/204 on the management API may surface oddly; treat 2xx/404 as ok.
            if e.code >= 400:
                self.stderr.write(
                    self.style.ERROR(f"{url} failed with {e.code}: {e.read()}")
                )
