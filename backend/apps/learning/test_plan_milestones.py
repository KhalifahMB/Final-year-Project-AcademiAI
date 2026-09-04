import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.learning.models import Plan, PlanMilestone
from apps.tenants.models import Tenant


PASSWORD = "StrongPass!2026"


@pytest.mark.django_db
def test_user_can_create_milestone_on_own_plan_only():
    tenant = Tenant.objects.create(name="Learning Uni", slug="learning-uni")
    other_tenant = Tenant.objects.create(name="Other Uni", slug="other-uni")
    user = User.objects.create_user(
        email="student@learning-uni.edu", password=PASSWORD,
        tenant=tenant, role="student", is_email_verified=True,
    )
    other_user = User.objects.create_user(
        email="other@learning-uni.edu", password=PASSWORD,
        tenant=tenant, role="student", is_email_verified=True,
    )
    own_plan = Plan.objects.create(tenant=tenant, user=user, title="My plan")
    other_plan = Plan.objects.create(tenant=tenant, user=other_user, title="Other plan")
    foreign_plan = Plan.objects.create(tenant=other_tenant, user=other_user, title="Foreign plan")
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.post(
        "/api/v1/plan-milestones/",
        {"plan": str(own_plan.id), "title": "Read chapter one"},
        format="json",
    )

    assert response.status_code == 201, response.data
    assert PlanMilestone.objects.filter(plan=own_plan, title="Read chapter one").exists()

    for plan in (other_plan, foreign_plan):
        response = client.post(
            "/api/v1/plan-milestones/",
            {"plan": str(plan.id), "title": "Unauthorized milestone"},
            format="json",
        )
        assert response.status_code == 400, response.data
    assert not PlanMilestone.objects.filter(title="Unauthorized milestone").exists()
