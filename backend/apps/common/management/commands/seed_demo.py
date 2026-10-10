from django.core.management.base import BaseCommand
from apps.common.db import tenant_scope
from apps.tenants.models import Tenant
from apps.accounts.models import User


class Command(BaseCommand):
    help = "Seed a demo tenant and admin user for local development"

    def handle(self, *args, **options):
        tenant, created = Tenant.objects.get_or_create(
            slug="ATBU",
            defaults={
                "name": "Abubakar Tafawa Balewa University",
                "status": Tenant.Status.ACTIVE,
            },
        )
        self.stdout.write(f"Tenant: {tenant.slug} ({'created' if created else 'exists'})")
        email = "admin@demo.local"

        if User.objects.filter(email=email, tenant=tenant).exists():
            self.stdout.write("Admin user already exists")
            return

        # users_email_key is globally unique, not just unique per tenant (D12).
        # Read it unscoped: a tenant_scope() binding would hide the clash, because
        # the row belongs to a different tenant.
        clash = User.objects.filter(email=email).exclude(tenant=tenant).first()
        if clash is not None:
            self.stdout.write(self.style.WARNING(
                f"Skipped {email}: already owned by another tenant. The global "
                f"users_email_key constraint allows only one owner, so it cannot "
                f"be re-created under {tenant.slug}."
            ))
            return

        with tenant_scope(tenant.id):
            User.objects.create_superuser(
                email=email,
                password="DemoAdmin123!",
                tenant=tenant,
                role=User.Role.TENANT_ADMIN,
                first_name="Demo",
                last_name="Admin",
            )
        self.stdout.write(self.style.SUCCESS(f"Admin user {email} / DemoAdmin123!"))
