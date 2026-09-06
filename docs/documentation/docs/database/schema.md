# Database Schema

This is the authoritative conceptual schema for the project.

## 1. Tenant

`tenants`
- id UUID PK
- name
- slug UNIQUE
- domain nullable
- status
- plan
- storage_quota_bytes
- created_at
- updated_at

## 2. Institutional hierarchy

`faculties`
- id UUID PK
- tenant_id FK
- name
- code
- created_at
- updated_at
- UNIQUE(tenant_id, code)

`departments`
- id UUID PK
- tenant_id FK
- faculty_id FK
- name
- code
- UNIQUE(tenant_id, code)

`programmes`
- id UUID PK
- tenant_id FK
- department_id FK
- name
- code
- degree_type
- duration_years
- UNIQUE(tenant_id, code)

## 3. Academic calendar

`academic_sessions`
- id UUID PK
- tenant_id FK
- name
- start_date
- end_date
- is_current

`semesters`
- id UUID PK
- tenant_id FK
- academic_session_id FK
- name
- start_date
- end_date
- UNIQUE(academic_session_id, name)

## 4. Users

`users`
- id UUID PK
- tenant_id FK nullable only for platform-level identity if later required
- email UNIQUE within tenant policy
- password_hash
- role: student | lecturer | admin
- is_active
- is_email_verified
- created_at
- updated_at

`student_profiles`
- user_id PK/FK
- tenant_id FK
- programme_id FK
- matric_number
- level

`lecturer_profiles`
- user_id PK/FK
- tenant_id FK
- department_id FK
- staff_number

## 5. Courses

`courses`
- id UUID PK
- tenant_id FK
- department_id FK
- code
- title
- description
- credit_unit
- status
- UNIQUE(tenant_id, code)

`curriculum_courses`
- programme_id FK
- course_id FK
- level
- semester
- is_core
- PRIMARY KEY(programme_id, course_id)

`course_offerings`
- id UUID PK
- tenant_id FK
- course_id FK
- academic_session_id FK
- semester_id FK
- status
- UNIQUE(course_id, academic_session_id, semester_id)

`lecturer_course_assignments`
- id UUID PK
- tenant_id FK
- course_offering_id FK
- lecturer_id FK
- assignment_role
- UNIQUE(course_offering_id, lecturer_id)

`course_enrollments`
- id UUID PK
- tenant_id FK
- course_offering_id FK
- student_id FK
- status
- enrolled_at
- UNIQUE(course_offering_id, student_id)

## 6. Resources

`resources`
- id UUID PK
- tenant_id FK
- course_offering_id nullable FK
- programme_id nullable FK
- department_id nullable FK
- faculty_id nullable FK
- uploaded_by FK
- title
- description
- visibility_scope
- mime_type
- storage_key
- processing_status
- created_at
- updated_at

`resource_versions`
- id UUID PK
- tenant_id FK
- resource_id FK
- version_number
- storage_key
- checksum
- created_by
- created_at
- UNIQUE(resource_id, version_number)

`resource_chunks`
- id UUID PK
- tenant_id FK
- resource_version_id FK
- chunk_index
- content
- embedding vector
- token_count
- metadata JSONB

## 7. Knowledge graph

`concepts`
- id UUID PK
- tenant_id FK
- canonical_name
- description
- created_at
- UNIQUE(tenant_id, canonical_name)

`resource_concepts`
- resource_id FK
- concept_id FK
- confidence
- source_chunk_id FK nullable
- PRIMARY KEY(resource_id, concept_id)

`concept_edges`
- id UUID PK
- tenant_id FK
- source_concept_id FK
- target_concept_id FK
- relation_type
- weight
- UNIQUE(source_concept_id, target_concept_id, relation_type)

## 8. Chat

`chat_sessions`
- id UUID PK
- tenant_id FK
- user_id FK
- title
- created_at
- updated_at

`chat_messages`
- id UUID PK
- tenant_id FK
- session_id FK
- role
- content
- created_at

`chat_message_sources`
- id UUID PK
- tenant_id FK
- message_id FK
- chunk_id FK
- rank
- similarity_score nullable
- retrieval_method
- created_at

## 9. Assessments

`quizzes`
- id UUID PK
- tenant_id FK
- course_offering_id nullable
- created_by FK
- title
- description
- status
- created_at

`quiz_questions`
- id UUID PK
- tenant_id FK
- quiz_id FK
- question_text
- question_type
- options JSONB
- correct_answer JSONB
- explanation
- order_index

`quiz_attempts`
- id UUID PK
- tenant_id FK
- quiz_id FK
- student_id FK
- score
- started_at
- submitted_at

## 10. Personal learning

`notes`
- id UUID PK
- tenant_id FK
- user_id FK
- resource_id nullable FK
- title
- content
- created_at
- updated_at

`bookmarks`
- id UUID PK
- tenant_id FK
- user_id FK
- resource_id FK
- created_at
- UNIQUE(user_id, resource_id)

`progress_records`
- id UUID PK
- tenant_id FK
- user_id FK
- concept_id FK
- progress_value
- last_seen_at
- UNIQUE(user_id, concept_id)

## 11. Security/audit

`resource_permissions`
- id UUID PK
- tenant_id FK
- resource_id FK
- user_id nullable FK
- role nullable
- course_offering_id nullable FK
- permission
- created_at

Avoid a polymorphic `principal_id` UUID for users/roles/courses. Explicit foreign keys provide stronger integrity.

`audit_logs`
- id UUID PK
- tenant_id FK
- actor_id FK
- action
- entity_type
- entity_id
- metadata JSONB
- created_at

Audit records should be append-only from the application's normal database role.

## 12. Cross-tenant integrity

Where relationships connect two tenant-scoped records, use composite uniqueness/foreign-key techniques where practical so that the database can enforce matching tenant IDs.

## 13. pgvector

Resource chunks store embeddings in PostgreSQL using pgvector. The embedding dimension must be fixed to the selected embedding model and documented in the deployment configuration.

Use an appropriate vector index after dataset size and query patterns are established.

## 14. Indexing

At minimum index:
- tenant_id
- foreign keys
- `(tenant_id, code)` for institutional codes
- course offering lookup fields
- enrollment `(student_id, course_offering_id)`
- resource visibility/filter fields
- resource processing status
- timestamps used for sorting
- vector embeddings
- PostgreSQL full-text search representation

## 15. RLS

Tenant-scoped tables must:
1. enable RLS;
2. use tenant-aware policies;
3. avoid database roles that bypass RLS;
4. use FORCE ROW LEVEL SECURITY where required by the security model;
5. receive tenant context from a trusted authenticated application path.
