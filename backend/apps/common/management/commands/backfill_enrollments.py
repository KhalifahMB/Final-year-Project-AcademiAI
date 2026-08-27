"""
One-off / repeatable maintenance: enrol existing verified students into the
active course offerings of their programme's department.

Useful for accounts created before auto-enrollment existed, or before their
StudentProfile was linked to a programme.

Usage:
    python manage.py backfill_enrollments            # all tenants
    python manage.py backfill_enrollments --email a@b.com
"""
from django.core.management.base import BaseCommand

from apps.accounts.models import StudentProfile, User
from apps.academics.services import auto_enroll_student


class Command(BaseCommand):
    help = "Enrol verified students into active offerings of their programme's department."

    def add_arguments(self, parser):
        parser.add_argument("--email", help="Limit to one student email.")

    def handle(self, *args, **options):
        email = options.get("email")
        qs = User.objects.filter(
            role=User.Role.STUDENT,
            is_active=True,
        ).exclude(tenant=None)
        if email:
            qs = qs.filter(email__iexact=email)

        enrolled_total = 0
        skipped = 0
        for user in qs.iterator():
            # Academic tables are RLS-protected; run inside the student's
            # tenant scope (auto_enroll_student opens a nested scope itself).
            from apps.common.db import tenant_scope

            try:
                with tenant_scope(str(user.tenant_id)):
                    has_programme = StudentProfile.objects.filter(
                        user=user, programme__isnull=False
                    ).exists()
                    if not has_programme:
                        skipped += 1
                        self.stdout.write(
                            f"SKIP {user.email} — no StudentProfile/programme set"
                        )
                        continue
                    if not user.is_email_verified:
                        skipped += 1
                        self.stdout.write(f"SKIP {user.email} — email not verified")
                        continue
                    count = auto_enroll_student(user)
            except Exception as exc:
                skipped += 1
                self.stdout.write(f"ERR  {user.email} — {exc}")
                continue
            enrolled_total += count
            self.stdout.write(f"OK   {user.email} — {count} enrollment(s)")

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Created {enrolled_total} enrollment(s); skipped {skipped}."
            )
        )
