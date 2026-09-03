# Complete REST API / CRUD Documentation

Base path:

`/api/v1/`

All protected endpoints require a valid access token unless explicitly marked public.

## Authentication

### POST `/auth/signup/`
Create a user and initiate email verification.

### POST `/auth/verify-email/`
Verify a signup verification code.

### POST `/auth/login/`
Authenticate and return access/refresh tokens.

### POST `/auth/token/refresh/`
Refresh access token.

### POST `/auth/logout/`
Invalidate/logout according to the chosen token strategy.

### POST `/auth/password-reset/request/`
Request a password reset email.

### POST `/auth/password-reset/confirm/`
Confirm password reset using a secure reset token/code.

### POST `/auth/password-change/`
Change password for an authenticated user.

### GET `/auth/me/`
Return authenticated user profile.

### PATCH `/auth/me/`
Update authenticated user profile.

## Tenants

- GET `/tenants/` — list authorized tenants
- POST `/tenants/` — create tenant
- GET `/tenants/{id}/` — retrieve
- PATCH `/tenants/{id}/` — partial update
- PUT `/tenants/{id}/` — full update where supported
- DELETE `/tenants/{id}/` — delete/deactivate according to lifecycle policy

## Faculties

- GET `/faculties/`
- POST `/faculties/`
- GET `/faculties/{id}/`
- PATCH `/faculties/{id}/`
- PUT `/faculties/{id}/`
- DELETE `/faculties/{id}/`

All queries are tenant-scoped.

## Departments

- GET `/departments/`
- POST `/departments/`
- GET `/departments/{id}/`
- PATCH `/departments/{id}/`
- PUT `/departments/{id}/`
- DELETE `/departments/{id}/`

## Programmes

- GET `/programmes/`
- POST `/programmes/`
- GET `/programmes/{id}/`
- PATCH `/programmes/{id}/`
- PUT `/programmes/{id}/`
- DELETE `/programmes/{id}/`

## Academic Sessions

- GET `/academic-sessions/`
- POST `/academic-sessions/`
- GET `/academic-sessions/{id}/`
- PATCH `/academic-sessions/{id}/`
- PUT `/academic-sessions/{id}/`
- DELETE `/academic-sessions/{id}/`

## Semesters

- GET `/semesters/`
- POST `/semesters/`
- GET `/semesters/{id}/`
- PATCH `/semesters/{id}/`
- PUT `/semesters/{id}/`
- DELETE `/semesters/{id}/`

## Courses

- GET `/courses/`
- POST `/courses/`
- GET `/courses/{id}/`
- PATCH `/courses/{id}/`
- PUT `/courses/{id}/`
- DELETE `/courses/{id}/`

## Course Offerings

- GET `/course-offerings/`
- POST `/course-offerings/`
- GET `/course-offerings/{id}/`
- PATCH `/course-offerings/{id}/`
- PUT `/course-offerings/{id}/`
- DELETE `/course-offerings/{id}/`

## Lecturer Assignments

- GET `/lecturer-assignments/`
- POST `/lecturer-assignments/`
- GET `/lecturer-assignments/{id}/`
- PATCH `/lecturer-assignments/{id}/`
- PUT `/lecturer-assignments/{id}/`
- DELETE `/lecturer-assignments/{id}/`

## Course Enrollments

- GET `/course-enrollments/`
- POST `/course-enrollments/`
- GET `/course-enrollments/{id}/`
- PATCH `/course-enrollments/{id}/`
- PUT `/course-enrollments/{id}/`
- DELETE `/course-enrollments/{id}/`

## Users

- GET `/users/`
- POST `/users/`
- GET `/users/{id}/`
- PATCH `/users/{id}/`
- PUT `/users/{id}/`
- DELETE `/users/{id}/`

Admin-only where appropriate.

## Resources

- GET `/resources/`
- POST `/resources/`
- GET `/resources/{id}/`
- PATCH `/resources/{id}/`
- PUT `/resources/{id}/`
- DELETE `/resources/{id}/`

Resource upload should use multipart/form-data where a binary file is supplied.

## Resource Versions

- GET `/resources/{resource_id}/versions/`
- POST `/resources/{resource_id}/versions/`
- GET `/resources/{resource_id}/versions/{id}/`
- DELETE `/resources/{resource_id}/versions/{id}/`

## Concepts

- GET `/concepts/`
- POST `/concepts/`
- GET `/concepts/{id}/`
- PATCH `/concepts/{id}/`
- PUT `/concepts/{id}/`
- DELETE `/concepts/{id}/`

## Concept Edges

- GET `/concept-edges/`
- POST `/concept-edges/`
- GET `/concept-edges/{id}/`
- PATCH `/concept-edges/{id}/`
- PUT `/concept-edges/{id}/`
- DELETE `/concept-edges/{id}/`

## Chat Sessions

- GET `/chat/sessions/`
- POST `/chat/sessions/`
- GET `/chat/sessions/{id}/`
- PATCH `/chat/sessions/{id}/`
- DELETE `/chat/sessions/{id}/`

## Chat Messages

- GET `/chat/sessions/{session_id}/messages/`
- POST `/chat/sessions/{session_id}/messages/`
- GET `/chat/messages/{id}/`

Message updates/deletes should normally be restricted because messages form an audit-like conversation history.

## Quizzes

- GET `/quizzes/`
- POST `/quizzes/`
- GET `/quizzes/{id}/`
- PATCH `/quizzes/{id}/`
- PUT `/quizzes/{id}/`
- DELETE `/quizzes/{id}/`

## Quiz Questions

- GET `/quizzes/{quiz_id}/questions/`
- POST `/quizzes/{quiz_id}/questions/`
- GET `/quiz-questions/{id}/`
- PATCH `/quiz-questions/{id}/`
- PUT `/quiz-questions/{id}/`
- DELETE `/quiz-questions/{id}/`

## Quiz Attempts

- GET `/quiz-attempts/`
- POST `/quiz-attempts/`
- GET `/quiz-attempts/{id}/`

Submission should be an explicit operation where possible rather than allowing arbitrary mutation of a completed attempt.

## Notes

- GET `/notes/`
- POST `/notes/`
- GET `/notes/{id}/`
- PATCH `/notes/{id}/`
- PUT `/notes/{id}/`
- DELETE `/notes/{id}/`

## Bookmarks

- GET `/bookmarks/`
- POST `/bookmarks/`
- GET `/bookmarks/{id}/`
- PATCH `/bookmarks/{id}/`
- PUT `/bookmarks/{id}/`
- DELETE `/bookmarks/{id}/`

## Progress

- GET `/progress/`
- POST `/progress/`
- GET `/progress/{id}/`
- PATCH `/progress/{id}/`
- PUT `/progress/{id}/`
- DELETE `/progress/{id}/`

## Audit Logs

- GET `/audit-logs/`

No normal update/delete endpoint should be exposed.

## API conventions

- JSON for normal API bodies
- ISO 8601 timestamps
- UUID identifiers
- pagination on collections
- filtering/search/order where documented
- consistent error envelope
- `401` unauthenticated
- `403` authenticated but unauthorized
- `404` resource unavailable or intentionally hidden
- `409` uniqueness/state conflict
- `422` semantic validation where used by the API contract
- `429` rate limited
- `5xx` server/provider failure
