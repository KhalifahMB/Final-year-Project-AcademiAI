"""Shared answer-correctness helpers.

Mirrors the review semantics in one place so attempt scoring, quiz reviews,
analytics, and quality scoring never drift apart:

- A submitted answer is correct when it equals the whole ``correct_answer``
  dict, equals ``correct_answer["index"]``, or case-insensitively equals
  ``correct_answer["value"]`` (string normalization is lower/stripped).
"""


def normalize_answer(value):
    if isinstance(value, str):
        return value.strip().lower()
    return value


def is_answer_correct(correct_answer: dict, submitted) -> bool:
    """True when ``submitted`` matches ``correct_answer`` (see module doc)."""
    if submitted is None:
        return False
    ca = correct_answer or {}
    return bool(
        submitted == ca
        or normalize_answer(submitted) == normalize_answer(ca.get("index"))
        or normalize_answer(submitted) == normalize_answer(ca.get("value"))
    )