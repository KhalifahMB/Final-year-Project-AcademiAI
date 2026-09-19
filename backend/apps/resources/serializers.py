from rest_framework import serializers
from .models import Resource, ResourceVersion, ResourceSummary, ResourceReport


class ResourceSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(source="uploaded_by.username", read_only=True, default=None)
    latest_summary = serializers.SerializerMethodField()
    # Explicit per-user read grants. Accepts a list of user emails; the server
    # resolves them within the caller's tenant and stores ResourcePermission
    # rows (permission="read"). Granting is limited to the uploader/admins.
    shared_with = serializers.ListField(
        child=serializers.EmailField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    shared_with_users = serializers.SerializerMethodField()

    def validate(self, attrs):
        """
        Course-linked materials are permission-gated:

        - Course-offering attachments must belong to the caller's tenant.
        - Students may attach an offering ONLY when they are enrolled and
          keep 'course' visibility (their upload surface is the Resources
          page; course-page uploads belong to lecturers).
        - Lecturers may attach ONLY offerings they are assigned to teach;
          for 'department' visibility the owning department is coerced from
          the offering's course so a lecturer can never file material under
          another department.
        - Tenant admins / platform users are unrestricted.
        """
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not getattr(user, "tenant_id", None):
            return attrs

        # Per-user sharing is owner/admin-only (defense in depth on top of
        # IsOwnerOrAdminForWrite on the update/destroy actions).
        shared_with = attrs.get("shared_with")
        if shared_with is not None:
            is_owner_or_admin = bool(getattr(user, "is_tenant_admin", False)) or bool(
                getattr(user, "is_superuser", False)
            ) or (
                self.instance is not None
                and getattr(self.instance, "uploaded_by_id", None) == user.id
            )
            if not is_owner_or_admin:
                raise serializers.ValidationError(
                    {"shared_with": "Only the uploader or a tenant admin can share this material."}
                )
            attrs["_shared_with_emails"] = [
                e.strip().lower() for e in shared_with if e and e.strip()
            ]

        offering = attrs.get("course_offering")
        if offering is None:
            return attrs

        if offering.tenant_id != user.tenant_id:
            raise serializers.ValidationError({"course_offering": "Unknown offering."})

        scope = attrs.get("visibility_scope") or (
            getattr(self.instance, "visibility_scope", None) or Resource.Visibility.COURSE
        )
        is_admin = bool(getattr(user, "is_tenant_admin", False)) or bool(
            getattr(user, "is_superuser", False)
        )
        if is_admin:
            return attrs

        role = getattr(user, "role", None)
        from apps.academics.models import (
            CourseEnrollment,
            LecturerCourseAssignment,
        )

        if role == "student":
            if scope != Resource.Visibility.COURSE:
                raise serializers.ValidationError(
                    {"visibility_scope": "Students can only attach materials to their enrolled course offerings with 'course' visibility."}
                )
            enrolled = CourseEnrollment.objects.filter(
                student=user,
                course_offering=offering,
                status=CourseEnrollment.Status.ENROLLED,
            ).exists()
            if not enrolled:
                raise serializers.ValidationError(
                    {"course_offering": "You are not enrolled in this offering."}
                )
            return attrs

        if role == "lecturer":
            assigned = LecturerCourseAssignment.objects.filter(
                lecturer=user, course_offering=offering
            ).exists()
            if not assigned:
                raise serializers.ValidationError(
                    {"course_offering": "You are not assigned to teach this offering."}
                )
            if scope == Resource.Visibility.DEPARTMENT:
                attrs["department"] = offering.course.department
            return attrs

        raise serializers.ValidationError(
            {"course_offering": "You cannot attach materials to a course offering."}
        )

    class Meta:
        model = Resource
        fields = (
            "id", "title", "description", "visibility_scope", "mime_type",
            "processing_status", "processing_error", "moderation_status",
            "has_extractable_text",
            "course_offering", "programme", "department", "faculty",
            "uploaded_by", "uploaded_by_username", "tenant",
            "shared_with", "shared_with_users",
            "created_at", "updated_at", "latest_summary",
        )
        read_only_fields = (
            "id", "processing_status", "processing_error", "moderation_status",
            "has_extractable_text",
            "uploaded_by", "tenant", "created_at", "updated_at",
            "latest_summary", "shared_with_users",
        )

    def create(self, validated_data):
        emails = validated_data.pop("_shared_with_emails", None)
        instance = super().create(validated_data)
        if emails is not None:
            self._sync_shared_with(instance, emails)
        return instance

    def update(self, instance, validated_data):
        emails = validated_data.pop("_shared_with_emails", None)
        instance = super().update(instance, validated_data)
        if emails is not None:
            self._sync_shared_with(instance, emails)
        return instance

    def _sync_shared_with(self, instance, emails):
        """Replace the user-level grants with the provided email list.

        Only users inside the resource's tenant are eligible; unknown or
        cross-tenant emails are dropped (the listing filters ensure owners
        cannot grant to strangers). Staff rows (role/course_offering based,
        user=None) are left untouched.
        """
        from apps.accounts.models import User
        from .models import ResourcePermission

        ResourcePermission.objects.filter(
            resource=instance, user__isnull=False, permission="read",
        ).delete()
        if not emails:
            return
        users = User.objects.filter(
            email__in=emails, tenant_id=instance.tenant_id, is_active=True,
        )
        for u in users:
            ResourcePermission.objects.get_or_create(
                resource=instance, user=u, permission="read",
                defaults={"tenant": instance.tenant},
            )

    def get_shared_with_users(self, obj):
        from .models import ResourcePermission

        rows = (
            obj.permissions.filter(user__isnull=False)
            .select_related("user")
            .order_by("user__email")
        )
        return [
            {
                "id": str(r.user_id),
                "email": r.user.email,
                "name": (
                    f"{r.user.first_name} {r.user.last_name}".strip()
                    or r.user.email
                ),
            }
            for r in rows
        ]

    def get_latest_summary(self, obj):
        s = getattr(obj, "prefetched_latest_summary", None)
        if isinstance(s, list):
            s = s[0] if s else None
        if s is None:
            s = obj.summaries.order_by("-created_at").first()
        if s is None:
            return None

        return {
            "id": str(s.id),
            "summary": s.summary,
            "key_points": s.key_points or [],
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "created_by_name": (
                f"{s.created_by.first_name} {s.created_by.last_name}".strip()
                if s.created_by else None
            ),
        }


class ResourceVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceVersion
        fields = (
            "id", "resource", "version_number",
            "file_size_bytes", "created_by", "created_at",
        )
        read_only_fields = fields


class ResourceSummarySerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ResourceSummary
        fields = (
            "id", "resource", "version_number", "created_by",
            "created_by_name", "summary", "key_points",
            "word_count", "model_name", "created_at",
        )
        read_only_fields = fields

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.email


class ResourceReportSerializer(serializers.ModelSerializer):
    reported_by_name = serializers.SerializerMethodField()
    resource_title = serializers.CharField(source="resource.title", read_only=True)
    tenant = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ResourceReport
        fields = (
            "id", "resource", "resource_title", "reported_by", "reported_by_name",
            "reason", "details", "status", "resolved_by", "resolved_at",
            "tenant", "created_at",
        )
        read_only_fields = (
            "id", "resource", "reported_by", "reported_by_name", "status",
            "resolved_by", "resolved_at", "tenant", "created_at",
        )

    def get_reported_by_name(self, obj):
        if not obj.reported_by:
            return None
        full = f"{obj.reported_by.first_name} {obj.reported_by.last_name}".strip()
        return full or obj.reported_by.email
