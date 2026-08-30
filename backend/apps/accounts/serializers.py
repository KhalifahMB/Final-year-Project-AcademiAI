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
    has_custom_avatar = serializers.SerializerMethodField()

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
            "phone_number",
            "gender",
            "avatar_preset",
            "has_custom_avatar",
            "created_at",
        )
        read_only_fields = fields

    def get_has_custom_avatar(self, obj):
        return bool(obj.avatar_key)


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Self-service profile updates. Personal data only: name, email, phone,
    gender and avatar preset. Role, tenant, and verification state are
    server-controlled — exposing them here allowed privilege escalation.
    Institution affiliation is immutable by design.
    """

    class Meta:
        model = User
        fields = (
            "first_name",
            "last_name",
            "email",
            "phone_number",
            "gender",
            "avatar_preset",
        )

    def validate_email(self, value):
        email = value.lower().strip()
        qs = User.objects.filter(email__iexact=email).exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "A user with this email already exists."
            )
        return email


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    tenant_slug = serializers.SlugField(required=False)
    # Accepted but never trusted: the view coerces anything other than
    # student/lecturer down to student (privilege-escalation guard).
    role = serializers.CharField(required=False, default="student")
    # Optional programme (students) — builds the academic profile used to
    # scope institution structure and course enrolment.
    programme = serializers.UUIDField(required=False, allow_null=True)
    gender = serializers.ChoiceField(
        choices=User.Gender.choices, required=False, allow_blank=True
    )
    avatar_preset = serializers.CharField(required=False, allow_blank=True)

    def validate_password(self, value):
        validate_password(value)
        return value


class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=12)


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()


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
