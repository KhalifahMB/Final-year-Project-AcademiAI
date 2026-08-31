"""
Reusable permission classes for tenant isolation and roles.
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsTenantMember(BasePermission):
    """User must belong to a tenant."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "tenant_id", None) is not None
        )


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "is_tenant_admin", False)
        )


class IsAdminRoleOrSuperuser(BasePermission):
    """Tenant admins, plus the platform operator (superuser)."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and (
                getattr(request.user, "is_tenant_admin", False)
                or request.user.is_superuser
            )
        )


class IsSuperuser(BasePermission):
    """Platform-operator level: provisioning tenants, plans, quotas."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_superuser
        )


class IsLecturerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        role = getattr(request.user, "role", None)
        return request.user and request.user.is_authenticated and role in ("lecturer", "tenant_admin")


class IsStudentOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated


class TenantObjectPermission(BasePermission):
    """
    Object-level: object.tenant_id must match request.user.tenant_id.
    Prevents IDOR across tenants.
    """

    def has_object_permission(self, request, view, obj):
        user_tenant = getattr(request.user, "tenant_id", None)
        obj_tenant = getattr(obj, "tenant_id", None)
        if obj_tenant is None and hasattr(obj, "tenant"):
            obj_tenant = getattr(obj.tenant, "id", None)
        return user_tenant is not None and str(user_tenant) == str(obj_tenant)
