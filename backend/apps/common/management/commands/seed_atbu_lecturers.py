"""
Seed lecturer accounts for the ATBU tenant's Computer Science department
(Faculty of Computing). Idempotent: get_or_create by (tenant, email).

Existing placeholder lecturer (lecturer@gmail.com) is left untouched.
"""
from django.core.management.base import BaseCommand

from apps.academics.models import Department, Faculty
from apps.accounts.models import LecturerProfile, User
from apps.tenants.models import Tenant

TENANT_SLUG = "ATBU"
FACULTY_CODE = "FOC"
DEPARTMENT_CODE = "DOC"
DEFAULT_PASSWORD = "ATBUtest123!"

LECTURERS = [
    {"first": "Sani", "last": "Yusuf", "gender": "male", "staff": "ATBU/LEC/CS/001"},
    {"first": "Fatima", "last": "Bello", "gender": "female", "staff": "ATBU/LEC/CS/002"},
    {"first": "Ibrahim", "last": "Musa", "gender": "male", "staff": "ATBU/LEC/CS/003"},
    {"first": "Aisha", "last": "Abubakar", "gender": "female", "staff": "ATBU/LEC/CS/004"},
    {"first": "Kabiru", "last": "Dahiru", "gender": "male", "staff": "ATBU/LEC/CS/005"},
    {"first": "Hauwa", "last": "Suleiman", "gender": "female", "staff": "ATBU/LEC/CS/006"},
    {"first": "Muhammad", "last": "Garba", "gender": "male", "staff": "ATBU/LEC/CS/007"},
    {"first": "Zainab", "last": "Adamu", "gender": "female", "staff": "ATBU/LEC/CS/008"},
]


def lecturer_email(first, last, index):
    return f"{first.lower()}.{last.lower()}.cs@atbu.edu.ng"


class Command(BaseCommand):
    help = "Seed ATBU Computer Science lecturer accounts (idempotent)."

    def handle(self, *args, **options):
        tenant = Tenant.objects.get(slug=TENANT_SLUG)

        faculty = Faculty.objects.get(tenant=tenant, code=FACULTY_CODE)
        department = Department.objects.get(tenant=tenant, code=DEPARTMENT_CODE)

        created, updated, skipped = 0, 0, 0
        for i, spec in enumerate(LECTURERS, start=1):
            email = spec.get("email") or lecturer_email(spec["first"], spec["last"], i)

            user, user_created = User.objects.get_or_create(
                tenant=tenant,
                email=email,
                defaults={
                    "role": User.Role.LECTURER,
                    "first_name": spec["first"],
                    "last_name": spec["last"],
                    "gender": spec["gender"],
                    "is_active": True,
                    "is_email_verified": True,
                },
            )
            if user_created:
                user.set_password(DEFAULT_PASSWORD)
                user.save()
            elif user.role != User.Role.LECTURER:
                user.role = User.Role.LECTURER
                user.save()

            profile, prof_created = LecturerProfile.objects.get_or_create(
                user=user,
                tenant=tenant,
                defaults={
                    "department": department,
                    "staff_number": spec["staff"],
                },
            )
            if not prof_created:
                if (
                    profile.department_id != department.pk
                    or not profile.staff_number
                ):
                    profile.department = department
                    profile.staff_number = spec["staff"]
                    profile.save()
                    updated += 1
                else:
                    skipped += 1
            else:
                created += 1

            self.stdout.write(
                f"  {email} | {spec['first']} {spec['last']} | "
                f"{spec['staff']} {'created' if user_created else 'exists'}"
            )

        self.stdout.write(self.style.SUCCESS(
            f"Done. Lecturers created={created}, profiles updated={updated}, "
            f"skipped={skipped}"
        ))
        total = User.objects.filter(
            tenant=tenant, role=User.Role.LECTURER
        ).count()
        self.stdout.write(f"ATBU total lecturers (role=lecturer): {total}")