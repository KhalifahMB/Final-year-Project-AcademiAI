"""Unit tests for RAG evaluation metrics."""
from apps.common.management.commands.evaluate_rag import (
    _precision_at_k,
    _recall_at_k,
    _reciprocal_rank,
)


def test_precision_at_k_counts_hits():
    ranked = ["a", "b", "c", "d", "e"]
    relevant = ["b", "d"]
    assert _precision_at_k(ranked, relevant, 5) == 2 / 5


def test_recall_at_k_covers_all_relevant():
    ranked = ["a", "b", "c", "d", "e"]
    assert _recall_at_k(ranked, ["a", "e"], 3) == 0.5
    assert _recall_at_k(ranked, ["a", "e"], 5) == 1.0


def test_reciprocal_rank_first_position():
    assert _reciprocal_rank(["x", "y"], ["x"]) == 1.0
    assert _reciprocal_rank(["x", "y", "z"], ["z"]) == 1 / 3
    assert _reciprocal_rank(["x"], ["q"]) == 0.0


def test_empty_inputs_are_zero():
    assert _precision_at_k([], ["a"], 5) == 0.0
    assert _recall_at_k(["a"], [], 1) == 0.0
