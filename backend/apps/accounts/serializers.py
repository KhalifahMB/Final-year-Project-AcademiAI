from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class UserSerializer(serializers.ModelSerializer):
    """
    Read representation of a user. Writable only via ProfileUpdateSerializer
    (self-service) or UserAdminViewSet (tenant admin).
    """

    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "is_email_verified",
            "is_superuser",
            "tenant",
            "created_at",
        )
        read_only_fields = fields


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Self-service profile updates. Deliberately narrow: users may change only
    their own display name. Role, tenant, and verification state are
    server-controlled — exposing them here allowed privilege escalation.
    """

    class Meta:
        model = User
        fields = ("first_name", "last_name")


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    tenant_slug = serializers.SlugField(required=False)
    # Accepted but never trusted: the view coerces anything other than
    # student/lecturer down to student (privilege-escalation guard).
    role = serializers.CharField(required=False, default="student")
    # Optional programme (students) — drives the academic profile and
    # auto-enrollment into departmental course offerings on verification.
    programme = serializers.UUIDField(required=False, allow_null=True)

    def validate_password(self, value):
        validate_password(value)
        return value


class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=12)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["tenant_id"] = str(user.tenant_id) if user.tenant_id else None
        token["email"] = user.email
        return token


class MessageResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField(required=False)
    detail = serializers.CharField(required=False, allow_null=True)


class AuthTokenResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()


class LogoutRequestSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class JobStatusResponseSerializer(serializers.Serializer):
    job_id = serializers.CharField()
    status = serializers.CharField()
    ready = serializers.BooleanField()
    successful = serializers.BooleanField(allow_null=True)
    result = serializers.JSONField(required=False, allow_null=True)
    error = serializers.CharField(required=False, allow_null=True)
