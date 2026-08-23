"""Authorization-first retrieval guards (unit-level)."""
from apps.knowledge.retrieval import _rrf_fuse


def test_rrf_prefers_items_in_multiple_lists():
    a = ["c1", "c2", "c3"]
    b = ["c2", "c4"]
    fused = _rrf_fuse([a, b], k=60)
    ids = [x[0] for x in fused]
    assert ids[0] == "c2"


def test_rrf_empty():
    assert _rrf_fuse([]) == []
