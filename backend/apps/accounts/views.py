import logging

from django.contrib.auth import authenticate
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import User
from .serializers import (
    SignupSerializer,
    VerifyEmailSerializer,
    LoginSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    PasswordChangeSerializer,
    UserSerializer,
    CustomTokenObtainPairSerializer,
    MessageResponseSerializer,
    AuthTokenResponseSerializer,
    LogoutRequestSerializer,
)
from . import services
from apps.common.permissions import IsAdminRole

logger = logging.getLogger(__name__)


class SignupView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    @extend_schema(
        request=SignupSerializer,
        responses={201: MessageResponseSerializer, 400: MessageResponseSerializer},
        summary="Create a user account and trigger email verification",
        auth=[],
    )
    def post(self, request):
        ser = SignupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        try:
            user, code = services.signup_user(
                email=data["email"],
                password=data["password"],
                first_name=data.get("first_name", ""),
                last_name=data.get("last_name", ""),
                role=data.get("role", "student"),
                tenant_slug=data.get("tenant_slug"),
            )
        except ValueError as e:
            return Response(
                {"success": False, "error": {"detail": str(e)}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Dispatch email task (non-blocking)
        try:
            from .tasks import send_verification_email

            send_verification_email.delay(str(user.id), code)
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
        request=VerifyEmailSerializer,
        responses={200: MessageResponseSerializer, 400: MessageResponseSerializer},
        summary="Verify a signup verification code",
        auth=[],
    )
    def post(self, request):
        ser = VerifyEmailSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
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


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    @extend_schema(
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
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    @extend_schema(
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

                send_password_reset_email.delay(str(user.id), token)
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
        return Response({"success": True, "message": "Password changed."})


class UserAdminViewSet(viewsets.ModelViewSet):
    """Tenant-scoped user management (admin)."""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    search_fields = ["email", "first_name", "last_name"]
    filterset_fields = ["role", "is_active", "is_email_verified"]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return User.objects.none()
        return User.objects.filter(tenant=self.request.user.tenant).order_by("email")
