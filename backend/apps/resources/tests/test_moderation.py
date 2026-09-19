"""Report-and-takedown moderation + tenant quota + concept extraction.

Covers the three features the report claims but were missing:
  - TC-28 quota: upload rejected with 413 when the tenant quota is reached
  - TC-29 moderation: a reported resource is flagged, hidden from retrieval
    and student listings; a lecturer/admin can dismiss or remove it; audit
    records both events
  - concept extraction: ingesting a document creates Concept / ResourceConcept
    / ConceptEdge rows that feed concept-aware retrieval
"""
import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.common.ai.gemini import extract_concepts
from apps.knowledge.models import Concept, ConceptEdge, ResourceConcept
from apps.resources.models import Resource, ResourceReport, ResourceVersion
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026x"


def _make_tenant(slug="univ-m", quota=10 * 1024 * 1024 * 1024):
    return Tenant.objects.create(name=f"Univ {slug}", slug=slug, storage_quota_bytes=quota)


def _make_user(tenant, email, role=User.Role.STUDENT):
    return User.objects.create_user(
        email=email, password=PASSWORD, role=role, tenant=tenant,
        is_active=True, is_email_verified=True,
    )


def _make_resource(tenant, owner, scope=Resource.Visibility.INSTITUTION, **kw):
    defaults = dict(
        tenant=tenant,
        title="Doc",
        visibility_scope=scope,
        mime_type="application/pdf",
        processing_status=Resource.ProcessingStatus.READY,
        has_extractable_text=True,
    )
    defaults.update(kw)
    return Resource.objects.create(**defaults)


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


# ---------------------------------------------------------------------------
# Feature A: per-tenant quota enforcement
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_upload_rejected_when_tenant_quota_exceeded():
    tenant = _make_tenant(quota=1000)
    admin = _make_user(tenant, "admin@m.edu", role=User.Role.TENANT_ADMIN)
    r = _make_resource(tenant, admin)
    # A version that consumes the entire 1000-byte quota.
    ResourceVersion.objects.create(
        tenant=tenant, resource=r, version_number=1,
        storage_key="tenants/{}/resources/{}/v1".format(tenant.id, r.id),
        file_size_bytes=1000,
    )

    resp = _client(admin).post(
        f"/api/v1/resources/{r.id}/request_upload_url/",
        {"content_type": "application/pdf"},
        format="json",
    )
    assert resp.status_code == 413, resp.data
    assert "quota" in resp.data["error"]["detail"].lower()


@pytest.mark.django_db
def test_register_completed_upload_enforces_real_size():
    tenant = _make_tenant(quota=1500)
    admin = _make_user(tenant, "admin@m.edu", role=User.Role.TENANT_ADMIN)
    r = _make_resource(tenant, admin)
    ResourceVersion.objects.create(
        tenant=tenant, resource=r, version_number=1,
        storage_key="tenants/{}/resources/{}/v1".format(tenant.id, r.id),
        file_size_bytes=1500,
    )
    key = "tenants/{}/resources/{}/new".format(tenant.id, r.id)

    # Storage head is mocked to report a size that would break the quota.
    import apps.resources.services.upload_service as svc

    original = svc.head_object
    svc.head_object = lambda k: {"content_length": 50, "content_type": "application/pdf"}
    try:
        resp = _client(admin).post(
            f"/api/v1/resources/{r.id}/complete_upload/",
            {"storage_key": key, "content_type": "application/pdf"},
            format="json",
        )
    finally:
        svc.head_object = original
    assert resp.status_code == 413, resp.data


