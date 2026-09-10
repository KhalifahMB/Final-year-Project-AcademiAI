/**
 * Centralized API client with JWT handling.
 */
import axios from 'axios';

import { PAGINATION, SSE_MAX_BUFFER_BYTES, BULK_DELETE_MAX_IDS } from '@/lib/constants';
import { clearSessionFlag } from '@/lib/session';
import {
  enforceContract,
  tokenResponseContract,
  signupResponseContract,
  userContract,
  sessionListContract,
  messageListContract,
  chatSessionContract,
  chatTokenEventContract,
  chatDoneEventContract,
  agentTokenEventContract,
  agentErrorEventContract,
  noteListContract,
} from '@/services/contracts';

// In dev, use relative /api/v1 so Vite proxy handles CORS.
// In prod, VITE_API_BASE_URL should be the full backend URL.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// No default Content-Type: axios v1 sets it per-payload type (JSON for plain
// objects, multipart/form-data with boundary for FormData), so uploads don't
// need the old `{ 'Content-Type': undefined }` override hack.
// JWT auth travels in HttpOnly SameSite=Strict cookies, so we must send and
// accept credentials on every request (no JS-accessible tokens exist).
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// --- Refresh-token mutex ---
// Only one refresh request is in flight at a time. Concurrent 401s queue
// behind the same promise and all replay once it resolves. Without this, N
// simultaneous 401s each fire independent refresh requests; the first rotates
// the refresh cookie and the rest fail, kicking the user to /login mid-session.
let refreshPromise = null;

function doRefresh() {
  return api
    .post('/auth/token/refresh/')
    .then(() => true)
    .catch((err) => {
      clearSessionFlag();
      window.location.href = '/login';
      throw err;
    });
}

/**
 * apiFetch: raw `fetch` with the same auth semantics as the axios
 * interceptor. SSE streaming needs raw fetch (axios buffers whole responses),
 * so this wrapper sends the auth cookies (`credentials: 'include'`) and on a
 * 401 performs a single-flight refresh (piggybacking on an in-flight one)
 * then retries exactly once. On refresh failure it throws a uniform
 * "Session expired" error (doRefresh has already cleared the session flag and
 * redirected to /login).
 */
async function apiFetch(path, options = {}) {
  const run = () =>
    fetch(`${api.defaults.baseURL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  let res = await run();
  if (res.status === 401) {
    await doRefresh().catch(() => {
      throw new Error('Session expired. Please log in again.');
    });
    res = await run();
  }
  return res;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      // If a refresh is already in flight, piggyback on it.
      if (!refreshPromise) {
        refreshPromise = doRefresh().finally(() => {
          refreshPromise = null;
        });
      }

      try {
        await refreshPromise;
        return api(original);
      } catch {
        // doRefresh already cleared the session flag and redirected.
      }
    }
    return Promise.reject(error);
  },
);

// Maximum SSE accumulator size (bytes). If a stream grows past this without
// a complete event delimiter (\n\n), the connection is aborted — otherwise a
// slow consumer + runaway stream would balloon memory without limit.
export const MAX_SSE_BUFFER = SSE_MAX_BUFFER_BYTES;
const SSE_OVERFLOW = 'SSE stream buffer overflow';

/**
 * Shared SSE reader over raw `fetch`. Handles everything both streaming
 * endpoints need: auth header + single-flight 401 refresh (via apiFetch),
 * buffering with overflow protection, chunk accumulation, and `\n\n`
 * event framing + JSON parse. Event-specific processing stays in the
 * caller's `onEvent(type, data)` dispatch — return `false` from it to stop
 * reading (e.g. after a `done` event).
 */
async function createSSEStream(path, { method = 'POST', body, signal }, onEvent) {
  const res = await apiFetch(path, { method, body, signal });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    if (buf.length > SSE_MAX_BUFFER_BYTES) {
      throw new Error(SSE_OVERFLOW);
    }
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event = 'message';
      let data = '';
      for (const line of raw.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      if (!data) continue;
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        throw new Error('Malformed SSE chunk received.');
      }
      if (onEvent(event, parsed) === false) return;
    }
  }
}

export default api;

export const authApi = {
  signup: (payload) =>
    api.post('/auth/signup/', payload).then((r) =>
      enforceContract(signupResponseContract, r.data, 'auth.signup'),
    ),
  login: (payload) =>
    api.post('/auth/login/', payload).then((r) =>
      enforceContract(tokenResponseContract, r.data, 'auth.login'),
    ),
  verifyEmail: (payload) => api.post('/auth/verify-email/', payload),
  resendVerification: (payload) =>
    api.post('/auth/resend-verification/', payload),
  me: () =>
    api.get('/auth/me/').then((r) =>
      enforceContract(userContract, r.data, 'auth.me'),
    ),
  updateMe: (payload) =>
    api.patch('/auth/me/', payload).then((r) =>
      enforceContract(userContract, r.data, 'auth.updateMe'),
    ),
  logout: () => api.post('/auth/logout/'),
  passwordResetRequest: (payload) =>
    api.post('/auth/password-reset/request/', payload),
  passwordResetConfirm: (payload) =>
    api.post('/auth/password-reset/confirm/', payload),
  passwordChange: (payload) => api.post('/auth/password-change/', payload),
};

/** Public, unauthenticated endpoints — no JWT attached, no refresh
 * interceptor, no redirect. Must render for visitors on the landing page. */
const PUBLIC_API_BASE = import.meta.env.VITE_PUBLIC_API_BASE_URL || '/api';

export const publicApi = {
  /** Landing statistics, server-side cached for exactly 1 hour
   * (GET /api/public/stats/). */
  getStats: async () => {
    const res = await fetch(`${PUBLIC_API_BASE}/public/stats/`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Public stats request failed (${res.status})`);
    return res.json();
  },
};

