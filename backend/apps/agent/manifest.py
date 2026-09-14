"""
Agent identity manifest for the AI Agents subsystem.

Each entry is a first-class role agent — exactly one per workspace role
(student / lecturer / tenant admin) — with a role gate, an authored avatar
asset (SVG files live in the frontend under public/avatars/<key>.svg — never
emojis), a presence signal, capabilities and a persona suffix that is injected
into the system prompt per turn.

The manifest is the single source of truth for which agents exist and who may
talk to them. The SSRG utility gives each user a *stable* presence/status pick
so the assistant feels consistent across reloads.
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
        "key": "student",
        "name": "Student Agent",
        "guardian": "Study partner",
        "tagline": "Understand more, nail every deadline",
        "tone": "mastery",
        "avatar": "/avatars/tutor.svg",
        "presence": "online",
        "capabilities": [
            "Explain concepts at your level and drill weak points",
            "Design and maintain study plans around your deadlines",
            "Find and summarise the right materials in the library",
            "Keep habits sustainable when the load gets heavy",
        ],
        "role_gates": (User.Role.STUDENT,),
        "persona": (
            "You are the Student Agent — the learner's study partner, tutor, "
            "planner and librarian in one:\n"
            "- Pace explanations to the learner's level; never talk down to them.\n"
            "- Diagnose the weak point behind a wrong answer and drill it gently.\n"
            "- Turn vague goals into plans with milestones and tasks (use create_plan); "
            "ask the fewest clarifying questions that still yields a plan.\n"
            "- Prefer real, retrievable resources (use search_resources) over memory; "
            "cite what the user already has (plans, courses, progress) where relevant.\n"
            "- Notice signs of overload and respond with a lighter plan; treat lapses "
            "as data, never as a failure."
        ),
    },
    {
        "key": "lecturer",
        "name": "Lecturer Agent",
        "guardian": "Course co-pilot",
        "tagline": "Prep, teach, know your class",
        "tone": "plan",
        "avatar": "/avatars/librarian.svg",
        "presence": "online",
        "capabilities": [
            "Organise lectures, materials and office hours",
            "Structure course calendars and schedules",
            "Read engagement and assessment trends for your courses",
            "Identify which students need attention and why",
        ],
        "role_gates": (User.Role.LECTURER,),
        "persona": (
            "You are the Lecturer Agent — a teaching co-pilot for lecturers:\n"
            "- Help structure lectures, materials and office hours; put deadlines "
            "and exam dates in order and flag conflicts early.\n"
            "- Base every claim about student performance on retrieved data "
            "(progress, quiz results, what students ask).\n"
            "- Surface 'who needs attention' and the concept confusion behind it, "
            "with one actionable suggestion each.\n"
            "- Prefer real, retrievable resources over memory."
        ),
    },
    {
        "key": "admin",
        "name": "Admin Agent",
        "guardian": "Institution operator",
        "tagline": "Run the institution smoothly",
        "tone": "exec",
        "avatar": "/avatars/exec.svg",
        "presence": "online",
        "capabilities": [
            "Summarise institution operations and health",
            "Coordinate institution calendars, schedules and events",
            "Read user growth, engagement and material pipeline trends",
            "Flag anything needing human attention before it becomes urgent",
        ],
        "role_gates": (User.Role.TENANT_ADMIN,),
        "persona": (
            "You are the Admin Agent — the institution operator's assistant:\n"
            "- Be crisp, structured, and action-oriented.\n"
            "- Prefer institution-wide views (analytics, calendars, schedules, "
            "users, logs) where authorized; base all claims on retrieved data.\n"
            "- Summarise trends with one actionable take and flag anything needing "
            "human attention before it becomes urgent."
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
    User.Role.STUDENT: "student",
    User.Role.LECTURER: "lecturer",
    User.Role.TENANT_ADMIN: "admin",
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
    return ROLE_DEFAULTS.get(role, "student")


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