# AcademiAI — Role-Based Test Agents

## Overview

Automated test agents validate the complete frontend experience for each user role.
Each agent tests: authentication, dashboard, navigation, forms, AI features, and API endpoints.

## Roles

| Role | Test User | Focus Areas |
|------|-----------|-------------|
| **Student** | `TEST_STUDENT_EMAIL` | Signup, course enrollment, chat, quizzes, plans, progress |
| **Lecturer** | `TEST_LECTURER_EMAIL` | Course management, student analytics, materials, AI insights |
| **Tenant Admin** | `TEST_ADMIN_EMAIL` | Institution management, user admin, logs, structure |
| **Platform Admin** | `TEST_SUPERUSER_EMAIL` | Cross-tenant ops, system health, announcements |

## Setup

1. Ensure the backend is running (`python manage.py runserver`)
2. Set test user credentials in `.env`:
   ```
   TEST_STUDENT_EMAIL=student@example.com
   TEST_STUDENT_PASSWORD=...
   TEST_LECTURER_EMAIL=lecturer@example.com
   TEST_LECTURER_PASSWORD=...
   TEST_ADMIN_EMAIL=admin@example.com
   TEST_ADMIN_PASSWORD=...
   TEST_SUPERUSER_EMAIL=super@example.com
   TEST_SUPERUSER_PASSWORD=...
   ```

## Running Tests

```bash
# Test a single role
python manage.py test_roles --role student
python manage.py test_roles --role lecturer
python manage.py test_roles --role tenant_admin
python manage.py test_roles --role platform_admin

# Test all roles
python manage.py test_roles --all

# Custom base URL
python manage.py test_roles --role student --base-url http://localhost:8000

# Custom output file
python manage.py test_roles --all --output reports/test_report.json
```

## Test Report

The command outputs a JSON report with:
- `role`: The tested role
- `tests[]`: Array of test results with name, status (PASS/FAIL/SKIP), and detail
- `summary`: Aggregate counts

### Example Output

```json
{
  "role": "student",
  "tests": [
    {"name": "Login", "status": "PASS", "detail": "JWT token obtained"},
    {"name": "Dashboard endpoint", "status": "PASS", "detail": "HTTP 200"},
    {"name": "AI greeting", "status": "PASS", "detail": "HTTP 200"},
    {"name": "Create plan", "status": "PASS", "detail": "HTTP 201"}
  ],
  "summary": {"total": 14, "passed": 14, "failed": 0, "skipped": 0}
}
```

## Pages Tested Per Role

### Student
- Login / Signup / Email verification
- Dashboard (AI greeting, AI insight, KPIs, course cards, charts)
- Chat (create session, send message, streaming, sources, citations)
- My Courses / Course Detail
- Quizzes / Quiz Take
- Resources / Upload
- Notes / Bookmarks / Progress
- Plans (create, milestones, tasks)
- Profile / Settings
- AI Agent widget (floating)

### Lecturer
- Login
- Dashboard (AI greeting, AI insight, student attention, weak concepts)
- Assigned Courses / Course Detail
- Quiz Manager
- Resources / Upload
- Notes / Bookmarks
- Plans
- Profile / Settings

### Tenant Admin
- Login
- Dashboard (AI insight, stats, audit)
- User Management
- Structure (Faculty / Department / Course)
- Logs (TenantLog viewer)
- Quizzes Manager
- Resources
- Plans

### Platform Admin
- Login
- Platform Console (Tenants, Requests, Announcements)
- Analytics / System Health / Audit Log
- Dashboard
- All tenant admin capabilities

## API Endpoints Tested

| Endpoint | Method | All Roles |
|----------|--------|-----------|
| `/api/v1/auth/login/` | POST | Yes |
| `/api/v1/auth/me/` | GET | Yes |
| `/api/v1/dashboard/student/` | GET | Student |
| `/api/v1/dashboard/lecturer/` | GET | Lecturer |
| `/api/v1/dashboard/admin/` | GET | Admin |
| `/api/v1/dashboard/ai-greeting/` | GET | Yes |
| `/api/v1/dashboard/ai-insight/` | POST | Yes |
| `/api/v1/resources/` | GET | Yes |
| `/api/v1/chat/sessions/` | GET | Yes |
| `/api/v1/plans/` | GET/POST | Yes |
| `/api/v1/progress/` | GET | Yes |
| `/api/v1/notes/` | GET | Yes |
| `/api/v1/bookmarks/` | GET | Yes |
| `/api/v1/agent/tools/` | GET | Yes |
| `/api/v1/logs/` | GET | Admin only |
