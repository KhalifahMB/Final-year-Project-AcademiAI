"""
Tenant logging middleware: captures request/response metadata and creates
TenantLog entries. Automatically sanitizes PII from log data.
"""
import json
import re
import time

from django.utils.deprecation import MiddlewareMixin

_PII_FIELDS = re.compile(
    r"(password|token|secret|authorization|access_token|refresh_token)",
    re.IGNORECASE,
)

_PII_PATTERNS = [
    re.compile(r"(?i)(password\s*[=:]\s*)\S+"),
    re.compile(r"(?i)(token\s*[=:]\s*)\S+"),
    re.compile(r"(?i)(secret\s*[=:]\s*)\S+"),
]


def sanitize_log_data(data):
    """Recursively sanitize PII from data before logging."""
    if isinstance(data, dict):
        sanitized = {}
        for key, value in data.items():
            if _PII_FIELDS.search(str(key)):
                sanitized[key] = "***REDACTED***"
            elif isinstance(value, (dict, list)):
                sanitized[key] = sanitize_log_data(value)
            else:
                sanitized[key] = value
        return sanitized
    elif isinstance(data, list):
        return [sanitize_log_data(item) for item in data]
    elif isinstance(data, str):
        result = data
        for pattern in _PII_PATTERNS:
            result = pattern.sub(r"\1***REDACTED***", result)
        return result[:500]
    return data


class TenantLoggingMiddleware(MiddlewareMixin):
    """Logs request/response metadata to TenantLog model."""

    SKIP_PATHS = ("/health/", "/platform/health/", "/admin/", "/api/schema/", "/__/")

    def process_request(self, request):
        request._log_start_time = time.monotonic()
        request._log_response_status = None

    def process_response(self, request, response):
        try:
            return self._log_response(request, response)
        except Exception:
            return response

    def _log_response(self, request, response):
        path = getattr(request, "path", "")

        if any(path.startswith(skip) for skip in self.SKIP_PATHS):
            return response

        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return response

        tenant_id = getattr(user, "tenant_id", None)
        if not tenant_id:
            return response

        start_time = getattr(request, "_log_start_time", None)
        response_time_ms = None
        if start_time is not None:
            elapsed = time.monotonic() - start_time
            response_time_ms = int(elapsed * 1000)

        details = {}
        if request.method in ("POST", "PUT", "PATCH"):
            try:
                body = json.loads(request.body) if request.body else {}
                details["request_body"] = sanitize_log_data(body)
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass

        status_code = response.status_code
        if status_code >= 400:
            try:
                resp_data = json.loads(response.content) if response.content else {}
                details["response_data"] = sanitize_log_data(resp_data)
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass

        if status_code >= 500:
            level = "error"
        elif status_code >= 400:
            level = "warning"
        else:
            level = "info"

        category = "api"
        if "/chat/" in path:
            category = "chat"
        elif "/auth/" in path:
            category = "auth"
        elif "/resources/" in path:
            category = "resource"
        elif "/agent/" in path:
            category = "agent"

        action = f"{request.method} {path}"

        x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        ip_address = x_forwarded.split(",")[0].strip() if x_forwarded else request.META.get("REMOTE_ADDR")

        user_agent = (request.META.get("HTTP_USER_AGENT", "") or "")[:200]

        from apps.logs.models import TenantLog

        TenantLog.objects.create(
            tenant_id=tenant_id,
            level=level,
            category=category,
            action=action[:100],
            actor_id=user.id if hasattr(user, "id") else None,
            actor_email=user.email if hasattr(user, "email") else "",
            ip_address=ip_address,
            user_agent=user_agent,
            request_path=path[:500],
            request_method=request.method,
            response_status_code=status_code,
            response_time_ms=response_time_ms,
            details=details,
        )

        return response
