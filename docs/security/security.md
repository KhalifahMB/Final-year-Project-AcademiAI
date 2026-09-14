# Security Documentation

## Security model

AcademiAI uses defense in depth:

JWT authentication
→ Django permissions
→ service-layer authorization
→ tenant-aware querysets
→ PostgreSQL RLS
→ tenant-aware cache/storage
→ audit logging.

## Authentication

- Passwords are hashed using Django's password hashing.
- Email verification is required.
- Access and refresh tokens must have controlled lifetimes.
- Password-reset tokens are short-lived and single-use.
- Sensitive authentication events are logged without secrets.

## Authorization

Authorization is contextual:
- role
- tenant
- user ownership
- faculty/department/programme membership
- course enrollment
- lecturer assignment
- explicit resource permission

## IDOR protection

Never trust an object ID supplied by the client. Retrieve objects through tenant-scoped querysets and authorization checks.

## File security

- validate MIME/type and size
- sanitize filenames
- store outside direct application filesystem exposure
- use tenant-scoped object keys
- malware scan before processing
- never execute uploaded files
- use signed URLs for private objects

## AI security

- treat retrieved/uploaded text as untrusted input
- mitigate prompt injection
- separate system instructions from retrieved content
- never allow retrieved text to override authorization
- do not expose hidden system prompts
- do not send unauthorized tenant content to the model

## Secrets

Store:
- database credentials
- JWT signing configuration
- Gemini API key
- S3 credentials
- email credentials

outside source control.

## Logging

Never log passwords, JWTs, verification codes, reset tokens, or private document bodies.

## Rate limiting

Apply appropriate limits to:
- login
- signup
- verification
- password reset
- AI chat
- resource upload

## Audit

Audit:
- authentication events
- role changes
- tenant structure changes
- resource creation/deletion
- permission changes
- sensitive administrative actions
