"""
Plans -> Calendar sync signals.

Plans (and their dated milestones) are surfaced onto the Calendar as
personal study events. Deleting a plan removes its linked events.
"""
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from apps.learning.models import Plan, PlanMilestone
from apps.calendar.services.sync import (
    sync_plan_to_calendar,
    sync_milestone_to_calendar,
    sync_remove_plan_events,
)


@receiver(post_save, sender=Plan, dispatch_uid="plan_to_calendar__post_save")
def plan_post_save(sender, instance, created, **kwargs):
    sync_plan_to_calendar(instance, creating=created)


@receiver(pre_delete, sender=Plan, dispatch_uid="plan_to_calendar__pre_delete")
def plan_pre_delete(sender, instance, **kwargs):
    sync_remove_plan_events(instance.id, instance.tenant_id)


@receiver(post_save, sender=PlanMilestone, dispatch_uid="milestone_to_calendar__post_save")
def milestone_post_save(sender, instance, created, **kwargs):
    sync_milestone_to_calendar(instance, creating=created)


@receiver(pre_delete, sender=PlanMilestone, dispatch_uid="milestone_to_calendar__pre_delete")
def milestone_pre_delete(sender, instance, **kwargs):
    from apps.calendar.models import CalendarEvent

    CalendarEvent.objects.filter(
        tenant_id=instance.plan.tenant_id,
        plan=instance.plan,
        metadata__source="plan",
        metadata__sync_key=f"milestone:{instance.id}",
    ).delete()
