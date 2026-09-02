"""
Agent tool registry — each tool accesses data respecting role boundaries.

Tools are plain Python functions that accept (user, params) and return
a dict. The agent_loop calls them based on Gemini function_call responses.
"""
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)


def get_user_profile(user, params=None) -> dict:
    """Return the current user's profile info."""
    return {
        "name": user.full_name,
        "email": user.email,
        "role": user.role,
        "tenant": str(user.tenant_id) if user.tenant_id else None,
    }


def get_user_courses(user, params=None) -> dict:
    """Return courses the user is enrolled in or teaching."""
    from apps.academics.models import CourseEnrollment, LecturerCourseAssignment

    courses = []
    if user.role == "student":
        enrollments = CourseEnrollment.objects.filter(
            student=user, status=CourseEnrollment.Status.ENROLLED,
        ).select_related("course_offering__course")[:20]
        for e in enrollments:
            co = e.course_offering
            courses.append({
                "course_code": co.course.code if co.course else "",
                "course_name": co.course.title if co.course else "",
                "semester": str(co.semester) if co.semester else "",
            })
    elif user.role == "lecturer":
        assignments = LecturerCourseAssignment.objects.filter(
            lecturer=user,
        ).select_related("course_offering__course")[:20]
        for a in assignments:
            co = a.course_offering
            courses.append({
                "course_code": co.course.code if co.course else "",
                "course_name": co.course.title if co.course else "",
            })
    return {"courses": courses, "count": len(courses)}


def get_user_progress(user, params=None) -> dict:
    """Return the user's learning progress across concepts."""
    from apps.learning.models import ProgressRecord

    records = ProgressRecord.objects.filter(user=user).select_related("concept")[:50]
    progress = []
    for r in records:
        progress.append({
            "concept": r.concept.canonical_name if r.concept else "Unknown",
            "progress_value": r.progress_value,
            "last_seen_at": r.last_seen_at.isoformat() if r.last_seen_at else None,
        })
    avg = sum(p["progress_value"] for p in progress) / len(progress) if progress else 0
    return {
        "concepts": progress,
        "average_mastery": round(avg, 1),
        "total_concepts": len(progress),
    }


def get_user_plans(user, params=None) -> dict:
    """Return the user's active plans."""
    from apps.learning.models import Plan

    plans = Plan.objects.filter(user=user, status="active").prefetch_related("milestones")[:10]
    result = []
    for p in plans:
        milestones = []
        for m in p.milestones.all():
            tasks = list(m.tasks.values("id", "title", "status"))
            milestones.append({
                "title": m.title,
                "status": m.status,
                "tasks_count": len(tasks),
                "tasks_done": sum(1 for t in tasks if t["status"] == "done"),
            })
        result.append({
            "title": p.title,
            "type": p.plan_type,
            "target_date": str(p.target_date) if p.target_date else None,
            "milestones": milestones,
        })
    return {"plans": result, "count": len(result)}


def create_plan(user, params=None) -> dict:
    """Create a new plan for the user."""
    from apps.learning.models import Plan, PlanMilestone, PlanTask

    params = params or {}
    title = params.get("title", "Untitled Plan")
    description = params.get("description", "")
    plan_type = params.get("plan_type", "study")
    # Bound the number of rows a single tool call can write (defends against
    # prompt-injected or runaway plan generation).
    milestones_data = (params.get("milestones") or [])[:10]

    plan = Plan.objects.create(
        tenant=user.tenant,
        user=user,
        title=title,
        description=description,
        plan_type=plan_type,
    )

    for i, ms in enumerate(milestones_data):
        milestone = PlanMilestone.objects.create(
            tenant=user.tenant,
            plan=plan,
            title=ms.get("title", f"Milestone {i+1}"),
            description=ms.get("description", ""),
            order=i,
        )
        for task_data in (ms.get("tasks") or [])[:20]:
            PlanTask.objects.create(
                tenant=user.tenant,
                milestone=milestone,
                title=task_data.get("title", "Untitled task"),
                description=task_data.get("description", ""),
                estimated_minutes=task_data.get("estimated_minutes"),
            )

    return {
        "plan_id": str(plan.id),
        "title": plan.title,
        "milestones_count": len(milestones_data),
        "message": f"Plan '{title}' created successfully with {len(milestones_data)} milestones.",
    }


def get_resource_summary(user, params=None) -> dict:
    """Return a summary of resources available to the user."""
    from apps.resources.models import Resource
    from apps.resources.views import _authorized_resources_q

    params = params or {}
    limit = min(params.get("limit", 10), 20)

    resources = Resource.objects.filter(
        _authorized_resources_q(user), tenant=user.tenant,
        processing_status="ready",
    ).order_by("-created_at")[:limit]

    result = []
    for r in resources:
        result.append({
            "id": str(r.id),
            "title": r.title,
            "type": r.mime_type or "unknown",
            "visibility": r.visibility_scope,
        })
    return {"resources": result, "count": len(result)}


