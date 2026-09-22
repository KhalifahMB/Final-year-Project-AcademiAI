"""
Plans -> Calendar sync signals.

Plans (and their dated milestones) are surfaced onto the Calendar as
personal study events. Deleting a plan removes its linked events.
"""
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from apps.assessments.models import QuizAttempt
from apps.learning.models import Plan, PlanMilestone, ResourceReadingPosition
from apps.calendar.services.sync import (
    sync_plan_to_calendar,
    sync_milestone_to_calendar,
    sync_remove_plan_events,
)
from apps.learning.services.progress import (
    recompute_for_quiz,
    recompute_for_reading,
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


@receiver(post_save, sender=ResourceReadingPosition, dispatch_uid="reading_position_to_progress__post_save")
def reading_position_post_save(sender, instance, **kwargs):
    """Reading a concept's material updates the student's mastery for it."""
    recompute_for_reading(instance.user_id, instance.tenant_id, instance.resource_id)


@receiver(post_save, sender=QuizAttempt, dispatch_uid="quiz_attempt_to_progress__post_save")
def quiz_attempt_post_save(sender, instance, **kwargs):
    """A scored, submitted quiz attempt updates mastery for its concepts."""
    if instance.submitted_at is None or instance.score is None:
        return
    recompute_for_quiz(instance.student_id, instance.tenant_id, instance.quiz)
