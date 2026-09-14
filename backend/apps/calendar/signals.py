"""
Calendar -> Plans sync signals.

Personal study events scheduled directly on the Calendar page are mirrored
into a Plan record so the Plans page converges instantly. Linked plans are
kept in sync on update and removed on delete.
"""
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from apps.calendar.models import CalendarEvent
from apps.calendar.services.sync import (
    sync_calendar_event_to_plan,
    sync_update_plan_from_event,
    sync_delete_plan_from_event,
)


@receiver(post_save, sender=CalendarEvent, dispatch_uid="calendar_to_plan__post_save")
def calendar_event_post_save(sender, instance, created, **kwargs):
    if instance.metadata.get("source") == "plan":
        # Generated from a plan — do not round-trip back into a plan.
        return
    if created:
        sync_calendar_event_to_plan(instance)
    else:
        sync_update_plan_from_event(instance)


@receiver(pre_delete, sender=CalendarEvent, dispatch_uid="calendar_to_plan__pre_delete")
def calendar_event_pre_delete(sender, instance, **kwargs):
    sync_delete_plan_from_event(instance)
