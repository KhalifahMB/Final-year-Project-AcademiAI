# Product Requirements Document (PRD)

## 1. Product

**Name:** AcademiAI

**Product type:** Multi-tenant AI-powered academic assistant and intelligent resource hub.

## 2. Problem

Academic resources are often fragmented across files, messaging platforms, websites, and conventional learning-management systems. Students need a trusted way to retrieve course-specific information while institutions need strong isolation, authorization, and administrative control.

## 3. Product goals

1. Provide institution-scoped academic resource management.
2. Provide grounded AI question answering using tenant-authorized resources.
3. Support course, programme, department, and faculty organization.
4. Provide concept-aware retrieval through a relational concept graph.
5. Support quizzes, notes, bookmarks, and learning-progress records.
6. Provide secure multi-tenancy using application authorization plus PostgreSQL RLS.
7. Provide auditable APIs and asynchronous document processing.

## 4. Non-goals

- Full mastery-based adaptive learning is not part of the initial implementation.
- Automated grading of high-stakes examinations is not a core requirement.
- Cross-tenant knowledge retrieval is prohibited.
- Production AWS provisioning is outside the documentation-only scope.

## 5. Roles

### Student
- View authorized courses and resources
- Ask grounded academic questions
- Generate/use quizzes
- Manage notes and bookmarks
- View personal learning progress

### Lecturer
- Manage assigned course resources
- View/manage course content
- Create or trigger learning materials where authorized
- Review course-level activity

### Admin
- Manage the tenant's institutional structure
- Manage users, courses, programmes, resources, and policies
- Review audit records

## 6. Institutional hierarchy

Tenant → Faculty → Department → Programme → Course → Course Offering.

Academic delivery is represented by Course Offering, which connects a course to an academic session and semester and provides the scope for lecturer assignment and student enrollment.

## 7. Functional requirements

### Identity
- Signup
- Email verification code
- Login
- Token refresh
- Logout/token invalidation strategy
- Password reset
- Password change
- User profile management

### Tenant and institution
- Tenant CRUD
- Faculty CRUD
- Department CRUD
- Programme CRUD
- Academic session CRUD
- Semester CRUD

### Courses
- Course CRUD
- Course offering CRUD
- Lecturer assignment CRUD
- Student enrollment CRUD

### Resources
- Upload resource
- List/detail/update/delete authorized resources
- Resource versioning
- Processing status
- Chunking and embeddings
- Resource visibility scopes

### AI assistant
- Chat session CRUD
- Chat message creation
- Hybrid retrieval
- Concept-aware reranking
- Source citations
- Tenant/course authorization before retrieval

### Assessment
- Quiz CRUD
- Question CRUD
- Quiz attempt creation/retrieval
- Results

### Personal learning
- Notes CRUD
- Bookmarks CRUD
- Progress records

### Administration
- Audit log viewing
- User management
- Tenant configuration

## 8. Resource visibility

Supported scopes:

- private
- course
- programme
- department
- faculty
- institution

Authorization must combine tenant membership with the resource's academic relationship and explicit permissions.

## 9. Non-functional requirements

### Security
- HTTPS in production
- JWT authentication
- Password hashing using Django's supported password hashing
- PostgreSQL RLS
- tenant-aware authorization
- object-level authorization
- secure object-storage URLs
- audit logging
- rate limiting at appropriate boundaries
- safe file validation and malware scanning

### Performance
- asynchronous document processing
- indexed tenant and foreign-key columns
- pgvector index for embeddings
- PostgreSQL full-text search
- Redis caching where safe
- pagination for collection endpoints

### Reliability
- idempotent background jobs where practical
- transaction boundaries around critical writes
- retry policy for external AI/email/storage calls
- observable job status

## 10. Acceptance principles

A feature is not complete until:
1. Its API contract is documented.
2. Its authorization behavior is defined.
3. Its tenant boundary is defined.
4. Its database constraints are defined.
5. Its error cases are defined.
6. Its tests are defined.