/** Dashboard counters — DEPRECATED in favour of aggregate endpoints below. */
const toList = (res) => {
  const data = res.data;
  return Array.isArray(data) ? data : data?.results || [];
};

/** Aggregate dashboard endpoints — one round-trip per role. */
export const dashboardApi = {
  student: () => api.get('/dashboard/student/').then((r) => r.data),
  admin: () => api.get('/dashboard/admin/').then((r) => r.data),
  lecturer: () => api.get('/dashboard/lecturer/').then((r) => r.data),
  studentActivity: (range = 'day') =>
    api
      .get('/dashboard/student/activity/', { params: { range } })
      .then((r) => r.data),
  adminAuditSummary: (days = 14) =>
    api
      .get('/dashboard/admin/audit-summary/', { params: { days } })
      .then((r) => r.data),
  aiGreeting: () => api.get('/dashboard/ai-greeting/').then((r) => r.data),
  aiInsight: (dashboardType) =>
    api
      .post('/dashboard/ai-insight/', { dashboard_type: dashboardType })
      .then((r) => r.data),
};

export const notesApi = {
  list: () =>
    api.get('/notes/').then(toList).then((list) =>
      enforceContract(noteListContract, list, 'notes.list'),
    ),
  create: (payload) => api.post('/notes/', payload),
  update: (id, payload) => api.patch(`/notes/${id}/`, payload),
  delete: (id) => api.delete(`/notes/${id}/`),
  /**
   * Delete notes in a single round-trip (POST /notes/bulk-delete/).
   * Chunks over BULK_DELETE_MAX_IDS so payloads stay within server limits —
   * each chunk is still one request (never N-per-item).
   */
  bulkDelete: (ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    const chunks = [];
    for (let i = 0; i < list.length; i += BULK_DELETE_MAX_IDS) {
      chunks.push(list.slice(i, i + BULK_DELETE_MAX_IDS));
    }
    return Promise.all(
      chunks.map((chunk) => api.post('/notes/bulk-delete/', { ids: chunk })),
    );
  },
};

/** Course tooling — per-offering analytics + content intelligence for
 * lecturers/admins (GET /course-offerings/{id}/analytics/ and
 * /course-offerings/{id}/content-intelligence/). */
export const courseApi = {
  analytics: (offeringId) =>
    api.get(`/course-offerings/${offeringId}/analytics/`).then((r) => r.data),
  contentIntelligence: (offeringId) =>
    api
      .get(`/course-offerings/${offeringId}/content-intelligence/`)
      .then((r) => r.data),
};

