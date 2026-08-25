import logging
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
    except ImportError:
        logger.debug("clamd not installed; signature-only scan applied")
    except FileValidationError:
        raise
    except Exception as exc:
        logger.warning("Malware scanner unavailable: %s", exc)
