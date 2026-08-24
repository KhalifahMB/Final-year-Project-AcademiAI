from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class UserSerializer(serializers.ModelSerializer):
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
            "tenant",
            "created_at",
        )
        read_only_fields = ("id", "is_email_verified", "created_at", "tenant")


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.STUDENT)
    tenant_slug = serializers.SlugField(required=False)  # optional for first admin

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
