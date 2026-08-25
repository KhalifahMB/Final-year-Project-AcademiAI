"""
Consistent API error envelope.
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        data = {
            "success": False,
            "error": {
                "status_code": response.status_code,
                "detail": response.data,
                "code": getattr(exc, "default_code", "error"),
            },
        }
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
