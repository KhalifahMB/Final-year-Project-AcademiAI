"""Unit tests for RAG evaluation metrics."""
from pathlib import Path

from apps.common.management.commands.evaluate_rag import (
    Command,
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


def test_resolve_queries_path_finds_file_in_cwd(tmp_path, monkeypatch):
    target = tmp_path / "testset.json"
    target.write_text("[]", encoding="utf-8")
    monkeypatch.setattr(Path, "cwd", lambda: tmp_path)
    resolved, searched = Command._resolve_queries_path("testset.json")
    assert resolved == target
    assert target in searched


def test_resolve_queries_path_accepts_bom_encoded_fixture(tmp_path, monkeypatch):
    target = tmp_path / "rag_queries.json"
    target.write_bytes(b"\xef\xbb\xbf[]")
    monkeypatch.setattr(Path, "cwd", lambda: tmp_path)
    resolved, _ = Command._resolve_queries_path("rag_queries.json")
    with open(resolved, encoding="utf-8-sig") as fh:
        assert fh.read() == "[]"


def test_resolve_queries_path_reports_missing(monkeypatch):
    monkeypatch.setattr(Path, "cwd", lambda: Path("nonexistent-dir-xyz"))
    _, searched = Command._resolve_queries_path("missing.json")
    assert all(not p.is_file() for p in searched)
