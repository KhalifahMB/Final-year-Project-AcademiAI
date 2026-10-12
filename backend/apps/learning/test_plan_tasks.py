import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.learning.models import Plan, PlanMilestone, PlanTask
from apps.tenants.models import Tenant


PASSWORD = "StrongPass!2026"


@pytest.mark.django_db
def test_user_can_create_task_on_own_milestone_only():
    tenant = Tenant.objects.create(name="Learning Uni", slug="learning-uni-tasks")
    other_tenant = Tenant.objects.create(name="Other Uni", slug="other-uni-tasks")
    user = User.objects.create_user(
        email="student@learning-uni.edu", password=PASSWORD,
        tenant=tenant, role="student", is_email_verified=True,
    )
    other_user = User.objects.create_user(
        email="other@learning-uni.edu", password=PASSWORD,
        tenant=tenant, role="student", is_email_verified=True,
    )
    own_plan = Plan.objects.create(tenant=tenant, user=user, title="My plan")
    own_milestone = PlanMilestone.objects.create(plan=own_plan, tenant=tenant, title="Chapter one")
    other_milestone = PlanMilestone.objects.create(
        plan=Plan.objects.create(tenant=tenant, user=other_user, title="Other plan"),
        tenant=tenant, title="Chapter one",
    )
    foreign_milestone = PlanMilestone.objects.create(
        plan=Plan.objects.create(tenant=other_tenant, user=other_user, title="Foreign plan"),
        tenant=other_tenant, title="Chapter one",
    )
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.post(
        "/api/v1/plan-tasks/",
        {"milestone": str(own_milestone.id), "title": "Summarize chapter one"},
        format="json",
    )

    assert response.status_code == 201, response.data
    assert response.data["milestone"] == own_milestone.id
    assert response.data["milestone_title"] == "Chapter one"
    assert PlanTask.objects.filter(milestone=own_milestone, title="Summarize chapter one").exists()

    for milestone in (other_milestone, foreign_milestone):
        response = client.post(
            "/api/v1/plan-tasks/",
            {"milestone": str(milestone.id), "title": "Unauthorized task"},
            format="json",
        )
        assert response.status_code == 400, response.data
    assert not PlanTask.objects.filter(title="Unauthorized task").exists()