export const platformApi = {
  stats: () => api.get('/platform/stats/'),
  tenantDetail: (id) => api.get(`/platform/tenants/${id}/`),
  health: () => api.get('/platform/health/'),
  auditLogs: (params) => api.get('/platform/audit-logs/', { params }),
  tenants: {
    list: (params) => api.get('/tenants/', { params }),
    update: (id, payload) => api.patch(`/tenants/${id}/`, payload),
  },
  tenantRequests: {
    list: (params) => api.get('/platform/tenant-requests/', { params }),
    create: (payload) => api.post('/tenant-requests/', payload),
    checkEmail: (payload) => api.post('/tenant-requests/check-email/', payload),
    review: (id, payload) =>
      api.post(`/platform/tenant-requests/${id}/review/`, payload),
  },
  announcements: {
    list: () => api.get('/announcements/'),
    create: (payload) => api.post('/announcements/', payload),
    update: (id, payload) => api.patch(`/announcements/${id}/`, payload),
    delete: (id) => api.delete(`/announcements/${id}/`),
  },
  announcementSubscriptions: {
    get: () => api.get('/announcements/subscriptions/'),
    update: (payload) => api.put('/announcements/subscriptions/', payload),
  },
};

/** Tenant log analyzer (tenant_admin only) — /api/v1/logs/ */
export const logsApi = {
  list: (params) => api.get('/logs/', { params }).then((r) => r.data),
  analyze: (params) => api.get('/logs/analyze/', { params }).then((r) => r.data),
};

/** Chat session helpers — streaming send + rename/delete. */
export const chatApi = {
  listSessions: ({ pageSize = PAGINATION.CHAT_SESSIONS_PAGE_SIZE } = {}) =>
    api
      .get('/chat/sessions/', { params: { page_size: pageSize } })
      .then((r) => r.data.results || r.data || [])
      .then((list) => enforceContract(sessionListContract, list, 'chat.sessions')),
  /** Read message history. Pass `before` (ISO created_at) to page backwards. */
  getMessages: (
    sessionId,
    { pageSize = PAGINATION.CHAT_MESSAGES_PAGE_SIZE, before } = {},
  ) =>
    api
      .get(`/chat/messages/?session=${sessionId}`, {
        params: { page_size: pageSize, before },
      })
      .then((r) => r.data.results || r.data || [])
      .then((list) => enforceContract(messageListContract, list, 'chat.messages')),
  createSession: (payload = {}) =>
    api.post('/chat/sessions/', payload).then((r) =>
      enforceContract(chatSessionContract, r.data, 'chat.createSession'),
    ),
  renameSession: (id, title) =>
    api.patch(`/chat/sessions/${id}/rename/`, { title }),
  deleteSession: (id) => api.delete(`/chat/sessions/${id}/`),
  rateMessage: (id, rating) =>
    api.post(`/chat/messages/${id}/rate/`, { rating }),
  send: (sessionId, content, resourceIds = []) =>
    api.post(`/chat/sessions/${sessionId}/messages/`, {
      content,
      resource_ids: resourceIds,
    }),
  /**
   * Upload a file from disk for use as a chat attachment. Returns the
   * created (private) resource.
   */
  uploadAttachment: (file, sessionId = null) => {
    const form = new FormData();
    form.append('file', file);
    if (sessionId) form.append('session_id', sessionId);
    return api.post('/chat/upload/', form).then((r) => r.data);
  },
  /**
   * Stream an assistant response as SSE.
   * onToken(text) — called for every token chunk
   * onDone(assistantMessage) — called on final event
   * onMeta(meta) — called once with retrieval/model info
   * onError(err) — called on error
   * Returns an AbortController so the caller can cancel.
   */
  stream: (
    sessionId,
    content,
    { onToken, onDone, onMeta, onError, resourceIds = [] },
  ) => {
    const ctrl = new AbortController();
    (async () => {
      try {
        await createSSEStream(
          `/chat/sessions/${sessionId}/messages/stream/`,
          { body: JSON.stringify({ content, resource_ids: resourceIds }), signal: ctrl.signal },
          (event, parsed) => {
            if (event === 'token') {
              enforceContract(chatTokenEventContract, parsed, 'chat.stream.token');
              if (onToken) onToken(parsed.text || '');
            } else if (event === 'user_message') {
              if (onMeta) onMeta({ user_message: parsed });
            } else if (event === 'meta') {
              if (onMeta) onMeta(parsed);
            } else if (event === 'done') {
              enforceContract(chatDoneEventContract, parsed, 'chat.stream.done');
              if (onDone) onDone(parsed.assistant_message);
              return false;
            }
            return undefined;
          },
        );
      } catch (err) {
        if (err.name === 'AbortError') return;
        if (onError) onError(err);
      }
    })();
    return ctrl;
  },
};