@pytest.mark.django_db
def test_upload_within_quota_succeeds():
    tenant = _make_tenant(quota=10 * 1024 * 1024)
    admin = _make_user(tenant, "admin@m.edu", role=User.Role.TENANT_ADMIN)
    r = _make_resource(tenant, admin)
    key = "tenants/{}/resources/{}/ok".format(tenant.id, r.id)

    import apps.resources.services.upload_service as svc

    svc.head_object = lambda k: {"content_length": 100, "content_type": "application/pdf"}
    resp = _client(admin).post(
        f"/api/v1/resources/{r.id}/complete_upload/",
        {"storage_key": key, "content_type": "application/pdf"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["version_id"]
    v = ResourceVersion.objects.get(id=resp.data["version_id"])
    assert v.file_size_bytes == 100


# ---------------------------------------------------------------------------
# Feature B: report-and-takedown moderation
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_report_flags_resource_and_audits():
    tenant = _make_tenant()
    owner = _make_user(tenant, "owner@m.edu")
    reporter = _make_user(tenant, "rep@m.edu")
    r = _make_resource(tenant, owner)

    resp = _client(reporter).post(
        f"/api/v1/resources/{r.id}/report/",
        {"reason": "offensive", "details": "Teaches dangerous content"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["reason"] == "offensive"

    r.refresh_from_db()
    assert r.moderation_status == Resource.ModerationStatus.FLAGGED
    report = ResourceReport.objects.get(resource=r)
    assert report.status == ResourceReport.Status.PENDING
    assert AuditLog.objects.filter(action="resource.report").exists()


@pytest.mark.django_db
def test_flagged_hidden_from_student_listings_and_retrieval():
    tenant = _make_tenant()
    owner = _make_user(tenant, "owner@m.edu")
    student = _make_user(tenant, "stu@m.edu")
    r = _make_resource(tenant, owner)
    r.moderation_status = Resource.ModerationStatus.FLAGGED
    r.save(update_fields=["moderation_status", "updated_at"])

    # Student list: hidden
    ids = {x["id"] for x in _client(student).get("/api/v1/resources/").data["results"]}
    assert str(r.id) not in ids

    # Direct GET: 404 for student
    assert _client(student).get(f"/api/v1/resources/{r.id}/").status_code == 404

    # Retrieval excluded
    from apps.knowledge.retrieval import _authorized_resource_ids

    assert r.id not in _authorized_resource_ids(student)

    # Admin sees flagged (needs to review)
    admin = _make_user(tenant, "admin@m.edu", role=User.Role.TENANT_ADMIN)
    ids = {x["id"] for x in _client(admin).get("/api/v1/resources/").data["results"]}
    assert str(r.id) in ids


@pytest.mark.django_db
def test_moderator_dismiss_restores_resource():
    tenant = _make_tenant()
    owner = _make_user(tenant, "owner@m.edu")
    student = _make_user(tenant, "stu@m.edu")
    lecturer = _make_user(tenant, "lec@m.edu", role=User.Role.LECTURER)
    r = _make_resource(tenant, owner)
    r.moderation_status = Resource.ModerationStatus.FLAGGED
    r.save(update_fields=["moderation_status", "updated_at"])
    ResourceReport.objects.create(
        tenant=tenant, resource=r, reported_by=student,
        reason=ResourceReport.Reason.INACCURATE,
        status=ResourceReport.Status.PENDING,
    )

    resp = _client(lecturer).post(
        f"/api/v1/resources/{r.id}/moderate/",
        {"decision": "dismiss"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    r.refresh_from_db()
    assert r.moderation_status == Resource.ModerationStatus.ACTIVE
    assert ResourceReport.objects.get(resource=r).status == ResourceReport.Status.DISMISSED
    assert AuditLog.objects.filter(action="resource.moderation.dismiss").exists()


@pytest.mark.django_db
def test_moderator_remove_hides_from_everyone():
    tenant = _make_tenant()
    owner = _make_user(tenant, "owner@m.edu")
    student = _make_user(tenant, "stu@m.edu")
    admin = _make_user(tenant, "admin@m.edu", role=User.Role.TENANT_ADMIN)
    r = _make_resource(tenant, owner)
    r.moderation_status = Resource.ModerationStatus.FLAGGED
    r.save(update_fields=["moderation_status", "updated_at"])
    ResourceReport.objects.create(
        tenant=tenant, resource=r, reported_by=student,
        reason=ResourceReport.Reason.COPYRIGHT,
        status=ResourceReport.Status.PENDING,
    )

    resp = _client(admin).post(
        f"/api/v1/resources/{r.id}/moderate/",
        {"decision": "remove"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    r.refresh_from_db()
    assert r.moderation_status == Resource.ModerationStatus.REMOVED
    assert AuditLog.objects.filter(action="resource.moderation.remove").exists()

    ids = {x["id"] for x in _client(admin).get("/api/v1/resources/").data["results"]}
    assert str(r.id) not in ids  # removed even for admins


@pytest.mark.django_db
def test_student_cannot_moderate():
    tenant = _make_tenant()
    owner = _make_user(tenant, "owner@m.edu")
    student = _make_user(tenant, "stu@m.edu")
    r = _make_resource(tenant, owner)
    r.moderation_status = Resource.ModerationStatus.FLAGGED
    r.save(update_fields=["moderation_status", "updated_at"])
    ResourceReport.objects.create(
        tenant=tenant, resource=r, reported_by=owner,
        reason=ResourceReport.Reason.OTHER, status=ResourceReport.Status.PENDING,
    )

    resp = _client(student).post(
        f"/api/v1/resources/{r.id}/moderate/",
        {"decision": "remove"},
        format="json",
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Feature C: concept extraction during ingestion
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_extract_concepts_fallback_deterministic(monkeypatch):
    monkeypatch.setattr("apps.common.ai.gemini._get_client", lambda: None)
    payload = extract_concepts(
        "Big-O notation describes algorithm growth. Algorithms and data "
        "structures use Big-O. Sorting algorithms like Quicksort have "
        "logarithmic growth, while time complexity is measured using Big-O."
    )
    names = [c["name"] for c in payload["concepts"]]
    assert len(payload["concepts"]) > 0
    assert any("Big-O" in n or "Big O" in n or "big-o" in n.lower() for n in names)


@pytest.mark.django_db
def test_ingestion_persists_concepts_and_edges():
    from apps.common.ai import extract_concepts as patched
    import apps.resources.tasks as tasks

    tenant = _make_tenant()
    owner = _make_user(tenant, "owner@m.edu", role=User.Role.TENANT_ADMIN)
    r = _make_resource(tenant, owner)
    version = ResourceVersion.objects.create(
        tenant=tenant, resource=r, version_number=1,
        storage_key="tenants/{}/resources/{}/v1".format(tenant.id, r.id),
        file_size_bytes=10,
    )

    payload = {
        "concepts": [
            {"name": "Big-O notation", "description": "growth of algorithms"},
            {"name": "Sorting algorithms", "description": ""},
            {"name": "Time complexity", "description": ""},
        ],
        "relations": [
            {"source": "Big-O notation", "target": "Time complexity", "relation": "related_to"},
        ],
    }
    tasks._persist_concepts_and_edges(r, version, payload, tenant.id)

    assert Concept.objects.filter(tenant=tenant).count() == 3
    assert ResourceConcept.objects.filter(resource=r).count() == 3
    assert ConceptEdge.objects.filter(tenant=tenant).count() == 1

    edge = ConceptEdge.objects.first()
    assert edge.relation_type == "related_to"
    assert edge.source_concept.canonical_name == "Big-O notation"
    assert edge.target_concept.canonical_name == "Time complexity"


@pytest.mark.django_db
def test_concept_graph_one_hop_expands_retrieval():
    from apps.knowledge.retrieval import _concept_related_chunk_ids
    from apps.resources.models import ResourceChunk

    tenant = _make_tenant()
    owner = _make_user(tenant, "owner@m.edu")
    r = _make_resource(tenant, owner)
    version = ResourceVersion.objects.create(
        tenant=tenant, resource=r, version_number=1,
        storage_key="tenants/{}/resources/{}/v1".format(tenant.id, r.id),
        file_size_bytes=10,
    )
    c0 = ResourceChunk.objects.create(
        tenant=tenant, resource_version=version, chunk_index=0,
        content="Big-O notation growth analysis.", embedding=None,
    )
    c1 = ResourceChunk.objects.create(
        tenant=tenant, resource_version=version, chunk_index=1,
        content="Time complexity of sorting algorithms.", embedding=None,
    )
    a, b = Concept.objects.create(tenant=tenant, canonical_name="Big-O notation"), \
        Concept.objects.create(tenant=tenant, canonical_name="Time complexity")
    ConceptEdge.objects.create(
        tenant=tenant, source_concept=a, target_concept=b, relation_type="related_to"
    )
    ResourceConcept.objects.create(resource=r, concept=a, source_chunk=c0)
    ResourceConcept.objects.create(resource=r, concept=b, source_chunk=c1)

    hits = _concept_related_chunk_ids(tenant.id, "Big-O", {r.id})
    assert str(c1.id) in {str(h) for h in hits}  # neighbor concept chunk surfaces