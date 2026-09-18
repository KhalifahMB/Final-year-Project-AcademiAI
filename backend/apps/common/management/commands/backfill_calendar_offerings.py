"""
Re-link existing CalendarEvent rows to their CourseOffering so role-based
calendar visibility works for events imported before course-offering linking
was added (students only see exams/lectures for offerings they are enrolled
in — that requires course_offering_id to be set).

Events are matched by free-text course_code, preferring the tenant's current
academic session/semester. Idempotent: events that already have a
course_offering are skipped; events with no matching course code are listed.

Usage:
    python manage.py backfill_calendar_offerings [--tenant SLUG] [--dry-run]
"""
from django.core.management.base import BaseCommand

from apps.calendar.services.schedule_parse import _resolve_course_offering
from apps.common.db import tenant_scope
from apps.tenants.models import Tenant


class Command(BaseCommand):
    help = (
        "Link CalendarEvents imported before offering-resolution existed to "
        "their CourseOffering so students/lecturers can see them."
    )

    def add_arguments(self, parser):
        parser.add_argument("--tenant", help="Only process this tenant slug.")
        parser.add_argument("--dry-run", action="store_true", help="Report without saving.")

    def handle(self, *args, **options):
        tenants = list(Tenant.objects.all())
        if options["tenant"]:
            matched = [t for t in tenants if t.slug == options["tenant"]]
            if not matched:
                self.stderr.write(self.style.ERROR(f"Unknown tenant slug: {options['tenant']}"))
                return
            tenants = matched

        linked = 0
        skipped = 0
        unmatched = 0
        for tenant in tenants:
            with tenant_scope(tenant.id):
                from apps.calendar.models import CalendarEvent

                qs = (CalendarEvent.objects
                      .filter(course_offering__isnull=True)
                      .exclude(course_code=""))
                if options["tenant"]:
                    qs = qs.filter(tenant_id=tenant.id)
                for event in qs.order_by("start"):
                    offering = _resolve_course_offering(tenant.id, event.course_code)
                    if offering is None:
                        unmatched += 1
                        self.stdout.write(
                            self.style.WARNING(
                                f"no offering for {event.title} [{event.course_code}] "
                                f"(tenant {tenant.slug})"
                            )
                        )
                        continue
                    if options["dry_run"]:
                        skipped += 1
                        continue
                    event.course_offering = offering
                    event.save(update_fields=["course_offering"])
                    linked += 1

        if options["dry_run"]:
            self.stdout.write(self.style.NOTICE(f"[dry-run] {linked} would be linked"))
        self.stdout.write(
            self.style.SUCCESS(
                f"linked {linked}, skipped {skipped}, unmatched {unmatched} "
                f"across {len(tenants)} tenant(s)."
            )
        )