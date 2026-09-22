"""
Per-concept mastery computation for the Progress page.

ProgressRecords are not created by any endpoint — they are recomputed
reactively from evidence the student produces:

* reading: `ResourceReadingPosition.scroll_percentage` for the concept's
  linked resources
* quizzing: scores on `QuizAttempt`s for quizzes whose course offering
  links to the concept's resources

The recompute functions below are triggered from signals fired inside
requests (middleware has already bound the tenant), so they run without an
explicit `tenant_scope()`.
"""
from django.db.models import Avg

from apps.learning.models import ProgressRecord, ResourceReadingPosition


def recompute_for_reading(user_id, tenant_id, resource_id):
    """Recompute mastery for every concept attached to a read resource."""
    from apps.knowledge.models import ResourceConcept

    concept_ids = (
        ResourceConcept.objects.filter(resource_id=resource_id)
        .values_list("concept_id", flat=True)
        .distinct()
    )
    for concept_id in concept_ids:
        _recompute_concept(user_id, tenant_id, concept_id)


def recompute_for_quiz(student_id, tenant_id, quiz):
    """Recompute mastery for every concept reachable through a quiz's course offering.

    Quizzes map to concepts transitively: quiz -> course_offering -> resources
    -> resource_concepts -> concept. A quiz with no course offering contributes
    no concept evidence.
    """
    if not quiz.course_offering_id:
        return
    from apps.knowledge.models import ResourceConcept

    concept_ids = (
        ResourceConcept.objects.filter(
            resource__course_offering_id=quiz.course_offering_id
        )
        .values_list("concept_id", flat=True)
        .distinct()
    )
    for concept_id in concept_ids:
        _recompute_concept(student_id, tenant_id, concept_id)


def _recompute_concept(user_id, tenant_id, concept_id):
    """Compute and upsert one (user, concept) ProgressRecord.

    mastery = round(100 * (0.4 * read_score + 0.6 * quiz_score))

    read_score: average depth over the concept's resources the user has opened.
    quiz_score: average score (0-1) over submitted attempts on quizzes mapped
                to the concept.
    """
    read_score = _read_score(user_id, concept_id)
    quiz_score = _quiz_score(user_id, concept_id)
    mastery = round(100.0 * (0.4 * read_score + 0.6 * quiz_score))

    # No supporting evidence -> drop any stale record rather than tracking a
    # 0% concept (e.g. concept re-linked away from everything the user read).
    if mastery <= 0:
        ProgressRecord.objects.filter(
            tenant_id=tenant_id, user_id=user_id, concept_id=concept_id,
        ).delete()
        return

    ProgressRecord.objects.update_or_create(
        tenant_id=tenant_id,
        user_id=user_id,
        concept_id=concept_id,
        defaults={"progress_value": float(mastery)},
    )


def _read_score(user_id, concept_id):
    """Fractional reading depth: avg scroll% over the concept's opened resources."""
    from apps.knowledge.models import ResourceConcept

    resource_ids = (
        ResourceConcept.objects.filter(concept_id=concept_id)
        .values_list("resource_id", flat=True)
        .distinct()
    )
    if not resource_ids:
        return 0.0
    agg = (
        ResourceReadingPosition.objects.filter(
            user_id=user_id,
            resource_id__in=list(resource_ids),
        )
        .aggregate(score=Avg("scroll_percentage"))
    )
    depth = agg["score"] or 0.0
    return depth / 100.0


def _quiz_score(user_id, concept_id):
    """Fractional quiz score: avg 0-1 over submitted attempts on mapped quizzes."""
    from apps.assessments.models import QuizAttempt

    attempts = QuizAttempt.objects.filter(
        student_id=user_id,
        submitted_at__isnull=False,
        score__isnull=False,
        quiz__course_offering__resources__resource_concepts__concept_id=concept_id,
    )
    agg = attempts.aggregate(score=Avg("score"))
    avg = agg["score"] or 0.0
    return avg / 100.0