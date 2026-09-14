# Email Services Documentation

## Purpose

AcademiAI requires transactional email for account security and lifecycle communication.

## Required email flows

1. Signup email verification code
2. Welcome email after successful verification
3. Password reset request
4. Password reset confirmation
5. Password changed notification
6. Optional email-change verification
7. Optional security notification for suspicious authentication events

## Provider abstraction

The backend should expose an email service abstraction rather than coupling business logic directly to one provider.

Example conceptual interface:

```text
send_verification_code(user, code)
send_welcome_email(user)
send_password_reset(user, reset_url)
send_password_changed_notification(user)
```

The concrete provider can be selected through environment configuration.

## Verification flow

```text
Signup
  ↓
Create unverified user
  ↓
Generate short-lived verification code
  ↓
Store hashed code + expiry + attempt metadata
  ↓
Send verification email
  ↓
User submits code
  ↓
Verify
  ↓
Mark email verified
  ↓
Send welcome email
```

Never store plaintext verification codes if avoidable.

## Verification controls

- short expiration
- limited attempts
- resend cooldown
- rate limiting
- invalidate previous code when a new one is issued
- generic responses to reduce account enumeration risk

## Password reset

```text
Request reset
  ↓
Always return generic response
  ↓
Create short-lived single-use reset token
  ↓
Send reset email
  ↓
User opens reset link
  ↓
Submit new password
  ↓
Invalidate token
  ↓
Optionally revoke existing sessions
  ↓
Send password-changed notification
```

Do not reveal whether an email address exists.

## Email templates

Templates should be branded consistently and support:
- HTML
- plain text fallback
- product name
- support contact
- security guidance
- expiration information

## Email delivery

Email sending should normally occur asynchronously through Celery so signup/password operations are not unnecessarily blocked by an external SMTP/API call.

## Email logging

Log:
- message type
- user/tenant ID
- provider response status
- task ID
- failure category

Never log:
- verification codes
- password-reset tokens
- complete private email content

## Configuration

Environment variables should hold:
- provider
- sender name
- sender address
- API/SMTP credentials
- frontend URL
- verification expiry
- reset expiry

Credentials must never be committed to source control.
