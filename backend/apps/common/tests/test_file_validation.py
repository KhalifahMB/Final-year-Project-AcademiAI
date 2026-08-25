from apps.common.security.file_validation import validate_upload_bytes, FileValidationError

def test_rejects_empty():
    try:
        validate_upload_bytes(b"")
        assert False
    except FileValidationError:
        pass

def test_accepts_text():
    validate_upload_bytes(b"hello", content_type="text/plain")