export const plansApi = {
  list: (params) => api.get('/plans/', { params }).then((r) => r.data),
  get: (id) => api.get(`/plans/${id}/`).then((r) => r.data),
  create: (data) => api.post('/plans/', data).then((r) => r.data),
  update: (id, data) => api.patch(`/plans/${id}/`, data).then((r) => r.data),
  delete: (id) => api.delete(`/plans/${id}/`),
  listTemplates: () => api.get('/plan-templates/').then((r) => r.data),
  getTemplate: (id) => api.get(`/plan-templates/${id}/`).then((r) => r.data),
  createTemplate: (data) => api.post('/plan-templates/', data).then((r) => r.data),
  updateTemplate: (id, data) => api.patch(`/plan-templates/${id}/`, data).then((r) => r.data),
  deleteTemplate: (id) => api.delete(`/plan-templates/${id}/`),
  instantiateTemplate: (id, payload = {}) =>
    api.post(`/plan-templates/${id}/instantiate/`, payload).then((r) => r.data),
  // Milestones
  createMilestone: (data) =>
    api.post('/plan-milestones/', data).then((r) => r.data),
  updateMilestone: (id, data) =>
    api.patch(`/plan-milestones/${id}/`, data).then((r) => r.data),
  deleteMilestone: (id) => api.delete(`/plan-milestones/${id}/`),
  // Tasks
  createTask: (data) => api.post('/plan-tasks/', data).then((r) => r.data),
  updateTask: (id, data) =>
    api.patch(`/plan-tasks/${id}/`, data).then((r) => r.data),
  completeTask: (id) =>
    api.post(`/plan-tasks/${id}/complete/`).then((r) => r.data),
  deleteTask: (id) => api.delete(`/plan-tasks/${id}/`),
};

export const readingApi = {
  getPosition: (resourceId) =>
    api.get(`/reading-positions/?resource=${resourceId}`).then((r) => {
      const results = r.data.results || r.data;
      return Array.isArray(results) && results.length > 0 ? results[0] : null;
    }),
  savePosition: (resourceId, data) =>
    api
      .post('/reading-positions/', { resource: resourceId, ...data })
      .then((r) => r.data),
  updatePosition: (id, data) =>
    api.patch(`/reading-positions/${id}/`, data).then((r) => r.data),
};

/** Notifications feed — sync-on-read alerts surfaced as a badge + toasts. */
export const notificationsApi = {
  list: () => api.get('/notifications/').then((r) => r.data),
  unreadCount: () => api.get('/notifications/unread-count/').then((r) => r.data),
  markRead: (id) => api.post(`/notifications/${id}/read/`).then((r) => r.data),
  markAllRead: () => api.post('/notifications/read-all/').then((r) => r.data),
  preferences: () => api.get('/notifications/preferences/').then((r) => r.data),
  setPreference: (kind, enabled) =>
    api.patch('/notifications/preferences/', { kind, enabled }).then((r) => r.data),
};

