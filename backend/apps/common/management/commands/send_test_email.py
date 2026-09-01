"""
Send a branded test email to every active user (or just one).

Intended to verify the Mailpit/SMTP pipeline and the branded HTML templates
end-to-end on a live stack::

    manage.py send_test_email                 # all active users
    manage.py send_test_email --email a@b.c   # one recipient (dev quick check)
    manage.py send_test_email --dry-run       # list recipients, send nothing
"""
import logging

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.accounts.models import User
from apps.common.mail import send_email

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Send a branded test email to active users (or one recipient)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            help="Send only to this address instead of every active user.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print the recipient list without sending anything.",
        )

    def handle(self, *args, **options):
        target = options["email"]
        dry_run = options["dry_run"]

        if target:
            recipients = [target]
        else:
            recipients = list(
                User.objects.filter(is_active=True, is_email_verified=True)
                .values_list("email", flat=True)
                .order_by("email")
            )

        if not recipients:
            self.stderr.write(self.style.WARNING("No active recipients found."))
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"{len(recipients)} recipient(s): {', '.join(recipients[:6])}"
                + (", ..." if len(recipients) > 6 else "")
            )
        )
        if dry_run:
            self.stdout.write("Dry run - nothing sent.")
            return

        subject = "AcademiAI - Mail delivery test"
        for email in recipients:
            context = {
                "first_name": email,
                "dashboard_url": settings.FRONTEND_URL + "/dashboard",
            }
            try:
                send_email(subject, [email], "test_email", context)
                self.stdout.write(self.style.SUCCESS(f"sent -> {email}"))
            except Exception:
                self.stderr.write(self.style.ERROR(f"FAILED -> {email}"))
                logger.exception("Test email failed to %s", email)

        self.stdout.write(self.style.SUCCESS("Done."))