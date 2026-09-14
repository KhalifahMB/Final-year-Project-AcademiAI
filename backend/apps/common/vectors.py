"""Small vector helpers shared by embedding-based features."""


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two equal-length vectors; 0.0 when undefined."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    normsq_a = sum(x * x for x in a)
    normsq_b = sum(x * x for x in b)
    if normsq_a <= 0 or normsq_b <= 0:
        return 0.0
    return dot / ((normsq_a * normsq_b) ** 0.5)