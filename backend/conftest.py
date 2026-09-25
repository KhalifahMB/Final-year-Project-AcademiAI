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


def pytest_configure(config):
    """Run the test databases as the BYPASSRLS role, not the runtime role.

    The runtime role `academiai` is NOBYPASSRLS by design, and ~280 direct
    Model.objects.create() calls in 31 test files still write tenant-scoped rows
    outside tenant_scope(). They pass only because this connection skips RLS.
    apps/common/tests/test_rls.py opts out with SET ROLE academiai, and
    test_suite_connection_bypasses_rls is the tripwire that fails when the
    conversion plan lands and this shim should be deleted.

    Run the suite as the runtime role instead with POSTGRES_TEST_USER=academiai
    (PowerShell: $env:POSTGRES_TEST_USER="academiai"). An empty value also works,
    but only from a POSIX shell — PowerShell deletes the variable on "".
    """
    import os

    from django.conf import settings
    from django.db import connections

    user = os.environ.get("POSTGRES_TEST_USER", "academiai_test")
    if not user:
        return
    settings.DATABASES["default"].update(
        USER=user, PASSWORD=os.environ.get("POSTGRES_TEST_PASSWORD", user)
    )
    # `connections` snapshots DATABASES into a copy on first access; drop the
    # snapshot so the next read picks the update up. Verified on Django 6.1:
    # BaseConnectionHandler.settings is a cached_property that re-derives from
    # django_settings.DATABASES when the cache is gone.
    try:
        del connections.settings
    except AttributeError:
        pass