def get_quiz_results(user, params=None) -> dict:
    """Return the user's recent quiz attempts."""
    from apps.assessments.models import QuizAttempt

    attempts = QuizAttempt.objects.filter(
        tenant=user.tenant, student=user,
    ).select_related("quiz").order_by("-created_at")[:10]

    results = []
    for a in attempts:
        results.append({
            "quiz_title": a.quiz.title if a.quiz else "Unknown",
            "score": a.score,
            "attempted_at": a.created_at.isoformat() if a.created_at else None,
        })
    avg = sum(r["score"] or 0 for r in results) / len(results) if results else 0
    return {"attempts": results, "average_score": round(avg, 1), "total_attempts": len(results)}


def get_deadlines(user, params=None) -> dict:
    """Return upcoming deadlines (quiz due dates, plan targets)."""
    from django.utils import timezone
    from apps.learning.models import Plan
    from apps.assessments.models import Quiz

    deadlines = []

    # Plan target dates
    plans = Plan.objects.filter(
        user=user, status="active", target_date__isnull=False,
        target_date__gte=timezone.now().date(),
    ).order_by("target_date")[:5]
    for p in plans:
        deadlines.append({
            "type": "plan",
            "title": p.title,
            "date": str(p.target_date),
        })

    return {"deadlines": deadlines, "count": len(deadlines)}


def search_resources(user, params=None) -> dict:
    """Search resources by title."""
    from apps.resources.models import Resource
    from apps.resources.views import _authorized_resources_q

    params = params or {}
    query = params.get("query", "")
    if not query:
        return {"resources": [], "count": 0}

    resources = Resource.objects.filter(
        _authorized_resources_q(user), tenant=user.tenant,
        title__icontains=query,
        processing_status="ready",
    )[:10]

    result = []
    for r in resources:
        result.append({
            "id": str(r.id),
            "title": r.title,
            "type": r.mime_type or "unknown",
        })
    return {"resources": result, "count": len(result)}


# Tool registry: maps function names to callables
TOOL_REGISTRY = {
    "get_user_profile": get_user_profile,
    "get_user_courses": get_user_courses,
    "get_user_progress": get_user_progress,
    "get_user_plans": get_user_plans,
    "create_plan": create_plan,
    "get_resource_summary": get_resource_summary,
    "get_quiz_results": get_quiz_results,
    "get_deadlines": get_deadlines,
    "search_resources": search_resources,
}

# Tool definitions for Gemini function calling
TOOL_DEFINITIONS = [
    {
        "name": "get_user_profile",
        "description": "Get the current user's profile information including name, email, and role.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_user_courses",
        "description": "Get courses the user is enrolled in (student) or teaching (lecturer).",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_user_progress",
        "description": "Get the user's learning progress across concepts, including mastery levels.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_user_plans",
        "description": "Get the user's active study/workflow plans with milestones and tasks.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "create_plan",
        "description": "Create a new study/workflow plan with milestones and tasks.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Plan title"},
                "description": {"type": "string", "description": "Plan description"},
                "plan_type": {"type": "string", "enum": ["study", "workflow", "personal"], "description": "Type of plan"},
                "milestones": {
                    "type": "array",
                    "description": "List of milestones, each with title, description, and tasks",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                            "tasks": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "title": {"type": "string"},
                                        "estimated_minutes": {"type": "integer"},
                                    },
                                },
                            },
                        },
                    },
                },
            },
            "required": ["title"],
        },
    },
    {
        "name": "get_resource_summary",
        "description": "Get a list of resources (materials, documents) available to the user.",
        "parameters": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Max results (default 10)"},
            },
        },
    },
    {
        "name": "get_quiz_results",
        "description": "Get the user's recent quiz attempts and average score.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_deadlines",
        "description": "Get upcoming deadlines for plans and quizzes.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "search_resources",
        "description": "Search available resources by title keyword.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search keyword"},
            },
            "required": ["query"],
        },
    },
]


def execute_tool(tool_name: str, user, params: dict = None) -> dict:
    """Execute a registered tool by name, respecting role boundaries."""
    tool_fn = TOOL_REGISTRY.get(tool_name)
    if not tool_fn:
        return {"error": f"Unknown tool: {tool_name}"}

    start = time.monotonic()
    try:
        result = tool_fn(user, params or {})
        elapsed_ms = int((time.monotonic() - start) * 1000)
        return {"result": result, "execution_time_ms": elapsed_ms, "success": True}
    except Exception as e:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        logger.exception("Tool %s failed", tool_name)
        return {"error": str(e), "execution_time_ms": elapsed_ms, "success": False}
