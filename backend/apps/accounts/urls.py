from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    SignupView,
    VerifyEmailView,
    LoginView,
    LogoutView,
    MeView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    PasswordChangeView,
)

urlpatterns = [
    path("signup/", SignupView.as_view(), name="auth-signup"),
    path("verify-email/", VerifyEmailView.as_view(), name="auth-verify-email"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("password-reset/request/", PasswordResetRequestView.as_view(), name="auth-password-reset-request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="auth-password-reset-confirm"),
    path("password-change/", PasswordChangeView.as_view(), name="auth-password-change"),
]
