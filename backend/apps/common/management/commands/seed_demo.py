from django.core.management.base import BaseCommand
from apps.tenants.models import Tenant
from apps.accounts.models import User


class Command(BaseCommand):
    help = "Seed a demo tenant and admin user for local development"

    def handle(self, *args, **options):
        tenant, created = Tenant.objects.get_or_create(
            slug="demo-uni",
            defaults={
                "name": "Demo University",
                "status": Tenant.Status.ACTIVE,
            },
        )
        self.stdout.write(f"Tenant: {tenant.slug} ({'created' if created else 'exists'})")
        email = "admin@demo.local"
        if not User.objects.filter(email=email, tenant=tenant).exists():
            User.objects.create_superuser(
                email=email,
                password="DemoAdmin123!",
                tenant=tenant,
                role=User.Role.ADMIN,
                first_name="Demo",
                last_name="Admin",
            )
            self.stdout.write(self.style.SUCCESS(f"Admin user {email} / DemoAdmin123!"))
        else:
            self.stdout.write("Admin user already exists")
