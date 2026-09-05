import datetime

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.learning.models import Plan, PlanMilestone, PlanTask, PlanTemplate
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


def _template(tenant, **overrides):
    data = {
        "name": "Exam prep",
        "description": "Two-week sprint",
        "plan_type": "study",
        "template_data": {
            "milestones": [
                {
                    "title": "Week 1",
                    "description": "Foundations",
                    "due_in_days": 7,
                    "tasks": [
                        {"title": "Read chapter 1", "estimated_minutes": 45},
                        {"title": "Practice quiz"},
                    ],
                },
                {"title": "Week 2", "tasks": []},
            ]
        },
    }
    data.update(overrides)
    return PlanTemplate.objects.create(tenant=tenant, **data)


VALID_TEMPLATE_DATA = {
    "milestones": [
        {
            "title": "Week 1",
            "tasks": [
                {"title": "Read chapter 1", "estimated_minutes": 45},
            ],
        },
    ],
}


# ---------------------------------------------------------------- instantiate

@pytest.mark.django_db
def test_instantiate_own_tenant_public_template():
    tenant = _tenant("tpl-own")
    user = _user("stu@tpl-own.edu", tenant)
    template = _template(tenant, is_public=True)

    resp = _auth(user).post(
        f"/api/v1/plan-templates/{template.id}/instantiate/",
        {"title": "My exam sprint"},
        format="json",
    )

    assert resp.status_code == 201, resp.data
    plan = Plan.objects.get(title="My exam sprint")
    assert plan.user == user and plan.tenant == tenant
    assert plan.description == "Two-week sprint"
    assert plan.status == "active"
    milestones = list(PlanMilestone.objects.filter(plan=plan).order_by("order"))
    assert [m.title for m in milestones] == ["Week 1", "Week 2"]
    assert all(m.status == "pending" for m in milestones)
    assert milestones[0].due_date == datetime.date.today() + datetime.timedelta(days=7)
    assert milestones[1].due_date is None
    tasks = list(PlanTask.objects.filter(milestone=milestones[0]).order_by("created_at"))
    assert [t.title for t in tasks] == ["Read chapter 1", "Practice quiz"]
    assert tasks[0].estimated_minutes == 45
    assert tasks[1].estimated_minutes is None
    assert all(t.status == "todo" for t in tasks)
    assert len(resp.data["milestones"]) == 2
    assert len(resp.data["milestones"][0]["tasks"]) == 2


@pytest.mark.django_db
def test_instantiate_without_title_uses_template_name():
    tenant = _tenant("tpl-default-title")
    user = _user("stu@tpl-default-title.edu", tenant)
    template = _template(tenant, is_public=True)

    resp = _auth(user).post(
        f"/api/v1/plan-templates/{template.id}/instantiate/", {}, format="json",
    )

    assert resp.status_code == 201, resp.data
    assert Plan.objects.filter(user=user, title="Exam prep").exists()


@pytest.mark.django_db
def test_instantiate_own_private_template():
    tenant = _tenant("tpl-own-priv")
    user = _user("stu@tpl-own-priv.edu", tenant)
    template = _template(tenant, created_by=user, is_public=False)

    resp = _auth(user).post(
        f"/api/v1/plan-templates/{template.id}/instantiate/", {}, format="json",
    )

    assert resp.status_code == 201, resp.data
    assert Plan.objects.filter(user=user).count() == 1


@pytest.mark.django_db
def test_cannot_instantiate_someone_elses_private_template():
    tenant = _tenant("tpl-x-priv")
    owner = _user("own@tpl-x-priv.edu", tenant)
    other = _user("other@tpl-x-priv.edu", tenant)
    template = _template(tenant, created_by=owner, is_public=False)

    resp = _auth(other).post(
        f"/api/v1/plan-templates/{template.id}/instantiate/", {}, format="json",
    )

    assert resp.status_code == 404
    assert Plan.objects.filter(user=other).count() == 0


