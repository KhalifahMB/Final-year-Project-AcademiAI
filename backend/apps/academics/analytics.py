"""
Per-course-offering analytics for lecturers and tenant admins (Power Tools).

A single drill-down call from the offering detail page that the tenant-wide
LecturerDashboardView cannot answer: cohort engagement on this offering's
materials, per-quiz performance with weakest questions, and per-student risk.

Scoping rules (mirror dashboard.py):
- tenant admins (and platform superusers) may view any offering in their tenant
- lecturers may view ONLY offerings they are assigned to (LecturerCourseAssignment)
- students get a 403 for permission reasons (the UI only renders for staff)

Resource engagement is sourced from apps.resources.ResourceAccess events,
aggregated over enrolled students only, so lecturers' own previews/downloads
never skew cohort numbers.
"""
import logging

from django.db.models import Avg, Count, Max
from django.utils import timezone
from apps.assessments.answer_utils import is_answer_correct

from apps.academics.models import CourseEnrollment, LecturerCourseAssignment
from apps.assessments.models import Quiz, QuizAttempt, QuizQuestion
from apps.resources.models import Resource, ResourceAccess

logger = logging.getLogger(__name__)

MAX_ENGAGEMENT_ITEMS = 15
MAX_AT_RISK_ROWS = 30
WEAKEST_MIN_ATTEMPTS = 2
AT_RISK = 50
WATCH = 65


def _is_admin(user):
    return bool(getattr(user, "is_tenant_admin", False)) or bool(
        getattr(user, "is_superuser", False)
    )


def can_view_offering_analytics(offering, user) -> bool:
    """Analytics admission: assigned lecturer or tenant admin/superuser."""
    if user is None or not getattr(user, "tenant_id", None):
        return False
    if _is_admin(user):
        return True
    if getattr(user, "role", None) != "lecturer":
        return False
    return LecturerCourseAssignment.objects.filter(
        tenant_id=user.tenant_id, lecturer=user, course_offering_id=offering.id
    ).exists()


def _is_correct(question, answer):
    return is_answer_correct(question.correct_answer, answer)


