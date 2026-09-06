from rest_framework import serializers
from .models import Resource, ResourceVersion, ResourceSummary


class ResourceSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(source="uploaded_by.username", read_only=True, default=None)
    latest_summary = serializers.SerializerMethodField()

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
            "processing_status", "processing_error",
            "has_extractable_text",
            "course_offering", "programme", "department", "faculty",
            "uploaded_by", "uploaded_by_username", "tenant",
            "created_at", "updated_at", "latest_summary",
        )
        read_only_fields = (
            "id", "processing_status", "processing_error",
            "has_extractable_text",
            "uploaded_by", "tenant", "created_at", "updated_at",
            "latest_summary",
        )

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
