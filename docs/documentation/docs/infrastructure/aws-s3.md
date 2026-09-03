# AWS S3 Production Storage

## Local vs production

Local:
`MinIO`

Production:
`AWS S3`

The application should use an S3-compatible storage abstraction.

## Object-key convention

Recommended:

`tenants/{tenant_id}/resources/{resource_id}/versions/{version_id}/{safe_filename}`

This provides an explicit tenant boundary in storage.

## Security

- private buckets
- block public access
- IAM least privilege
- server-side encryption
- signed URLs for authorized downloads
- lifecycle rules where appropriate
- no AWS credentials in source code

## Upload

Prefer controlled upload flows. For large files, presigned multipart upload can be introduced later.

## Production configuration

Production requires cloud-specific setup of:
- S3 bucket
- IAM role/user
- region
- encryption
- lifecycle policy
- CORS where necessary
- monitoring