@pytest.mark.django_db
def test_cannot_instantiate_foreign_tenant_template():
    tenant = _tenant("tpl-home")
    other = _tenant("tpl-away")
    user = _user("stu@tpl-home.edu", tenant)
    template = _template(other, is_public=True)

    resp = _auth(user).post(
        f"/api/v1/plan-templates/{template.id}/instantiate/", {}, format="json",
    )

    assert resp.status_code == 404
    assert Plan.objects.filter(user=user).count() == 0


@pytest.mark.django_db
def test_instantiate_malformed_template_is_rejected_without_side_effects():
    tenant = _tenant("tpl-bad")
    user = _user("stu@tpl-bad.edu", tenant)
    template = _template(tenant, template_data={"milestones": [{"tasks": "nope"}]})

    resp = _auth(user).post(
        f"/api/v1/plan-templates/{template.id}/instantiate/", {}, format="json",
    )

    assert resp.status_code == 400, resp.data
    assert "title" in resp.data["error"]["detail"]
    assert Plan.objects.filter(user=user).count() == 0
    assert PlanMilestone.objects.filter(plan__user=user).count() == 0


# ---------------------------------------------------------------- CRUD

@pytest.mark.django_db
def test_student_can_create_private_template():
    tenant = _tenant("tpl-student-create")
    student = _user("stu@tpl-student-create.edu", tenant)

    resp = _auth(student).post(
        "/api/v1/plan-templates/",
        {
            "name": "My personal sprint",
            "description": "Just for me",
            "plan_type": "study",
            "is_public": False,
            "template_data": VALID_TEMPLATE_DATA,
        },
        format="json",
    )

    assert resp.status_code == 201, resp.data
    template = PlanTemplate.objects.get(name="My personal sprint")
    assert template.tenant == tenant
    assert template.created_by == student
    assert template.is_public is False
    assert template.template_data == {
        "milestones": [
            {"title": "Week 1", "description": "", "due_in_days": None, "tasks": [
                {"title": "Read chapter 1", "description": "", "estimated_minutes": 45},
            ]},
        ]
    }
    # Serializer round-trips visibility + creator display name.
    assert resp.data["is_public"] is False
    assert resp.data["created_by"] == str(student.id)


@pytest.mark.django_db
def test_public_template_visible_to_all_same_tenant():
    tenant = _tenant("tpl-public")
    admin = _user("adm@tpl-public.edu", tenant, role="tenant_admin")
    student = _user("stu@tpl-public.edu", tenant)
    template = _template(tenant, created_by=admin, is_public=True)

    for user in (admin, student):
        list_resp = _auth(user).get("/api/v1/plan-templates/")
        assert list_resp.status_code == 200
        items = list_resp.data.get("results", list_resp.data)
        assert any(t["id"] == str(template.id) for t in items)
        assert all(
            t["is_public"] or t["created_by"] == str(user.id)
            for t in items
        )


@pytest.mark.django_db
def test_private_template_hidden_from_peers_but_visible_to_owner():
    tenant = _tenant("tpl-priv-hide")
    owner = _user("own@tpl-priv-hide.edu", tenant)
    peer = _user("peer@tpl-priv-hide.edu", tenant)
    template = _template(tenant, created_by=owner, is_public=False)

    owner_items = _auth(owner).get("/api/v1/plan-templates/").data
    items = owner_items if isinstance(owner_items, list) else owner_items.get("results", [])
    assert any(t["id"] == str(template.id) for t in items)

    peer_resp = _auth(peer).get("/api/v1/plan-templates/").data
    peer_items = peer_resp if isinstance(peer_resp, list) else peer_resp.get("results", [])
    assert not any(t["id"] == str(template.id) for t in peer_items)
    # Direct detail access is also blocked (404, not 200 with leaked data).
    assert _auth(peer).get(f"/api/v1/plan-templates/{template.id}/").status_code == 404


@pytest.mark.django_db
def test_owner_can_edit_and_delete_private_template():
    tenant = _tenant("tpl-own-edit")
    owner = _user("own@tpl-own-edit.edu", tenant)
    template = _template(tenant, created_by=owner, is_public=False)

    upd = _auth(owner).patch(
        f"/api/v1/plan-templates/{template.id}/",
        {"name": "Renamed", "template_data": {"milestones": [{"title": "Only week"}]}},
        format="json",
    )
    assert upd.status_code == 200, upd.data
    assert upd.data["created_by"] == str(owner.id)  # creator preserved on edit
    template.refresh_from_db()
    assert template.name == "Renamed"
    assert template.template_data["milestones"] == [
        {"title": "Only week", "description": "", "due_in_days": None, "tasks": []}
    ]

    resp = _auth(owner).delete(f"/api/v1/plan-templates/{template.id}/")
    assert resp.status_code == 204
    assert PlanTemplate.objects.filter(id=template.id).count() == 0


