# Threat Model

## Assets

- user credentials
- JWT/session credentials
- tenant data
- academic resources
- embeddings
- chat history
- audit records
- object storage
- API keys

## Threats

- cross-tenant data leakage
- IDOR
- privilege escalation
- credential theft
- brute-force authentication
- malicious file upload
- prompt injection
- unauthorized retrieval
- cache poisoning/leakage
- signed URL misuse
- secret leakage
- email-account enumeration
- replay of verification/reset tokens

## Primary controls

- JWT
- RBAC + object/relationship authorization
- PostgreSQL RLS
- tenant-scoped querysets
- composite tenant constraints
- private object storage
- signed URLs
- malware scanning
- rate limits
- short-lived single-use security tokens
- structured logging without secrets
- security-focused tests
