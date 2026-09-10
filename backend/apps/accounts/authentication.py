"""DRF authentication for the app's JWT transport.

Primary transport is the HttpOnly ``access_token`` cookie set by
login/token-refresh (XSS cannot read it). The legacy ``Authorization:
Bearer`` header is still honoured so native/API clients keep working and
the cookie path degrades gracefully.
"""
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken


class CookieJWTAuthentication(JWTAuthentication):
    """Accept a JWT from either the Authorization header or the access cookie.

    Header auth is tried first (explicit client intent), then the cookie.
    Missing/invalid cookie falls back to ``None`` so other auth classes or
    AllowAny views behave normally; a *present but invalid* cookie raises
    so a poisoned/stale session is surfaced as a 401 (frontend refreshes).
    """

    def authenticate(self, request):
        header_auth = super().authenticate(request)
        if header_auth is not None:
            return header_auth

        raw = request.COOKIES.get(settings.AUTH_COOKIE_NAMES[0])
        if not raw:
            return None

        try:
            validated = self.get_validated_token(raw)
        except InvalidToken as exc:
            raise AuthenticationFailed("Invalid token.") from exc
        return self.get_user(validated), validated