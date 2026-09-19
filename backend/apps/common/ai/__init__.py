"""
AI provider abstraction (Gemini).
Centralizes prompts, retries, structured output validation, prompt-injection defenses.
"""
from .gemini import (
    AIServiceUnavailableError,
    ai_service_available,
    generate_grounded_answer,
    generate_embeddings,
    generate_quiz_json,
    generate_summary,
    generate_topics,
    extract_concepts,
)

__all__ = [
    "AIServiceUnavailableError",
    "ai_service_available",
    "generate_grounded_answer",
    "generate_embeddings",
    "generate_quiz_json",
    "generate_summary",
    "generate_topics",
    "extract_concepts",
]
