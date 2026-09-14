import logging

from django.conf import settings

logger = logging.getLogger(__name__)
ALLOWED_MIME_PREFIXES = (
    "text/", "application/pdf", "application/json", "application/msword",
    "application/vnd.openxmlformats-officedocument",
)
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
class FileValidationError(Exception):
    pass
def validate_upload_bytes(data: bytes, content_type: str = "", filename: str = "") -> None:
    if not data:
        raise FileValidationError("Empty file")
    if len(data) > MAX_UPLOAD_BYTES:
        raise FileValidationError("File exceeds maximum allowed size")
    ct = (content_type or "").lower()
    if ct and not any(ct.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        if ct not in ("application/octet-stream",):
            raise FileValidationError(f"Disallowed content type: {ct}")
    head = data[:512]
    if b"<script" in head.lower() and (filename or "").lower().endswith((".html", ".htm", ".svg")):
        raise FileValidationError("Potentially unsafe HTML content")
    if b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE" in data:
        raise FileValidationError("Malware signature detected (EICAR)")
    try:
        import clamd
        cd = clamd.ClamdUnixSocket()
        result = cd.instream(data)
        status = result.get("stream", ("OK",))[0]
        if status != "OK":
            raise FileValidationError(f"Malware scan failed: {status}")
    except FileValidationError:
        raise
    except Exception as exc:
        # CLAMAV_STRICT (production default True): a scanner outage is a
        # security event, not a reason to accept an unscanned upload. Fail
        # closed so malware can never pass through because clamd is down or
        # misconfigured. Local/dev environments opt out explicitly.
        if settings.CLAMAV_STRICT:
            raise FileValidationError(f"Malware scanner unavailable: {exc}")
        if isinstance(exc, ImportError):
            logger.debug("clamd not installed; signature-only scan applied")
        else:
            logger.warning("Malware scanner unavailable; upload accepted in non-strict mode: %s", exc)
