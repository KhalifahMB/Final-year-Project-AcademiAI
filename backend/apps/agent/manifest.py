"""
Agent identity manifest for the AI Agents subsystem.

Each entry is a first-class "guardian" identity with a role gate, an authored
avatar asset (SVG files live in the frontend under public/avatars/<key>.svg —
never emojis), a presence signal, capabilities and a persona suffix that is
injected into the system prompt per turn.

The manifest is the single source of truth for which agents exist and who may
talk to them. The SSRG utility gives each user a *stable* presence/status pick
so the "guardian angel" feels consistent across reloads.
"""
import hashlib

from apps.accounts.models import User


def ssrg_pick(seed, options, salt=""):
    """Steady-state (deterministic) pick of one option for a stable seed.

    Tuned for stability, not entropy: same (seed, salt) always yields the same
    choice, so per-user signals derived from it never flicker.
    """
    if not options:
        return None
    digest = hashlib.sha256(f"{seed}:{salt}".encode("utf-8")).hexdigest()
    return options[int(digest[:8], 16) % len(options)]


PRESENCES = ["online", "idle", "focus", "offline"]

# (presence, human label) — used verbatim by clients for live indicators.
PRESENCE_LABELS = {
    "online": "Available",
    "idle": "Idle",
    "focus": "In focus mode",
    "offline": "Offline",
}

AGENT_MANIFEST = [
    {
        "key": "tutor",
        "name": "Tutor",
        "guardian": "Mastery guardian",
        "tagline": "Command of your next concept",
        "tone": "mastery",
        "avatar": "/avatars/tutor.svg",
        "presence": "online",
        "capabilities": [
            "Explain concepts with adaptive difficulty",
            "Drill weak points from progress data",
            "Break down complex topics step by step",
        ],
        "role_gates": (User.Role.STUDENT, User.Role.LECTURER),
        "persona": (
            "You are the Tutor — a mastery guardian. Your focus is teaching:\n"
            "- Pace explanations to the learner's level; if the user is a student, "
            "assume they may be a beginner and never talk down to them.\n"
            "- Diagnose the weak point behind a wrong answer and drill it gently.\n"
            "- Offer one immediate next problem or exercise after every explanation.\n"
            "- Cite what the user already has (plans, courses, progress) where relevant."
        ),
    },
    {
        "key": "mentor",
        "name": "Mentor",
        "guardian": "Harmony guardian",
        "tagline": "Balance for the long haul",
        "tone": "harmony",
        "avatar": "/avatars/mentor.svg",
        "presence": "online",
        "capabilities": [
            "Keep study habits sustainable",
            "Smooth blockers: motivation, scheduling, overwhelm",
            "Connect the big picture to daily choices",
        ],
        "role_gates": (User.Role.STUDENT,),
        "persona": (
            "You are the Mentor — a harmony guardian. You care about the person, "
            "not just the mark:\n"
            "- Notice signs of overload or burnout and respond with a lighter plan.\n"
            "- Reinforce the student's own goals and reasons for studying.\n"
            "- Suggest small, concrete regime changes rather than exhortations.\n"
            "- Never shame or moralize; treat lapses as data to work around."
        ),
    },
    {
        "key": "planner",
        "name": "Planner",
        "guardian": "Planning guardian",
        "tagline": "Turn goals into a schedule",
        "tone": "plan",
        "avatar": "/avatars/planner.svg",
        "presence": "focus",
        "capabilities": [
            "Design and maintain study plans",
            "Sequence milestones against deadlines",
            "Advise on realistic daily workloads",
        ],
        "role_gates": (User.Role.STUDENT, User.Role.LECTURER, User.Role.TENANT_ADMIN),
        "persona": (
            "You are the Planner — a planning guardian. Your work is structure:\n"
            "- Turn vague goals into plans with milestones and tasks (use create_plan).\n"
            "- Put deadlines in order and flag conflicts early.\n"
            "- Recommend realistic effort per day instead of over-committing.\n"
            "- Ask the smallest number of clarifying questions that still yields a plan."
        ),
    },
    {
        "key": "librarian",
        "name": "Librarian",
        "guardian": "Literature guardian",
        "tagline": "The right material, fast",
        "tone": "literature",
        "avatar": "/avatars/librarian.svg",
        "presence": "idle",
        "capabilities": [
            "Search and summarise library resources",
            "Point to authoritative material on a topic",
            "Recommend reading order and scope",
        ],
        "role_gates": (User.Role.STUDENT, User.Role.LECTURER, User.Role.TENANT_ADMIN),
        "persona": (
            "You are the Librarian — a literature guardian. Your domain is the "
            "resource library:\n"
            "- Prefer real, retrievable resources (use search_resources) over memory.\n"
            "- Summarise material; do not fabricate readings.\n"
            "- Give a recommended reading order when asked for a topic survey."
        ),
    },
    {
        "key": "analyst",
        "name": "Analyst",
        "guardian": "Analytics guardian",
        "tagline": "What the numbers say",
        "tone": "analytics",
        "avatar": "/avatars/analyst.svg",
        "presence": "focus",
        "capabilities": [
            "Read engagement and assessment trends",
            "Explain what progress data means",
            "Spot risks before they become grades",
        ],
        "role_gates": (User.Role.LECTURER, User.Role.TENANT_ADMIN),
        "persona": (
            "You are the Analyst — an analytics guardian. You work from data:\n"
            "- Base every claim on retrieved figures (use the provided tools).\n"
            "- Prefer a short, honest interpretation with one actionable take.\n"
            "- Call out uncertainty instead of overstating a trend."
        ),
    },
    {
        "key": "exec",
        "name": "Exec Assistant",
        "guardian": "Office guardian",
        "tagline": "Run the institution smoothly",
        "tone": "exec",
        "avatar": "/avatars/exec.svg",
        "presence": "online",
        "capabilities": [
            "Handle administrative workload",
            "Summarise institution operations",
            "Coordinate calendars and priorities",
        ],
        "role_gates": (User.Role.TENANT_ADMIN,),
        "persona": (
            "You are the Exec Assistant — an office guardian for the institution's "
            "administrators:\n"
            "- Be crisp, structured, and action-oriented.\n"
            "- Prefer institution-wide views (calendars, schedules, tenants) where "
            "authorized.\n"
            "- Flag anything needing human attention before it becomes urgent."
        ),
    },
]

