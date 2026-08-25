"""
Object storage abstraction (MinIO / S3).

Business code interacts only with these helpers; provider details
(endpoint, credentials) come from environment-driven settings so local
MinIO and production AWS S3 are interchangeable.
"""
import boto3
from botocore.client import Config

from django.conf import settings


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.AWS_S3_ENDPOINT_URL or None,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION_NAME,
        config=Config(signature_version="s3v4"),
    )


def generate_presigned_upload_url(key: str, content_type: str, expires_in: int = 3600) -> str:
    client = get_s3_client()
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.AWS_STORAGE_BUCKET_NAME,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )


def generate_presigned_upload_post(key: str, content_type: str, expires_in: int = 3600) -> dict:
    """
    Presigned POST with a server-enforced size cap. Unlike plain PUT
    presigns, the client cannot upload objects larger than
    MAX_UPLOAD_BYTES — protecting storage from oversized uploads before
    ingestion-time validation runs.
    """
    from apps.common.security.file_validation import MAX_UPLOAD_BYTES

    client = get_s3_client()
    return client.generate_presigned_post(
        Bucket=settings.AWS_STORAGE_BUCKET_NAME,
        Key=key,
        Fields={"Content-Type": content_type},
        Conditions=[
            {"Content-Type": content_type},
            ["content-length-range", 1, MAX_UPLOAD_BYTES],
        ],
        ExpiresIn=expires_in,
    )


def generate_presigned_download_url(key: str, expires_in: int = 3600) -> str:
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.AWS_STORAGE_BUCKET_NAME, "Key": key},
        ExpiresIn=expires_in,
    )


def delete_object(key: str) -> None:
    client = get_s3_client()
    client.delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
