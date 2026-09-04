"""
Agent orchestration loop: receive message → build context → call Gemini
with tools → execute tool calls → feed results back → repeat → stream.
"""
import json
import logging
import time

from django.conf import settings

logger = logging.getLogger(__name__)

AGENT_SYSTEM_PROMPT = """You are AcademiAI Agent, an intelligent academic assistant embedded across the platform. You help students, lecturers, and administrators with their academic tasks.

Your capabilities:
- Answer questions about the user's courses, progress, and academic standing
- Help create and manage study plans
- Provide insights on learning progress and suggest areas to focus on
- Search and summarize available resources
- Track deadlines and upcoming tasks

Rules:
1. Always respect role boundaries — you can only access data the current user is authorized to see.
2. Use tools to fetch real data before making claims. Never fabricate information.
3. Be concise and actionable. Suggest specific next steps when possible.
4. Format responses in clean Markdown with headers, bullet points, and emphasis where helpful.
5. When creating plans, ask clarifying questions if the user's request is vague.
6. You are not a replacement for the chat tutor — redirect course-content questions to the chat.
"""


CONTEXT_TYPES = {"dashboard", "chat", "plans", "resources"}


def build_agent_prompt(user, context_type, history):
    """Build the system prompt with user context injected."""
    from apps.common.ai.gemini import _sanitize_context

    from .tools import get_user_profile, get_user_courses

    # Sanitize untrusted/user-derived data before it reaches the system
    # prompt to prevent prompt-injection overriding the agent's rules.
    safe_context_type = _sanitize_context(str(context_type), 40) or "dashboard"
    profile = get_user_profile(user)
    courses_data = get_user_courses(user)
    courses_json = _sanitize_context(
        json.dumps(courses_data["courses"][:5], indent=2), 2000
    )

    context_section = (
        f"\n\nCurrent User Context:\n"
        f"- Name: {_sanitize_context(profile['name'], 100)}\n"
        f"- Role: {_sanitize_context(profile['role'], 40)}\n"
        f"- Courses: {courses_json}\n"
        f"- Context type: {safe_context_type}\n"
    )

    return AGENT_SYSTEM_PROMPT + context_section


def run_agent_turn(client, model_name, user, message, context_type, history=None, session=None):
    """
    Execute a single agent turn with tool-use loop.
    Yields (event_type, data) tuples for SSE streaming.

    Events:
    - ("token", {"text": "..."})
    - ("tool_call", {"tool": "...", "params": {...}})
    - ("tool_result", {"tool": "...", "result": {...}})
    - ("done", {"response": "..."})
    - ("error", {"message": "..."})
    """
    from apps.agent.models import AgentToolExecution
    from .tools import TOOL_DEFINITIONS, execute_tool

    history = list(history or [])
    if session is not None:
        stored_history = getattr(session, "recent_messages", None) or []
        if stored_history:
            history = list(stored_history)
    system_prompt = build_agent_prompt(user, context_type, history)

    # Build conversation
    contents = []
    for msg in history:
        role = msg.get("role") if isinstance(msg, dict) else None
        content = msg.get("content") if isinstance(msg, dict) else None
        if role and content is not None:
            contents.append({"role": role, "parts": [{"text": content}]})
    contents.append({"role": "user", "parts": [{"text": message}]})

    max_iterations = 5
    full_response = ""

    def persist_session_history(final_text: str = "") -> None:
        if session is None:
            return
        session_history = list(history)
        session_history.append({"role": "user", "content": message})
        if final_text:
            session_history.append({"role": "assistant", "content": final_text})
        session.recent_messages = session_history[-20:]
        session.save(update_fields=["recent_messages", "last_active_at"])

    for iteration in range(max_iterations):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config={
                    "system_instruction": system_prompt,
                    "tools": [{"function_declarations": TOOL_DEFINITIONS}],
                    "automatic_function_calling": {"disable": True},
                },
            )

            function_calls = []
            text_parts = []

            for part in response.candidates[0].content.parts:
                if hasattr(part, "function_call") and part.function_call:
                    function_calls.append(part.function_call)
                elif hasattr(part, "text") and part.text:
                    text_parts.append(part.text)

            if not function_calls:
                final_text = "".join(text_parts).strip()
                full_response += final_text
                yield ("token", {"text": final_text})
                persist_session_history(full_response)
                break

            tool_results = []
            for fc in function_calls:
                tool_name = fc.name
                tool_params = dict(fc.args) if fc.args else {}

                yield ("tool_call", {"tool": tool_name, "params": tool_params})

                result = execute_tool(tool_name, user, tool_params)
                if session is not None:
                    AgentToolExecution.objects.create(
                        tenant=session.tenant,
                        session=session,
                        tool_name=tool_name,
                        input_params=tool_params,
                        output_summary=json.dumps(result.get("result", result), default=str)[:2000],
                        execution_time_ms=result.get("execution_time_ms"),
                        success=result.get("success", True),
                    )
                tool_results.append({
                    "function_response": {
                        "name": tool_name,
                        "response": result.get("result", result),
                    }
                })

                yield ("tool_result", {"tool": tool_name, "result": result.get("result", {})})

            contents.append({"role": "model", "parts": response.candidates[0].content.parts})
            contents.append({"role": "user", "parts": tool_results})

        except Exception:
            logger.exception("Agent turn failed at iteration %d", iteration)
            yield ("error", {"message": "I encountered an error processing your request. Please try again."})
            persist_session_history(full_response)
            return

    yield ("done", {"response": full_response})