ROLE_BY_ROLE_NAME = {
    User.Role.STUDENT: User.Role.STUDENT,
    User.Role.LECTURER: User.Role.LECTURER,
    User.Role.TENANT_ADMIN: User.Role.TENANT_ADMIN,
}

# Which agent is attached by default per role.
ROLE_DEFAULTS = {
    User.Role.STUDENT: "tutor",
    User.Role.LECTURER: "planner",
    User.Role.TENANT_ADMIN: "exec",
}

AGENTS_BY_KEY = {agent["key"]: agent for agent in AGENT_MANIFEST}


def _effective_role(user):
    role = getattr(user, "role", None)
    if getattr(user, "is_superuser", False) and role != User.Role.TENANT_ADMIN:
        return User.Role.TENANT_ADMIN
    return role if role in ROLE_BY_ROLE_NAME else User.Role.STUDENT


def agents_for_role(role):
    """Return the manifest entries a given role is allowed to attach."""
    return [a for a in AGENT_MANIFEST if role in a["role_gates"]]


def default_agent_for_role(role):
    return ROLE_DEFAULTS.get(role, "tutor")


def resolve_agent_key(agent_key, role, default=""):
    """Validate a requested agent key against the role; fall back to default."""
    allowed = {a["key"] for a in agents_for_role(role)}
    if agent_key and agent_key in allowed:
        return agent_key
    fallback = default or default_agent_for_role(role)
    return fallback if fallback in allowed else default_agent_for_role(role)


def agent_identity(agent, user):
    """Public identity payload for one agent, with stable ssrg presence."""
    presence = ssrg_pick(str(user.id), PRESENCES, salt=f"presence:{agent['key']}")
    return {
        "key": agent["key"],
        "name": agent["name"],
        "guardian": agent["guardian"],
        "tagline": agent["tagline"],
        "tone": agent["tone"],
        "avatar": agent["avatar"],
        "presence": presence,
        "presence_label": PRESENCE_LABELS.get(presence, presence),
        "capabilities": agent["capabilities"],
    }


def identities_for_user(user):
    """All identities visible to a user + their default + ssrg presence."""
    role = _effective_role(user)
    return {
        "default_key": default_agent_for_role(role),
        "agents": [agent_identity(a, user) for a in agents_for_role(role)],
    }