/** Calendar — layered, role-aware events + ICS export + timetable schedules. */
export const calendarApi = {
  listEvents: (params = {}) =>
    api.get('/calendar/events/', { params }).then((r) => r.data),
  listEventsLight: (params = {}) =>
    api.get('/calendar/events/', { params: { ...params, light: true } }).then((r) => r.data),
  getEvent: (id) => api.get(`/calendar/events/${id}/`).then((r) => r.data),
  createEvent: (payload) => api.post('/calendar/events/', payload).then((r) => r.data),
  updateEvent: (id, payload) =>
    api.patch(`/calendar/events/${id}/`, payload).then((r) => r.data),
  deleteEvent: (id) => api.delete(`/calendar/events/${id}/`),
  upcoming: (limit = 10) =>
    api.get('/calendar/events/upcoming/', { params: { limit } }).then((r) => r.data),
  exportIcs: (params = {}) =>
    api.get('/calendar/events/export/', { params, responseType: 'blob' }).then((r) => r.data),
  listSchedules: (params = {}) =>
    api.get('/calendar/schedules/', { params }).then((r) => r.data),
  createSchedule: (payload) =>
    api.post('/calendar/schedules/', payload).then((r) => r.data),
  getSchedule: (id) => api.get(`/calendar/schedules/${id}/`).then((r) => r.data),
  deleteSchedule: (id) => api.delete(`/calendar/schedules/${id}/`),
  layers: () => api.get('/calendar/events/layers/').then((r) => r.data),
  scheduleTemplate: () =>
    api
      .get('/calendar/schedules/template/', { responseType: 'blob' })
      .then((r) => r.data),
  previewSchedule: (file, { sourceFormat = 'csv', importType = 'lecture' } = {}) => {
    const form = new FormData();
    form.append('file', file);
    form.append('source_format', sourceFormat);
    form.append('import_type', importType);
    return api
      .post('/calendar/schedules/preview/', form)
      .then((r) => r.data);
  },
  commitSchedule: (file, { title, importType = 'lecture', sourceFormat = 'csv' } = {}) => {
    const form = new FormData();
    form.append('file', file);
    form.append('title', title || '');
    form.append('import_type', importType);
    form.append('source_format', sourceFormat);
    return api
      .post('/calendar/schedules/preview-commit/', form)
      .then((r) => r.data);
  },
};

/**
 * Agent subsystem (apps.agent) — identity manifest, settings, sessions and
 * the raw SSE streaming endpoint. `stream` returns an abort controller.
 */
export const agentApi = {
  identities: () => api.get('/agent/identities/').then((r) => r.data),
  getSettings: () => api.get('/agent/settings/').then((r) => r.data),
  updateSettings: (payload) =>
    api.put('/agent/settings/', payload).then((r) => r.data),
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/agent/avatar/', form).then((r) => r.data);
  },
  listSessions: () => api.get('/agent/sessions/').then((r) => r.data),
  getSession: (id) => api.get(`/agent/sessions/${id}/`).then((r) => r.data),
  createSession: (payload = {}) =>
    api.post('/agent/sessions/', payload).then((r) => r.data),
  renameSession: (id, title) =>
    api.patch(`/agent/sessions/${id}/`, { title }).then((r) => r.data),
  deleteSession: (id) => api.delete(`/agent/sessions/${id}/`),
  stream: ({ message, contextType = 'dashboard', sessionId, agent, title }, callbacks = {}) => {
    const { onToken, onToolCall, onToolResult, onDone, onError } = callbacks;
    const ctrl = new AbortController();
    const body = JSON.stringify({ message, context_type: contextType, session_id: sessionId, agent, title });
    (async () => {
      try {
        await createSSEStream(
          '/agent/stream/',
          { body, signal: ctrl.signal },
          (eventType, parsed) => {
            if (eventType === 'token') {
              enforceContract(agentTokenEventContract, parsed, 'agent.stream.token');
              onToken?.(parsed);
            } else if (eventType === 'tool_call') onToolCall?.(parsed);
            else if (eventType === 'tool_result') onToolResult?.(parsed);
            else if (eventType === 'done') {
              onDone?.(parsed);
              return false;
            } else if (eventType === 'error') {
              enforceContract(agentErrorEventContract, parsed, 'agent.stream.error');
              onError?.(new Error(parsed.message || 'Agent error'));
              return false;
            }
            return undefined;
          },
        );
      } catch (err) {
        if (err.name !== 'AbortError') onError?.(err);
      }
    })();
    return ctrl;
  },
};
