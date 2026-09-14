"""HttpOnly JWT auth-cookie setter/clearer.

The access token also travels in the Authorization header for legacy
clients; the refresh token is cookie-only (see AUTH_COOKIE_* settings).
"""
from django.conf import settings


def set_auth_cookies(response, access, refresh=None, max_age_access=None, max_age_refresh=None):
    """Attach the JWT payload as HttpOnly SameSite=Strict cookies.

    ``max_age_access`` / ``max_age_refresh`` default to the SIMPLE_JWT token
    lifetimes so persistent cookies expire with the tokens themselves.
    """
    if max_age_access is None:
        max_age_access = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())
    _set_cookie(
        response,
        settings.AUTH_COOKIE_NAMES[0],
        access,
        max_age_access,
    )
    if refresh is not None:
        if max_age_refresh is None:
            max_age_refresh = int(
                settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()
            )
        _set_cookie(
            response,
            settings.AUTH_COOKIE_NAMES[1],
            refresh,
            max_age_refresh,
        )
    return response


def _set_cookie(response, name, value, max_age):
    response.set_cookie(
        name,
        value,
        max_age=max_age,
        path=settings.AUTH_COOKIE_PATH,
        secure=settings.AUTH_COOKIE_SECURE,
        httponly=True,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


def clear_auth_cookies(response):
    """Expire both auth cookies (current path + root) on logout."""
    for name in settings.AUTH_COOKIE_NAMES:
        response.delete_cookie(name, path=settings.AUTH_COOKIE_PATH)
        response.delete_cookie(name)
    return response