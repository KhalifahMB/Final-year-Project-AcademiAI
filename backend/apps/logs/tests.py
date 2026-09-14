"""
Tests for the tenant log analyzer (admin-only aggregate endpoint).
"""
import datetime

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.logs.models import TenantLog
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026"


def _tenant(slug):
    return Tenant.objects.create(name=f"Uni {slug}", slug=slug)


def _user(email, tenant, role="student"):
    return User.objects.create_user(
        email=email,
        password=PASSWORD,
        tenant=tenant,
        role=role,
        is_active=True,
        is_email_verified=True,
    )


def _auth(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _log(tenant, **overrides):
    data = {
        "level": "info",
        "category": "api",
        "action": "resource.list",
        "response_time_ms": 120,
    }
    data.update(overrides)
    return TenantLog.objects.create(tenant_id=tenant.id, **data)


@pytest.mark.django_db
def test_analyze_requires_tenant_admin():
    tenant = _tenant("log-admin")
    student = _user("stu@log-admin.edu", tenant)
    admin = _user("adm@log-admin.edu", tenant, role="tenant_admin")

    _log(tenant)

    resp_student = _auth(student).get("/api/v1/logs/analyze/")
    assert resp_student.status_code == 403

    resp_admin = _auth(admin).get("/api/v1/logs/analyze/")
    assert resp_admin.status_code == 200
    # At least the seed row is present; middleware may add request rows
    # (e.g. the student's forbidden request) around it.
    assert resp_admin.data["total"] >= 1


@pytest.mark.django_db
def test_analyze_aggregates_counts_and_errors():
    tenant = _tenant("log-agg")
    admin = _user("adm@log-agg.edu", tenant, role="tenant_admin")
    other = _tenant("log-other")

    _log(tenant, level="info", action="resource.list", category="api")
    _log(tenant, level="error", action="agent.generate", category="agent",
         response_time_ms=900)
    _log(tenant, level="warning", action="auth.login", category="auth",
         actor_id=admin.id)
    _log(tenant, level="info", action="resource.list", category="api",
         response_time_ms=100)
    # Isolated to another tenant — must NOT leak into this one's analytics.
    _log(other, level="error")

    resp = _auth(admin).get("/api/v1/logs/analyze/")
    assert resp.status_code == 200
    data = resp.data

    assert data["total"] == 4
    assert data["error_count"] == 1
    assert data["error_rate"] == 25.0
    assert data["active_actors"] == 1

    cat = {c["name"]: c["value"] for c in data["by_category"]}
    assert cat["api"] == 2
    assert cat["agent"] == 1
    assert cat["auth"] == 1

    actions = {a["name"]: a["value"] for a in data["top_actions"]}
    assert actions["resource.list"] == 2

    # Response time stats over [100, 120, 900]
    assert data["avg_response_time_ms"] is not None
    assert data["avg_response_time_ms"] > 100

    # Recent errors surfaces the error row (plus the warning), tenant-isolated.
    actions_in_errors = {r["action"] for r in data["recent_errors"]}
    assert "agent.generate" in actions_in_errors
    assert "auth.login" in actions_in_errors
    assert len(data["recent_errors"]) == 2


@pytest.mark.django_db
def test_analyze_empty_returns_zeros():
    tenant = _tenant("log-empty")
    admin = _user("adm@log-empty.edu", tenant, role="tenant_admin")

    resp = _auth(admin).get("/api/v1/logs/analyze/")
    assert resp.status_code == 200
    assert resp.data["total"] == 0
    assert resp.data["by_category"] == []
    assert resp.data["error_count"] == 0
