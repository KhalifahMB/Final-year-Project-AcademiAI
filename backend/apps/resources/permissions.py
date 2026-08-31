"""
Object-level permission for resources: every tenant member may read and
upload; only the uploader or a tenant admin may modify or delete.
"""
from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsOwnerOrAdminForWrite(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return (
            getattr(request.user, "is_tenant_admin", False)
            or obj.uploaded_by_id == request.user.id
        )
