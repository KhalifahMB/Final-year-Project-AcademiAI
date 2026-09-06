"""
Premium layered Calendar: personal study plans, academic schedules,
exam timetables, office hours, and institution-wide events.

All models are tenant-scoped (RLS-enforced). RBAC is applied at the
view layer — students see personal + their academic events, lecturers
see their teaching schedule + office hours, tenant admins manage the
institutional layer.
"""
from datetime import timedelta

from django.core.validators import MinValueValidator
from django.db import models

from apps.common.models import TenantScopedModel


class CalendarLayer(models.TextChoices):
    """Distinct toggleable layers rendered on the calendar."""

    PERSONAL = "personal", "Personal Study Plans"
    ACADEMIC = "academic", "Academic Lectures"
    EXAMS = "exams", "Exam Timetable"
    OFFICE_HOURS = "office_hours", "Office Hours"
    INSTITUTION = "institution", "Institutional Events"


class CalendarVisibility(models.TextChoices):
    PRIVATE = "private", "Private"
    TENANT = "tenant", "Institution-wide"


class EventStatus(models.TextChoices):
    CONFIRMED = "confirmed", "Confirmed"
    TENTATIVE = "tentative", "Tentative"
    CANCELLED = "cancelled", "Cancelled"


class CalendarEvent(TenantScopedModel):
    """
    A single calendar event. Beyond its own metadata, the event may also
    be derived from an academic structure (a lecture for a CourseOffering),
    a Plan (personal study), an Exam, a Lecturer's office hours, or an
    institution-wide announcement.
    """

    class EventType(models.TextChoices):
        LECTURE = "lecture", "Lecture"
        EXAM = "exam", "Exam"
        STUDY = "study", "Study Session"
        OFFICE_HOURS = "office_hours", "Office Hours"
        INSTITUTION = "institution", "Institution Event"
        REMINDER = "reminder", "Reminder"

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    event_type = models.CharField(max_length=20, choices=EventType.choices, default=EventType.REMINDER)
    layer = models.CharField(
        max_length=20, choices=CalendarLayer.choices, default=CalendarLayer.PERSONAL,
    )

    start = models.DateTimeField(db_index=True)
    end = models.DateTimeField(null=True, blank=True, db_index=True)
    all_day = models.BooleanField(default=False)

    location = models.CharField(max_length=255, blank=True, default="")
    venue = models.CharField(max_length=255, blank=True, default="")
    course_code = models.CharField(max_length=32, blank=True, default="")

    status = models.CharField(
        max_length=20, choices=EventStatus.choices, default=EventStatus.CONFIRMED,
    )
    visibility = models.CharField(
        max_length=20, choices=CalendarVisibility.choices, default=CalendarVisibility.PRIVATE,
    )

    # Ownership (layered access)
    created_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="calendar_events_created",
    )
    user = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="calendar_events",
        help_text="For personal/private events; NULL for institution-wide events.",
    )

    # Source links (derived events keep a reference to their origin).
    course_offering = models.ForeignKey(
        "academics.CourseOffering", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="calendar_events",
    )
    plan = models.ForeignKey(
        "learning.Plan", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="calendar_events",
    )
    office_hours = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+", help_text="Parent event pointer if this is a recurring office-hour slot.",
    )

    recur_rule = models.CharField(
        max_length=255, blank=True, default="",
        help_text="Optional RRULE-compatible recurrence string (e.g. WEEKLY;BYDAY=MO,WE).",
    )
    reminders_minutes = models.JSONField(
        default=list, blank=True,
        help_text="List of lead times in minutes before the event at which to send notifications.",
    )
    notify_enabled = models.BooleanField(default=True)

    color = models.CharField(max_length=16, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "calendar_events"
        ordering = ["start"]
        indexes = [
            models.Index(fields=["tenant", "layer", "start"]),
            models.Index(fields=["tenant", "user", "start"]),
            models.Index(fields=["tenant", "status"]),
            models.Index(fields=["tenant", "course_offering"]),
            models.Index(fields=["tenant", "plan"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.start:%Y-%m-%d %H:%M})"

    @property
    def duration_minutes(self):
        if not self.end:
            return 0
        if self.all_day:
            return 24 * 60
        return int((self.end - self.start).total_seconds() // 60)

    @property
    def is_recurring(self):
        return bool(self.recur_rule)


class CalendarSchedule(TenantScopedModel):
    """
    A bulk-imported timetable (lecture/exam/event) associated with a
    faculty/department. Used by the admin upload wizard to keep track of
    imported timetables so they can be managed or re-imported.
    """

    class ImportType(models.TextChoices):
        LECTURE = "lecture", "Lecture Timetable"
        EXAM = "exam", "Exam Timetable"
        EVENTS = "events", "Events"

    import_type = models.CharField(max_length=20, choices=ImportType.choices)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    file_name = models.CharField(max_length=512, blank=True, default="")
    source_format = models.CharField(max_length=16, default="csv")
    faculty = models.ForeignKey(
        "academics.Faculty", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="calendar_schedules",
    )
    department = models.ForeignKey(
        "academics.Department", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="calendar_schedules",
    )
    uploaded_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="calendar_schedules_uploaded",
    )
    event_count = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    error_count = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    import_log = models.JSONField(default=list, blank=True)
    committed = models.BooleanField(default=False)

    class Meta:
        db_table = "calendar_schedules"
        ordering = ["-created_at"]
