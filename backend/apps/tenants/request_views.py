"""
Public tenant-request endpoint + superuser review endpoints.

Flow:
  POST  /tenant-requests/            — public submission
  GET   /tenant-requests/            — superuser list (filter ?status=pending)
  GET   /tenant-requests/{id}/       — superuser detail
  POST  /tenant-requests/{id}/review — superuser approve/reject
"""
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsSuperuser
from .models import Tenant, TenantRequest
from .serializers import (
    TenantRequestCreateSerializer,
    TenantRequestReviewSerializer,
    TenantRequestSerializer,
)


@extend_schema(
    tags=["Tenants"],
    summary="Request a new institution (public)",
    description=(
        "Public. Lets a visitor (e.g. an ICT director, lecturer) request their "
        "university be provisioned on AcademiAI. Rate-limit this in production."
    ),
)
class TenantRequestCreateView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "tenant_request"

    def post(self, request):
        ser = TenantRequestCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        # Prevent duplicate pending requests from the same email for same name
        email = ser.validated_data["requester_email"].lower()
        name = ser.validated_data["institution_name"].strip()
        if TenantRequest.objects.filter(
            requester_email=email,
            institution_name__iexact=name,
            status=TenantRequest.Status.PENDING,
        ).exists():
            return Response(
                {
                    "success": False,
                    "error": {
                        "detail": "A pending request for this institution from this email already exists."
                    },
                },
                status=status.HTTP_409_CONFLICT,
            )
        obj = ser.save()
        return Response(
            TenantRequestSerializer(obj).data, status=status.HTTP_201_CREATED,
        )


@extend_schema(
    tags=["Tenants"],
    summary="List tenant sign-up requests",
    description="Superuser-only. Filter by ?status=pending|approved|rejected.",
)
class TenantRequestListView(APIView):
    permission_classes = [IsSuperuser]

    def get(self, request):
        qs = TenantRequest.objects.all()
        st = request.query_params.get("status", "").strip()
        if st:
            qs = qs.filter(status=st)
        qs = qs.order_by("-created_at")[:200]
        return Response({
            "count": qs.count(),
            "results": TenantRequestSerializer(qs, many=True).data,
        })


@extend_schema(
    tags=["Tenants"],
    summary="Review a tenant request (approve/reject)",
    description="Approve provisions a new tenant. Reject just updates status.",
)
class TenantRequestReviewView(APIView):
    permission_classes = [IsSuperuser]

    def post(self, request, pk):
        try:
            req = TenantRequest.objects.get(pk=pk)
        except TenantRequest.DoesNotExist:
            return Response(
                {"error": {"detail": "Request not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        if req.status != TenantRequest.Status.PENDING:
            return Response(
                {"error": {"detail": "This request has already been reviewed."}},
                status=status.HTTP_409_CONFLICT,
            )
        ser = TenantRequestReviewSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        v = ser.validated_data

        req.reviewed_by = request.user
        req.reviewed_at = timezone.now()
        req.review_notes = v.get("review_notes", "")

        if v["action"] == "approve":
            # Provision a new tenant
            tenant = Tenant.objects.create(
                name=req.institution_name,
                slug=req.institution_slug,
                domain=req.institution_domain or "",
                plan=v.get("plan", "standard"),
                storage_quota_bytes=v.get("storage_quota_bytes", 10 * 1024 ** 3),
                status=Tenant.Status.ACTIVE,
            )
            req.provisioned_tenant = tenant
            req.status = TenantRequest.Status.APPROVED
        else:
            req.status = TenantRequest.Status.REJECTED
        req.save()
        return Response(TenantRequestSerializer(req).data)
