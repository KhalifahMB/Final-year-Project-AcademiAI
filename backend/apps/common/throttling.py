"""
Reusable scoped throttles.

Settings define rates under DEFAULT_THROTTLE_RATES:
    ai     — expensive AI operations (chat, summarize, quiz generation)
    upload — storage upload endpoints
    auth   — authentication endpoints (applied via throttle_scope on views)
"""
from rest_framework.throttling import ScopedRateThrottle


class AiRateThrottle(ScopedRateThrottle):
    scope = "ai"


class UploadRateThrottle(ScopedRateThrottle):
    scope = "upload"
