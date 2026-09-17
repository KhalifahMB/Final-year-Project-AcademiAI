"""
Reusable scoped throttles.

Settings define rates under DEFAULT_THROTTLE_RATES:
    ai     — expensive AI operations (chat, summarize, quiz generation)
    upload — storage upload endpoints
    auth   — authentication endpoints (applied via throttle_scope on views)
    auth_ip — per-client-IP flood guard for AllowAny auth endpoints

DRF 3.18's ``ScopedRateThrottle`` resolves ``scope`` only from
``view.throttle_scope``. Our throttles declare their scope as a class
attribute instead, so ``allow_request`` falls back to the class scope when
the view does not set one — otherwise the limit silently never fires.
"""
from rest_framework.throttling import ScopedRateThrottle


class _ClassScopedThrottle(ScopedRateThrottle):
    """ScopedRateThrottle that keeps the class-level ``scope``.

    ``ScopedRateThrottle.allow_request`` overwrites ``self.scope`` from the
    view attribute and returns True when it is unset. This subclass prefers
    the class attribute so hand-rolled scopes like ``ai`` / ``upload`` /
    ``auth_ip`` actually take effect without every view declaring
    ``throttle_scope``.
    """

    scope = None

    def allow_request(self, request, view):
        view_scope = getattr(view, self.scope_attr, None)
        self.scope = view_scope or self.scope
        if not self.scope:
            return True
        self.rate = self.get_rate()
        self.num_requests, self.duration = self.parse_rate(self.rate)
        return super(ScopedRateThrottle, self).allow_request(request, view)


class AiRateThrottle(_ClassScopedThrottle):
    scope = "ai"


class UploadRateThrottle(_ClassScopedThrottle):
    scope = "upload"


class AuthFloodThrottle(_ClassScopedThrottle):
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