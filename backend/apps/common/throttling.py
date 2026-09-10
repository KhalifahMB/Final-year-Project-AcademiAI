"""
Reusable scoped throttles.

Settings define rates under DEFAULT_THROTTLE_RATES:
    ai     — expensive AI operations (chat, summarize, quiz generation)
    upload — storage upload endpoints
    auth   — authentication endpoints (applied via throttle_scope on views)
    auth_ip — per-client-IP flood guard for AllowAny auth endpoints
"""
from rest_framework.throttling import ScopedRateThrottle


class AiRateThrottle(ScopedRateThrottle):
    scope = "ai"


class UploadRateThrottle(ScopedRateThrottle):
    scope = "upload"


class AuthFloodThrottle(ScopedRateThrottle):
    """Per-IP cap for public (AllowAny) auth endpoints.

    ScopedRateThrottle keys on the authenticated user when a JWT is attached,
    which lets an attacker rotate/fresh accounts to saturate the cap. Public
    endpoints must instead be throttled by source IP regardless of any token
    that happens to be present — a distributed email-flood / credential-stuff
    defense, since a cross-site form POST cannot carry a Bearer token anyway.
    """

    scope = "auth_ip"

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