@pytest.mark.django_db
def test_peer_cannot_edit_or_delete_private_template():
    tenant = _tenant("tpl-peer-no")
    owner = _user("own@tpl-peer-no.edu", tenant)
    peer = _user("peer@tpl-peer-no.edu", tenant)
    template = _template(tenant, created_by=owner, is_public=False)

    upd = _auth(peer).patch(f"/api/v1/plan-templates/{template.id}/", {"name": "Hijack"}, format="json")
    assert upd.status_code == 403
    assert template.name == "Exam prep"

    assert _auth(peer).delete(f"/api/v1/plan-templates/{template.id}/").status_code == 403
    assert PlanTemplate.objects.filter(id=template.id).count() == 1


@pytest.mark.django_db
def test_student_cannot_edit_admins_public_template_but_admin_can():
    tenant = _tenant("tpl-admin-pub")
    admin = _user("adm@tpl-admin-pub.edu", tenant, role="tenant_admin")
    student = _user("stu@tpl-admin-pub.edu", tenant)
    template = _template(tenant, created_by=admin, is_public=True)

    upd = _auth(student).patch(f"/api/v1/plan-templates/{template.id}/", {"name": "Nope"}, format="json")
    assert upd.status_code == 403

    upd2 = _auth(admin).patch(f"/api/v1/plan-templates/{template.id}/", {"name": "Institutional"}, format="json")
    assert upd2.status_code == 200, upd2.data
    template.refresh_from_db()
    assert template.name == "Institutional"


@pytest.mark.django_db
def test_admin_cannot_touch_students_private_template():
    tenant = _tenant("tpl-admin-no-priv")
    admin = _user("adm@tpl-admin-no-priv.edu", tenant, role="tenant_admin")
    student = _user("stu@tpl-admin-no-priv.edu", tenant)
    template = _template(tenant, created_by=student, is_public=False)

    assert _auth(admin).get(f"/api/v1/plan-templates/{template.id}/").status_code == 404
    assert _auth(admin).patch(f"/api/v1/plan-templates/{template.id}/", {"name": "Snoop"}, format="json").status_code == 404
    assert _auth(admin).delete(f"/api/v1/plan-templates/{template.id}/").status_code == 404


@pytest.mark.django_db
def test_admin_cannot_touch_other_tenants_template():
    tenant = _tenant("tpl-admin-own")
    other = _tenant("tpl-admin-away")
    admin = _user("adm@tpl-admin-own.edu", tenant, role="tenant_admin")
    template = _template(other, is_public=True)

    assert _auth(admin).patch(f"/api/v1/plan-templates/{template.id}/", {"name": "Hijack"}, format="json").status_code == 404
    assert _auth(admin).delete(f"/api/v1/plan-templates/{template.id}/").status_code == 404


@pytest.mark.django_db
def test_malformed_template_data_is_rejected_on_create_and_update():
    tenant = _tenant("tpl-admin-bad")
    student = _user("stu@tpl-admin-bad.edu", tenant)
    bad_data = {"milestones": [{"title": "", "tasks": []}]}

    create_resp = _auth(student).post(
        "/api/v1/plan-templates/",
        {"name": "Bad", "plan_type": "study", "template_data": bad_data},
        format="json",
    )
    assert create_resp.status_code == 400, create_resp.data
    assert PlanTemplate.objects.filter(name="Bad").count() == 0

    template = _template(tenant, created_by=student)
    upd = _auth(student).patch(
        f"/api/v1/plan-templates/{template.id}/",
        {"template_data": bad_data},
        format="json",
    )
    assert upd.status_code == 400, upd.data
    template.refresh_from_db()
    assert template.name == "Exam prep"