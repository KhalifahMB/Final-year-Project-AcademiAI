/**
 * API response contracts (Zod) — mirror of the DRF serializer shapes.
 *
 * These make the API boundary type-safe without TypeScript: every schema is
 * `.passthrough()` (additive backend fields never fail), and
 * `enforceContract` throws in dev (fast feedback on contract drift) while
 * failing open with a console warning in production (no outage from a
 * changed field). Only the fields the UI actually reads are validated as
 * present; everything else is tolerant.
 */
import { z } from 'zod';

/**
 * Validate `data` against `schema`. Returns the ORIGINAL reference (no
 * cloning, so hot paths like SSE tokens keep zero allocation overhead).
 * On mismatch: throws in dev, warns-and-passes in prod.
 */
export function enforceContract(schema, data, label = 'api') {
  const result = schema.safeParse(data);
  if (result.success) return data;
  const issues = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ');
  const message = `API contract mismatch — ${label}: ${issues}`;
  if (import.meta.env.DEV) {
    console.error(`[contract] ${message}`, data);
    throw new Error(message);
  }
  console.warn(`[contract] ${message}`);
  return data;
}

/** DRF serializer-level helpers. */
const idField = z.union([z.string(), z.number()]);

// --- accounts.authentication -------------------------------------------------

/** GET /auth/me/ — UserSerializer. */
export const userContract = z
  .object({
    id: idField,
    email: z.string(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    full_name: z.string().nullable().optional(),
    role: z.string(),
    is_active: z.boolean().optional(),
    is_email_verified: z.boolean().optional(),
    is_superuser: z.boolean().optional(),
    tenant: idField.nullable().optional(),
    tenant_detail: z.unknown().nullable().optional(),
    programme_id: idField.nullable().optional(),
    department_id: idField.nullable().optional(),
    department_name: z.string().nullable().optional(),
    phone_number: z.string().nullable().optional(),
    gender: z.string().nullable().optional(),
    avatar_preset: z.string().nullable().optional(),
    has_custom_avatar: z.boolean().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

/** POST /auth/login/ — AuthTokenResponseSerializer. */
export const tokenResponseContract = z
  .object({
    success: z.boolean().optional(),
    access: z.string(),
    refresh: z.string(),
    user: userContract,
  })
  .passthrough();

/** POST /auth/signup/ — MessageResponseSerializer variant with user:null. */
export const signupResponseContract = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    user: z.unknown().nullable().optional(),
  })
  .passthrough();

// --- chat -------------------------------------------------------------------

/** ChatMessageSourceSerializer. */
export const chatMessageSourceContract = z
  .object({
    id: idField,
    chunk: idField.nullable().optional(),
    rank: z.number().optional(),
    similarity_score: z.number().nullable().optional(),
    retrieval_method: z.string().nullable().optional(),
    resource_id: z.string().nullable().optional(),
    resource_title: z.string().nullable().optional(),
    version_number: z.union([z.number(), z.string()]).nullable().optional(),
    chunk_text: z.string().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

/** ChatMessageSerializer. */
export const chatMessageContract = z
  .object({
    id: idField,
    session: idField,
    role: z.string(),
    content: z.string().nullable().optional(),
    content_type: z.string().nullable().optional(),
    confidence: z.number().nullable().optional(),
    rating: z.number().nullable().optional(),
    sources: z.array(chatMessageSourceContract).optional(),
    created_at: z.string(),
  })
  .passthrough();

/** ChatSessionSerializer. */
export const chatSessionContract = z
  .object({
    id: idField,
    title: z.string().nullable().optional(),
    course_offering: idField.nullable().optional(),
    user: idField,
    tenant: idField,
    message_count: z.number().int().optional(),
    last_message_at: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const sessionListContract = z.array(chatSessionContract);
export const messageListContract = z.array(chatMessageContract);

// --- chat SSE stream events (POST /chat/sessions/{id}/messages/stream/) ------

export const chatTokenEventContract = z
  .object({ text: z.string() })
  .passthrough();

export const chatDoneEventContract = z
  .object({ assistant_message: chatMessageContract })
  .passthrough();

// --- agent SSE stream events (POST /agent/stream/) ---------------------------

export const agentTokenEventContract = z.union([
  z.string(),
  z.record(z.string(), z.unknown()),
]);

export const agentErrorEventContract = z
  .object({ message: z.string().optional() })
  .passthrough();

// --- learning.notes ----------------------------------------------------------

/** NoteSerializer. */
export const noteContract = z
  .object({
    id: idField,
    title: z.string().nullable().optional(),
    content: z.string().nullable().optional(),
    resource: idField.nullable().optional(),
    user: idField.optional(),
    tenant: idField.optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const noteListContract = z.array(noteContract);

// --- resources (used by pages that call api directly) ------------------------

/** ResourceSerializer (read representation, tolerant — add fields freely). */
export const resourceContract = z
  .object({
    id: idField,
    title: z.string(),
    description: z.string().nullable().optional(),
    mime_type: z.string().nullable().optional(),
    processing_status: z.string().nullable().optional(),
    visibility_scope: z.string().nullable().optional(),
  })
  .passthrough();

export const resourceListContract = z.array(resourceContract);

/** DRF paginated envelope -> array of `itemSchema`. */
export function paginatedContract(itemSchema) {
  return z
    .object({
      count: z.number().optional(),
      next: z.string().nullable().optional(),
      previous: z.string().nullable().optional(),
      results: z.array(itemSchema),
    })
    .passthrough();
}