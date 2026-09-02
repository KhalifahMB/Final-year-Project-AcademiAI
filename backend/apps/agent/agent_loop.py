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


def run_agent_turn(client, model_name, user, message, context_type, history=None):
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
    from .tools import TOOL_DEFINITIONS, execute_tool

    history = history or []
    system_prompt = build_agent_prompt(user, context_type, history)

    # Build conversation
    contents = []
    for msg in history:
        contents.append({"role": msg["role"], "parts": [{"text": msg["content"]}]})
    contents.append({"role": "user", "parts": [{"text": message}]})

    max_iterations = 5
    full_response = ""

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

            # Check if the model wants to call tools
            function_calls = []
            text_parts = []

            for part in response.candidates[0].content.parts:
                if hasattr(part, "function_call") and part.function_call:
                    function_calls.append(part.function_call)
                elif hasattr(part, "text") and part.text:
                    text_parts.append(part.text)

            # If no function calls, we have a final text response
            if not function_calls:
                final_text = "".join(text_parts).strip()
                full_response += final_text
                yield ("token", {"text": final_text})
                break

            # Execute tool calls
            tool_results = []
            for fc in function_calls:
                tool_name = fc.name
                tool_params = dict(fc.args) if fc.args else {}

                yield ("tool_call", {"tool": tool_name, "params": tool_params})

                result = execute_tool(tool_name, user, tool_params)
                tool_results.append({
                    "function_response": {
                        "name": tool_name,
                        "response": result.get("result", result),
                    }
                })

                yield ("tool_result", {"tool": tool_name, "result": result.get("result", {})})

            # Add model response and tool results to conversation for next iteration
            contents.append({"role": "model", "parts": response.candidates[0].content.parts})
            contents.append({"role": "user", "parts": tool_results})

        except Exception as e:
            logger.exception("Agent turn failed at iteration %d", iteration)
            yield ("error", {"message": "I encountered an error processing your request. Please try again."})
            return

    yield ("done", {"response": full_response})
