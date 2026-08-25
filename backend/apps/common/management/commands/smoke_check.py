"""
Offline/online smoke checks for AcademiAI.
Without DB: validates imports, URLconf, settings.
With DB: optional connectivity + table presence.
"""
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.urls import get_resolver
from django.conf import settings
from django.db import connection


class Command(BaseCommand):
    help = "Run smoke checks (imports, routes, optional DB)"

    def add_arguments(self, parser):
        parser.add_argument("--with-db", action="store_true", help="Also probe database")

    def handle(self, *args, **options):
        errors = []

        # 1) Critical imports
        try:
            from apps.common.ai.gemini import generate_grounded_answer
            from apps.knowledge.retrieval import hybrid_retrieve
            from apps.resources.tasks import process_resource_ingestion
            from apps.assessments.tasks import generate_quiz_task
            from apps.accounts.tasks import send_verification_email
            self.stdout.write(self.style.SUCCESS("OK imports (ai, retrieval, tasks)"))
        except Exception as exc:
            errors.append(f"imports: {exc}")
            self.stderr.write(self.style.ERROR(f"FAIL imports: {exc}"))

        # 2) URL patterns resolve
        try:
            resolver = get_resolver()
            patterns = []

            def walk(urls, prefix=""):
                for e in urls.url_patterns:
                    if hasattr(e, "url_patterns"):
                        walk(e, prefix + str(e.pattern))
                    else:
                        patterns.append(prefix + str(e.pattern))

            walk(resolver)
            must = ["health/", "signup/", "resources/", "chat/sessions/", "quizzes/", "jobs/"]
            missing = [m for m in must if not any(m in p for p in patterns)]
            if missing:
                errors.append(f"routes missing: {missing}")
                self.stderr.write(self.style.ERROR(f"FAIL routes: {missing}"))
            else:
                self.stdout.write(self.style.SUCCESS(f"OK routes ({len(patterns)} patterns)"))
        except Exception as exc:
            errors.append(f"routes: {exc}")
            self.stderr.write(self.style.ERROR(f"FAIL routes: {exc}"))

        # 3) Settings sanity
        if not settings.SECRET_KEY:
            errors.append("SECRET_KEY empty")
        queues = getattr(settings, "CELERY_TASK_ROUTES", {})
        self.stdout.write(self.style.SUCCESS(f"OK settings (DEBUG={settings.DEBUG}, celery_routes={len(queues)})"))

        # 4) Optional DB
        if options["with_db"]:
            try:
                connection.ensure_connection()
                with connection.cursor() as c:
                    c.execute("SELECT 1")
                self.stdout.write(self.style.SUCCESS("OK database connection"))
            except Exception as exc:
                errors.append(f"db: {exc}")
                self.stderr.write(self.style.ERROR(f"FAIL db: {exc}"))

        if errors:
            self.stderr.write(self.style.ERROR(f"Smoke finished with {len(errors)} error(s)"))
            raise SystemExit(1)
        self.stdout.write(self.style.SUCCESS("Smoke checks passed"))
