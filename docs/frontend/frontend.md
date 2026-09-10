# Frontend Documentation

## Stack

- React
- Vite
- JavaScript
- Tailwind CSS
- shadcn/ui
- React Router
- TanStack Query
- Axios or a similarly isolated HTTP client
- Form validation library as selected during implementation

## Design system

shadcn/ui provides reusable accessible components while Tailwind CSS controls layout and utility styling.

The implementation should keep reusable primitives in a central UI area and feature-specific compositions in domain folders.

## Suggested structure

```text
src/
  app/
  components/
    ui/
    layout/
  features/
    auth/
    tenants/
    academics/
    resources/
    chat/
    quizzes/
    learning/
    admin/
  pages/
  routes/
  services/
  hooks/
  lib/
  utils/
```

## Routing

Protected routes must require authentication. Role-sensitive routes must additionally check authorization.

## Data fetching

TanStack Query should manage:
- server state
- caching
- invalidation
- loading/error states
- mutation lifecycle

Do not place server data unnecessarily into global UI state.

## API client

Centralize:
- base URL
- JWT handling
- refresh behavior
- request IDs if used
- standardized API errors

## Main screens

### Student
- Dashboard
- My Programme
- My Courses
- Course Details
- Resources
- AI Assistant
- Quiz
- Notes
- Bookmarks
- Progress
- Profile

### Lecturer
- Dashboard
- Assigned Courses
- Course Resources
- Upload Resource
- Quiz Management
- Profile

### Admin
- Dashboard
- Users
- Faculties
- Departments
- Programmes
- Courses
- Course Offerings
- Enrollments
- Audit Logs
- Tenant settings

## Accessibility

Use semantic HTML, keyboard-accessible controls, visible focus states, appropriate labels, sufficient contrast, and accessible dialogs/forms.

## Error handling

Every API mutation must provide:
- loading state
- success feedback
- validation feedback
- recoverable error message

Do not expose raw server stack traces to users.
