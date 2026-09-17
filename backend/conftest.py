"""
Pytest fixtures — cache isolation between tests.

DRF throttles (ScopedRateThrottle) persist counters in the shared Redis
cache. Without clearing it between tests, a request made in one test can
satisfy (or exhaust) a throttle in another that shares the client identity
e.g. the ``testclient`` IP or an authenticated user pk. Clearing the cache
before every test keeps throttling tests hermetic while still exercising the
real throttle path.
"""
import pytest


@pytest.fixture(autouse=True)
def _clear_cache_before_test():
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()