class CourseOfferingAnalytics:
    """Aggregations for one offering. Public api: ``.build(offering, user)``."""

    @staticmethod
    def build(offering, user):
        tid = offering.tenant_id
        now = timezone.now()

        # --- KPIs -------------------------------------------------------
        enrolled = CourseEnrollment.objects.filter(
            tenant_id=tid,
            course_offering_id=offering.id,
            status=CourseEnrollment.Status.ENROLLED,
        ).count()
        materials = Resource.objects.filter(
            tenant_id=tid, course_offering_id=offering.id
        ).count()
        quiz_count = Quiz.objects.filter(
            tenant_id=tid, course_offering_id=offering.id
        ).count()

        attempt_qs = QuizAttempt.objects.filter(
            tenant_id=tid, quiz__course_offering_id=offering.id, submitted_at__isnull=False
        )
        submissions = attempt_qs.count()
        graded_qs = attempt_qs.filter(score__isnull=False)
        graded = graded_qs.count()
        avg_score = (graded_qs.aggregate(avg=Avg("score"))["avg"] or 0) if graded else 0
        completion_pct = round(graded / submissions * 100) if submissions else None

        # --- Engagement ------------------------------------------------
        # Students-only events so staff usage never inflates cohort numbers.
        student_access = ResourceAccess.objects.filter(
            tenant_id=tid,
            resource__course_offering_id=offering.id,
            user__role="student",
        )
        counts = {
            (r["resource_id"], r["access_type"]): r["n"]
            for r in student_access.values("resource_id", "access_type").annotate(
                n=Count("id")
            )
        }
        uniques = {
            r["resource_id"]: r["us"]
            for r in student_access.values("resource_id").annotate(
                us=Count("user_id", distinct=True)
            )
        }
        last_seen = {
            r["resource_id"]: r["la"]
            for r in student_access.values("resource_id").annotate(la=Max("occurred_at"))
        }

        title_map = dict(
            Resource.objects.filter(
                tenant_id=tid, course_offering_id=offering.id, id__in=list(uniques.keys())
            ).values_list("id", "title")
        )
        engagement_items = []
        for rid in uniques:
            views = counts.get((rid, ResourceAccess.AccessType.VIEW), 0)
            downloads = counts.get((rid, ResourceAccess.AccessType.DOWNLOAD), 0)
            engagement_items.append(
                {
                    "resource_id": str(rid),
                    "title": title_map.get(rid) or "Untitled",
                    "views": views,
                    "downloads": downloads,
                    "unique_students": uniques[rid],
                    "last_accessed": (
                        last_seen[rid].isoformat() if last_seen.get(rid) else None
                    ),
                }
            )
        engagement_items.sort(
            key=lambda r: (r["views"] + r["downloads"]), reverse=True
        )
        engagement_items = engagement_items[:MAX_ENGAGEMENT_ITEMS]

        # --- Quiz performance ------------------------------------------
        quiz_attempt_counts = {
            r["quiz_id"]: r["n"]
            for r in attempt_qs.values("quiz_id").annotate(n=Count("id"))
        }
        quiz_graded_counts = {
            r["quiz_id"]: r["n"]
            for r in graded_qs.values("quiz_id").annotate(n=Count("id"))
        }
        quiz_avg = {
            r["quiz_id"]: (r["avg"] or 0)
            for r in graded_qs.values("quiz_id").annotate(avg=Avg("score"))
        }
        quiz_rows = (
            Quiz.objects.filter(tenant_id=tid, course_offering_id=offering.id)
            .values_list("id", "title")
        )
        quiz_performance = []
        for qid, title in quiz_rows:
            tries = quiz_attempt_counts.get(qid, 0)
            quiz_performance.append(
                {
                    "quiz_id": str(qid),
                    "title": title,
                    "attempts": tries,
                    "avg_score_pct": round(quiz_avg.get(qid, 0)),
                    "completion_rate": (
                        round(quiz_graded_counts.get(qid, 0) / tries * 100)
                        if tries
                        else None
                    ),
                }
            )
        quiz_performance.sort(key=lambda q: (q["avg_score_pct"],), reverse=True)

        # Weakest questions: mirror the grading logic in the review
        # serializer so "correct%" matches what students see after submit.
        questions = list(
            QuizQuestion.objects.filter(
                tenant_id=tid, quiz__course_offering_id=offering.id
            )
            .select_related("quiz")
            .order_by("quiz_id", "order_index")
        )
        question_by_id = {str(q.id): q for q in questions}
        correct = {str(q.id): 0 for q in questions}
        q_attempts = {str(q.id): 0 for q in questions}
        for quiz_id, answers in attempt_qs.values_list("quiz_id", "answers"):
            for qid, answer in (answers or {}).items():
                q = question_by_id.get(qid)
                if q is None:
                    continue
                q_attempts[qid] += 1
                if _is_correct(q, answer):
                    correct[qid] += 1

        weakest = []
        for qid in q_attempts:
            tries = q_attempts[qid]
            if tries < WEAKEST_MIN_ATTEMPTS or qid not in question_by_id:
                continue
            q = question_by_id[qid]
            pct = round(correct[qid] / tries * 100)
            weakest.append(
                {
                    "question_id": qid,
                    "quiz_id": str(q.quiz_id),
                    "quiz_title": q.quiz.title,
                    "text_preview": q.question_text[:160],
                    "correct_pct": pct,
                    "attempts": tries,
                }
            )
        weakest.sort(key=lambda w: w["correct_pct"])
        weakest = weakest[:8]

        # --- At-risk students ------------------------------------------
        enrollments = list(
            CourseEnrollment.objects.filter(
                tenant_id=tid,
                course_offering_id=offering.id,
                status=CourseEnrollment.Status.ENROLLED,
            )
            .select_related("student")
            .order_by("student__first_name", "student__last_name")
        )
        attempt_agg = {
            r["student_id"]: r
            for r in graded_qs.values("student_id").annotate(
                avg_score=Avg("score"),
                attempts=Count("id"),
                last_attempt=Max("submitted_at"),
            )
        }
        access_agg = {
            r["user_id"]: r
            for r in student_access.values("user_id").annotate(
                resources_opened=Count("resource_id", distinct=True),
                last_access=Max("occurred_at"),
            )
        }

        def _row(e):
            est = attempt_agg.get(e.student_id, {})
            acc = access_agg.get(e.student_id, {})
            avg = est.get("avg_score") or 0
            attempts = est.get("attempts") or 0
            opened = acc.get("resources_opened") or 0
            stamps = [
                t for t in (est.get("last_attempt"), acc.get("last_access")) if t
            ]
            last_active = max(stamps) if stamps else None
            if attempts == 0 and opened == 0:
                status = "inactive"
            elif avg < AT_RISK:
                status = "at_risk"
            elif avg < WATCH:
                status = "watch"
            else:
                status = "ok"
            return {
                "student_id": str(e.student_id),
                "name": e.student.full_name or e.student.email,
                "email": e.student.email,
                "avg_score": round(avg),
                "attempts": attempts,
                "resources_opened": opened,
                "last_activity_days": (now - last_active).days if last_active else None,
                "status": status,
            }

        order = {"at_risk": 0, "watch": 1, "inactive": 2, "ok": 3}
        at_risk = sorted(
            (_row(e) for e in enrollments),
            key=lambda r: (order.get(r["status"], 9), r["avg_score"]),
        )
        at_risk = at_risk[:MAX_AT_RISK_ROWS]
        risked = sum(
            1 for r in at_risk if r["status"] in ("at_risk", "inactive")
        )

        active_students = len(
            set(attempt_agg.keys()) | set(access_agg.keys())
        )

        return {
            "offering": {
                "id": str(offering.id),
                "course_code": offering.course.code,
                "course_title": offering.course.title,
                "session_name": offering.academic_session.name,
                "semester_name": offering.semester.name,
            },
            "kpis": {
                "enrolled": enrolled,
                "active_students": active_students,
                "materials": materials,
                "quizzes": quiz_count,
                "quiz_submissions": submissions,
                "avg_score_pct": round(avg_score) if graded else None,
                "completion_pct": completion_pct,
                "at_risk_students": risked,
            },
            "engagement": {
                "items": engagement_items,
                "total_views": sum(r["views"] for r in engagement_items),
            },
            "quiz_performance": quiz_performance,
            "weakest_questions": weakest,
            "at_risk": at_risk,
        }