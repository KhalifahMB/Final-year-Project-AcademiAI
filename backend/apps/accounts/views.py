import logging
import uuid

from django.contrib.auth import authenticate
from rest_framework import parsers
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import User
from .serializers import (
    SignupSerializer,
    VerifyEmailSerializer,
    ResendVerificationSerializer,
    LoginSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    PasswordChangeSerializer,
    UserSerializer,
    ProfileUpdateSerializer,
    CustomTokenObtainPairSerializer,
    MessageResponseSerializer,
    AuthTokenResponseSerializer,
    LogoutRequestSerializer,
)
from . import services
from apps.audit.services import log_action
from apps.common.permissions import IsAdminRole

logger = logging.getLogger(__name__)


class SignupView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    @extend_schema(
        tags=["Authentication"],
        request=SignupSerializer,
        responses={201: MessageResponseSerializer, 400: MessageResponseSerializer},
        summary="Create a user account and trigger email verification",
        description=(
            "Registers a student within the given institution slug and "
            "emails a single-use verification code. Accounts cannot sign in "
            "until verified; lecturer/admin roles are granted by tenant admins."
        ),
        auth=[],
    )
    def post(self, request):
        # Accept both JSON and multipart (multipart carries an optional
        # profile picture chosen during signup).
        ser = SignupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        # Self-service signup is limited to student/lecturer; admin is
        # only ever granted by an existing tenant admin or the platform.
        role = data.get("role", User.Role.STUDENT)
        if role not in (User.Role.STUDENT, User.Role.LECTURER):
            role = User.Role.STUDENT
        try:
            user, code = services.signup_user(
                email=data["email"],
                password=data["password"],
                first_name=data.get("first_name", ""),
                last_name=data.get("last_name", ""),
                role=role,
                tenant_slug=data.get("tenant_slug"),
                programme_id=data.get("programme"),
                gender=data.get("gender", ""),
                avatar_preset=data.get("avatar_preset", ""),
            )
        except ValueError as e:
            return Response(
                {"success": False, "error": {"detail": str(e)}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Optional profile picture uploaded at signup time.
        avatar_file = request.FILES.get("avatar")
        if avatar_file is not None and user.tenant_id:
            raw = avatar_file.read(MAX_AVATAR_BYTES + 1)
            sniffed = (
                _sniff_image(raw)
                if len(raw) <= MAX_AVATAR_BYTES
                else None
            )
            if sniffed:
                content_type, ext = sniffed
                from django.conf import settings
                from apps.common.storage import get_s3_client

                key = f"tenants/{user.tenant_id}/avatars/{user.id}/{uuid.uuid4()}{ext}"
                try:
                    get_s3_client().put_object(
                        Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                        Key=key,
                        Body=raw,
                        ContentType=content_type,
                        ContentLength=len(raw),
                    )
                    user.avatar_key = key
                    user.save(update_fields=["avatar_key", "updated_at"])
                except Exception:
                    logger.exception(
                        "Signup avatar upload failed user=%s", user.id
                    )
            else:
                logger.info("Signup avatar rejected (type/size) email=%s", data["email"])
        # Dispatch email task (non-blocking)
        try:
            from .tasks import send_verification_email

            send_verification_email(str(user.id), code)
        except Exception:
            logger.exception("Failed to queue verification email")
        return Response(
            {
                "success": True,
                "message": "Account created. Please verify your email.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    @extend_schema(
        tags=["Authentication"],
        request=VerifyEmailSerializer,
        responses={200: MessageResponseSerializer, 400: MessageResponseSerializer},
        summary="Verify a signup verification code",
        auth=[],
    )
    def post(self, request):
        ser = VerifyEmailSerializer(data=request.data)

        try:
            ser.is_valid(raise_exception=True)
            user = services.verify_email_code(
                ser.validated_data["email"], ser.validated_data["code"]
            )
        except ValueError as e:
            return Response(
                {"success": False, "error": {"detail": str(e)}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {"success": True, "message": "Email verified.", "user": UserSerializer(user).data}
        )


class ResendVerificationView(APIView):
    """POST /auth/resend-verification/  { "email": "..." }

    Issues a fresh 6-digit verification code and emails it. Always returns
    the same success response regardless of whether the email exists, to
    prevent account enumeration. Rate-limited via the auth throttle and
    a 60-second server-side cooldown.
    """

    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    @extend_schema(
        tags=["Authentication"],
        request=ResendVerificationSerializer,
        responses={200: MessageResponseSerializer, 400: MessageResponseSerializer},
        summary="Resend email verification code",
        auth=[],
    )
    def post(self, request):
        ser = ResendVerificationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        services.resend_verification_code(ser.validated_data["email"])
        return Response(
            {
                "success": True,
                "message": "If an account exists with that email and is not yet verified, a new code has been sent.",
            }
        )


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    @extend_schema(
        tags=["Authentication"],
        request=LoginSerializer,
        responses={200: AuthTokenResponseSerializer, 401: MessageResponseSerializer},
        summary="Authenticate and return access/refresh tokens",
        auth=[],
    )
    def post(self, request):
        ser = LoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=ser.validated_data["email"],
            password=ser.validated_data["password"],
        )
        if not user:
            return Response(
                {"success": False, "error": {"detail": "Invalid credentials."}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if not user.is_active:
            return Response(
                {"success": False, "error": {"detail": "Account is inactive."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not user.is_email_verified:
            return Response(
                {"success": False, "error": {"detail": "Email not verified."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        refresh = RefreshToken.for_user(user)
        # Enrich claims
        refresh["role"] = user.role
        refresh["tenant_id"] = str(user.tenant_id) if user.tenant_id else None
        return Response(
            {
                "success": True,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            }
        )


class LogoutView(APIView):
    @extend_schema(
        tags=["Authentication"],
        request=LogoutRequestSerializer,
        responses={200: MessageResponseSerializer},
        summary="Blacklist the supplied refresh token",
    )
    def post(self, request):
        try:
            refresh = request.data.get("refresh")
            if refresh:
                token = RefreshToken(refresh)
                token.blacklist()
        except Exception:
            pass
        return Response({"success": True, "message": "Logged out."})


class MeView(generics.RetrieveUpdateAPIView):
    """
    GET  /auth/me/ — authenticated profile.
    PATCH /auth/me/ — update own display name only (role/tenant are
    server-controlled; see ProfileUpdateSerializer).
    """

    serializer_class = UserSerializer

    def get_serializer_class(self):
        if self.request.method in ("PATCH", "PUT"):
            return ProfileUpdateSerializer
        return UserSerializer

    def get_object(self):
        return self.request.user


MeView = extend_schema_view(
    get=extend_schema(tags=["Authentication"], summary="Get authenticated profile"),
    patch=extend_schema(
        tags=["Authentication"],
        summary="Update own personal profile",
        description="Personal data only (name, email, phone, gender, avatar preset); role, tenant, and verification state are server-controlled.",
    ),
    put=extend_schema(tags=["Authentication"], summary="Replace own display name", deprecated=True),
)(MeView)


MAX_AVATAR_BYTES = 2 * 1024 * 1024  # 2 MB

_AVATAR_MAGIC = (
    (b"\xff\xd8\xff", "image/jpeg", ".jpg"),
    (b"\x89PNG\r\n\x1a\n", "image/png", ".png"),
    (b"GIF87a", "image/gif", ".gif"),
    (b"GIF89a", "image/gif", ".gif"),
)


def _sniff_image(raw: bytes):
    """Return (content_type, ext) for allowed image magic bytes, else None."""
    for magic, ctype, ext in _AVATAR_MAGIC:
        if raw.startswith(magic):
            return ctype, ext
    # WebP: RIFF....WEBP
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp", ".webp"
    return None


class AvatarView(APIView):
    """
    GET    /auth/me/avatar/ — short-lived signed URL for the user's uploaded
            picture (empty url when none).
    POST   /auth/me/avatar/ — multipart upload (field `file`, <=2 MB,
            png/jpeg/gif/webp). Stored under the tenant's storage partition.
    DELETE /auth/me/avatar/ — remove the custom picture.
    """

    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    @extend_schema(tags=["Profile"], summary="Get own avatar URL")
    def get(self, request):
        user = request.user
        if not user.avatar_key:
            return Response({"url": None})
        from apps.common.storage import generate_presigned_download_url

        try:
            url = generate_presigned_download_url(user.avatar_key, expires_in=3600)
        except Exception:
            logger.exception("Avatar presign failed user=%s", user.id)
            return Response(
                {"success": False, "error": {"detail": "Avatar storage unavailable."}},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({"url": url})

    @extend_schema(tags=["Profile"], summary="Upload own avatar picture")
    def post(self, request):
        from django.core.files.uploadedfile import UploadedFile

        f = request.FILES.get("file")
        if not isinstance(f, UploadedFile):
            return Response(
                {"success": False, "error": {"detail": "No file provided."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        raw = f.read(MAX_AVATAR_BYTES + 1)
        if len(raw) > MAX_AVATAR_BYTES:
            return Response(
                {"success": False, "error": {"detail": "Image must be 2 MB or smaller."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sniffed = _sniff_image(raw)
        if not sniffed:
            return Response(
                {"success": False, "error": {"detail": "Unsupported image type. Use PNG, JPEG, GIF or WebP."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        content_type, ext = sniffed
        user = request.user
        key = f"tenants/{user.tenant_id}/avatars/{user.id}/{uuid.uuid4()}{ext}"
        from django.conf import settings
        from apps.common.storage import get_s3_client, delete_object

        try:
            client = get_s3_client()
            client.put_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=key,
                Body=raw,
                ContentType=content_type,
                ContentLength=len(raw),
            )
        except Exception:
            logger.exception("Avatar upload failed user=%s", user.id)
            return Response(
                {"success": False, "error": {"detail": "Could not store the image. Try again."}},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        old_key = user.avatar_key
        user.avatar_key = key
        user.save(update_fields=["avatar_key", "updated_at"])
        if old_key and old_key != key:
            try:
                delete_object(old_key)
            except Exception:
                logger.warning("Old avatar cleanup failed user=%s", user.id)
        log_action(
            tenant=user.tenant,
            actor=user,
            action="user.avatar_update",
            entity_type="user",
            entity_id=str(user.id),
        )
        return Response({"success": True, "has_custom_avatar": True})

    @extend_schema(tags=["Profile"], summary="Remove own avatar picture")
    def delete(self, request):
        user = request.user
        old_key = user.avatar_key
        user.avatar_key = ""
        user.save(update_fields=["avatar_key", "updated_at"])
        if old_key:
            try:
                from apps.common.storage import delete_object

                delete_object(old_key)
            except Exception:
                logger.warning("Avatar object cleanup failed user=%s", user.id)
        return Response({"success": True, "has_custom_avatar": False})


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    @extend_schema(
        tags=["Authentication"],
        request=PasswordResetRequestSerializer,
        responses={200: MessageResponseSerializer},
        summary="Request a password reset email (generic response; no enumeration)",
        auth=[],
    )
    def post(self, request):
        ser = PasswordResetRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data.get("email")
        user = User.objects.filter(email__iexact=email).first()
        if user:
            token = services.create_password_reset_token(user)
            try:
                from .tasks import send_password_reset_email

                send_password_reset_email(str(user.id), token)
            except Exception:
                logger.exception("Failed to queue password reset email")
        # Always same response (no enumeration)
        return Response(
            {
                "success": True,
                "message": "If an account exists, a reset email has been sent.",
            }
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    @extend_schema(
        tags=["Authentication"],
        request=PasswordResetConfirmSerializer,
        responses={200: MessageResponseSerializer, 400: MessageResponseSerializer},
        summary="Confirm password reset with a single-use token",
        auth=[],
    )
    def post(self, request):
        ser = PasswordResetConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            services.confirm_password_reset(
                ser.validated_data["email"],
                ser.validated_data["token"],
                ser.validated_data["new_password"],
            )
        except ValueError as e:
            return Response(
                {"success": False, "error": {"detail": str(e)}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"success": True, "message": "Password has been reset."})


class PasswordChangeView(APIView):
    @extend_schema(
        tags=["Authentication"],
        request=PasswordChangeSerializer,
        responses={200: MessageResponseSerializer, 400: MessageResponseSerializer},
        summary="Change password for the authenticated user",
    )
    def post(self, request):
        ser = PasswordChangeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(ser.validated_data["old_password"]):
            return Response(
                {"success": False, "error": {"detail": "Incorrect current password."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(ser.validated_data["new_password"])
        user.save(update_fields=["password"])
        # Security notification per email-services.md flow 5.
        try:
            from .tasks import send_password_changed_email

            send_password_changed_email(str(user.id))
        except Exception:
            logger.exception("Failed to queue password-changed notification")
        log_action(
            tenant=user.tenant,
            actor=user,
            action="user.password_change",
            entity_type="user",
            entity_id=str(user.id),
        )
        return Response({"success": True, "message": "Password changed."})


@extend_schema_view(
    post=extend_schema(
        tags=["Authentication"],
        summary="Refresh access token",
        description="Exchanges a valid refresh token for a new access token (rotation enabled; used refresh tokens are blacklisted).",
        auth=[],
    )
)
class TaggedTokenRefreshView(TokenRefreshView):
    pass


@extend_schema(tags=["Users"])
class UserAdminViewSet(viewsets.ModelViewSet):
    """
    Tenant-scoped user management (admin only). Role changes are audited.
    Sensitive fields (verification state, tenant) are read-only here;
    accounts are created exclusively through public signup.
    """

    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    search_fields = ["email", "first_name", "last_name"]
    filterset_fields = ["role", "is_active", "is_email_verified"]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return User.objects.none()
        return User.objects.filter(tenant=self.request.user.tenant).order_by("email")

    def perform_update(self, serializer):
        old_role = serializer.instance.role
        user = serializer.save()
        if user.role != old_role:
            log_action(
                tenant=self.request.user.tenant,
                actor=self.request.user,
                action="user.role_change",
                entity_type="user",
                entity_id=str(user.id),
                metadata={"from": old_role, "to": user.role},
            )

