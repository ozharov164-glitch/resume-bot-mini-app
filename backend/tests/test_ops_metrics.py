import os

os.environ.setdefault("DEBUG", "true")

from services.ops_metrics import inc, record_http_status, snapshot  # noqa: E402


def test_snapshot_counters():
    inc("test_counter")
    record_http_status(429)
    data = snapshot()
    assert data["counters"]["test_counter"] >= 1
    assert data["counters"]["http_429_total"] >= 1
