"""
Consistent API error envelope.

Every error response leaves the API as:

    {"success": false, "error": {"code": "...", "detail": ..., "status_code": N}}

DRF raised exceptions are wrapped by the DRF exception handler; any other
exception escaping a view (500s) is caught here and enveloped the same way,
so the frontend never has to branch on ad-hoc shapes.
"""
import logging

from django.conf import settings
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


def _error_envelope(status_code, detail, code):
    return {
        "success": False,
        "error": {
            "status_code": status_code,
            "detail": detail,
            "code": code,
        },
    }


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        # An exception the DRF handler doesn't recognize escaped the view.
        # In DEBUG let Django surface the full traceback; in production reply
        # with a standard envelope instead of a bare HTML 500.
        if settings.DEBUG:
            return None
        logger.exception(
            "Unhandled exception in %s",
            getattr(context.get("view"), "__class__", None),
            exc_info=exc,
        )
        return Response(
            _error_envelope(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "Internal server error.",
                "internal_error",
            ),
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    data = _error_envelope(
        response.status_code,
        response.data,
        getattr(exc, "default_code", "error"),
    )
    # Flatten detail when it is a simple string
    if isinstance(response.data, dict) and "detail" in response.data and len(response.data) == 1:
        data["error"]["detail"] = response.data["detail"]
    response.data = data
    return response


class ServiceError(Exception):
    """Domain service error with HTTP status."""

    def __init__(self, message, status_code=status.HTTP_400_BAD_REQUEST, code="service_error"):
        self.message = message
        self.status_code = status_code
        self.code = code
        super().__init__(message)
