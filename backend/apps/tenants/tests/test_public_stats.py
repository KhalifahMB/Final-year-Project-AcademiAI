"""
Public stats endpoint (GET /api/public/stats).

Unauthenticated aggregates for the landing page, Redis-cached for exactly one
hour. Only coarse platform-wide totals are exposed — never per-tenant rows.
"""
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.learning.models import StudySession
from apps.tenants.models import Tenant
from apps.tenants.stats import PublicStatsView

PASSWORD = "StrongPass!2026"
URL = "/api/public/stats/"


@pytest.fixture(autouse=True)
def _clear_stats_cache():
    cache.delete(PublicStatsView.CACHE_KEY)
    yield
    cache.delete(PublicStatsView.CACHE_KEY)


def _make_tenant(slug, status=Tenant.Status.ACTIVE):
    return Tenant.objects.create(name=f"Univ {slug}", slug=slug, status=status)


def _make_student(email, tenant):
    return User.objects.create_user(
        email=email,
        password=PASSWORD,
        tenant=tenant,
        role=User.Role.STUDENT,
        is_active=True,
        is_email_verified=True,
    )


def _make_session(user, tenant, duration_seconds):
    return StudySession.objects.create(
        user=user,
        tenant=tenant,
        activity_type="reading",
        duration_seconds=duration_seconds,
    )


@pytest.mark.django_db
def test_public_stats_is_reachable_without_auth():
    _make_tenant("a")
    resp = APIClient().get(URL)

    assert resp.status_code == 200
    body = resp.json()
    assert body["institutions_total"] == 1
    assert "students_total" in body
    assert "avg_study_time_minutes" in body
    assert "uptime_seconds" in body
    assert "generated_at" in body
    assert isinstance(body["uptime_seconds"], int)
    assert body["uptime_seconds"] >= 0


@pytest.mark.django_db
def test_counts_only_active_institutions_and_their_students():
    active = _make_tenant("a")
    suspended = _make_tenant("b", status=Tenant.Status.SUSPENDED)
    _make_tenant("c", status=Tenant.Status.PENDING)
    _make_student("s1@univa.edu", active)
    _make_student("s2@univa.edu", active)
    _make_student("s3@univb.edu", suspended)

    resp = APIClient().get(URL)
    assert resp.status_code == 200
    body = resp.json()
    assert body["institutions_total"] == 1
    assert body["students_total"] == 2


@pytest.mark.django_db
def test_average_study_time_uses_completed_sessions_only():
    tenant = _make_tenant("a")
    stu = _make_student("s1@univa.edu", tenant)
    _make_session(stu, tenant, 90)
    _make_session(stu, tenant, 30)
    _make_session(stu, tenant, None)

    resp = APIClient().get(URL)
    assert resp.status_code == 200
    body = resp.json()
    assert body["avg_study_time_minutes"] == 1


@pytest.mark.django_db
def test_zero_metrics_when_empty_platform():
    resp = APIClient().get(URL)
    assert resp.status_code == 200
    body = resp.json()
    assert body["students_total"] == 0
    assert body["institutions_total"] == 0
    assert body["avg_study_time_minutes"] == 0


@pytest.mark.django_db
def test_response_is_cached_for_one_hour():
    _make_tenant("a")
    first = APIClient().get(URL).json()
    _make_tenant("second-does-not-appear")
    second = APIClient().get(URL).json()
    fresh = PublicStatsView()._compute()

    assert second["institutions_total"] == first["institutions_total"]
    assert fresh["institutions_total"] == 2

    cache.delete(PublicStatsView.CACHE_KEY)
    refreshed = APIClient().get(URL).json()
    assert refreshed["institutions_total"] == 2