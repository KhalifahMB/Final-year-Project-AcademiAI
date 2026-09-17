"""
AI provider abstraction (Gemini).
Centralizes prompts, retries, structured output validation, prompt-injection defenses.
"""
from .gemini import (
    generate_grounded_answer,
    generate_embeddings,
    generate_quiz_json,
    generate_summary,
    generate_topics,
    extract_concepts,
)

__all__ = [
    "generate_grounded_answer",
    "generate_embeddings",
    "generate_quiz_json",
    "generate_summary",
    "generate_topics",
    "extract_concepts",
]
