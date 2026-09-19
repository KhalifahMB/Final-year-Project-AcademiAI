"""
TC-13: retrieved_chunk_ids exposed on ChatMessage.

Citations are normalized into ChatMessageSource rows during a turn
(append_assistant_message). The serializer exposes `retrieved_chunk_ids`
derived from those rows so the report's "which chunks grounded this answer"
is server-authoritative and cannot drift from the actual citations.
"""
import pytest
from unittest.mock import patch

from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.chat.models import ChatSession, ChatMessage, ChatMessageSource
from apps.chat.serializers import ChatMessageSerializer
from apps.resources.models import Resource, ResourceVersion, ResourceChunk
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026"


def _tenant(slug="chat-tc13"):
    return Tenant.objects.create(name=f"Univ {slug}", slug=slug)


def _user(t, email, role="student"):
    return User.objects.create_user(
        email=email, password=PASSWORD, role=role, tenant=t,
        is_active=True, is_email_verified=True,
    )


def _chunk(tenant, res, content="Water cycle: evaporation, condensation.", index=0):
    version = ResourceVersion.objects.create(
        tenant=tenant, resource=res, version_number=1,
        storage_key="k", created_by=res.uploaded_by,
    )
    return ResourceChunk.objects.create(
        tenant=tenant, resource_version=version, chunk_index=index, content=content,
    )


@pytest.mark.django_db
def test_serializer_exposes_retrieved_chunk_ids_from_sources():
    tenant = _tenant()
    student = _user(tenant, "s@tc13.edu")
    res = Resource.objects.create(
        tenant=tenant, title="Geo notes", uploaded_by=student,
        visibility_scope="institution", processing_status="ready",
    )
    chunk = _chunk(tenant, res)

    session = ChatSession.objects.create(tenant=tenant, user=student, title="t")
    msg = ChatMessage.objects.create(
        tenant=tenant, session=session, role=ChatMessage.Role.ASSISTANT,
        content="Water cycles continuously.",
    )
    ChatMessageSource.objects.create(
        tenant=tenant, message=msg, chunk=chunk, rank=1, retrieval_method="hybrid",
    )

    data = ChatMessageSerializer(msg).data
    assert data["retrieved_chunk_ids"] == [str(chunk.id)]
    assert len(data["sources"]) == 1


@pytest.mark.django_db
def test_end_to_end_turn_persists_citations_and_retrieved_chunk_ids():
    """Post a message with a real chunk present; the turn must persist
    ChatMessageSource rows and the API response must carry retrieved_chunk_ids
    referencing valid chunks."""
    tenant = _tenant("chat-e2e")
    student = _user(tenant, "s@e2e.edu")
    res = Resource.objects.create(
        tenant=tenant, title="Water notes", uploaded_by=student,
        visibility_scope="institution", processing_status="ready",
    )
    chunk = _chunk(tenant, res, "Evaporation condenses into clouds.", index=1)
    session = ChatSession.objects.create(tenant=tenant, user=student, title="t")

    source_meta = [
        {
            "chunk_id": str(chunk.id),
            "rank": 1,
            "similarity_score": 0.94,
            "retrieval_method": "hybrid",
        }
    ]
    with patch(
        "apps.chat.services.turns.generate_grounded_answer",
        return_value=("Water evaporates then condenses.", source_meta),
    ):
        client = APIClient()
        client.force_authenticate(student)
        resp = client.post(
            f"/api/v1/chat/sessions/{session.id}/messages/",
            {"content": "How does water cycle?"},
            format="json",
        )

    assert resp.status_code == 201, resp.data
    assistant = resp.data["assistant_message"]
    # Citations persisted as relation rows AND reflected in the derived field.
    assert assistant["retrieved_chunk_ids"] == [str(chunk.id)]
    assert ChatMessageSource.objects.filter(
        message_id=assistant["id"], chunk_id=chunk.id, tenant=tenant,
    ).count() == 1

    # Every id references a real chunk in the same tenant (no phantom ids).
    persisted = ChatMessage.objects.get(id=assistant["id"])
    ids = [uuid for uuid in ChatMessageSerializer(persisted).data["retrieved_chunk_ids"]]
    assert ResourceChunk.objects.filter(id__in=ids, tenant=tenant).count() == len(ids)