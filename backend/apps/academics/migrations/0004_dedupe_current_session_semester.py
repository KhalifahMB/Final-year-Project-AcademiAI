"""
Data migration: enforce single-current invariant for sessions and semesters.

For each tenant, if multiple sessions or semesters have is_current=True,
keep only the latest (by start_date) and clear the rest.
"""
from django.db import migrations


def dedupe_current_sessions(apps, schema_editor):
    AcademicSession = apps.get_model("academics", "AcademicSession")
    all_tenants = set(AcademicSession.objects.values_list("tenant_id", flat=True))
    for tid in all_tenants:
        current = AcademicSession.objects.filter(
            tenant_id=tid, is_current=True
        ).order_by("-start_date")
        if current.count() > 1:
            keep = current.first()
            current.exclude(id=keep.id).update(is_current=False)


def dedupe_current_semesters(apps, schema_editor):
    Semester = apps.get_model("academics", "Semester")
    all_tenants = set(Semester.objects.values_list("tenant_id", flat=True))
    for tid in all_tenants:
        current = Semester.objects.filter(
            tenant_id=tid, is_current=True
        ).order_by("-start_date")
        if current.count() > 1:
            keep = current.first()
            current.exclude(id=keep.id).update(is_current=False)


def forwards(apps, schema_editor):
    dedupe_current_sessions(apps, schema_editor)
    dedupe_current_semesters(apps, schema_editor)


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0003_semester_is_current"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]