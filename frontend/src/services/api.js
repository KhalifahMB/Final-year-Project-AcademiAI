/**
 * Centralized API client with JWT handling.
 */
import axios from 'axios';

// In dev, use relative /api/v1 so Vite proxy handles CORS.
// In prod, VITE_API_BASE_URL should be the full backend URL.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/token/refresh/`, {
            refresh,
          });
          localStorage.setItem('access_token', data.access);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;

export const authApi = {
  signup: (payload) => api.post('/auth/signup/', payload),
  login: (payload) => api.post('/auth/login/', payload),
  verifyEmail: (payload) => api.post('/auth/verify-email/', payload),
  resendVerification: (payload) =>
    api.post('/auth/resend-verification/', payload),
  me: () => api.get('/auth/me/'),
  updateMe: (payload) => api.patch('/auth/me/', payload),
  logout: (refresh) => api.post('/auth/logout/', { refresh }),
  passwordResetRequest: (payload) =>
    api.post('/auth/password-reset/request/', payload),
  passwordResetConfirm: (payload) =>
    api.post('/auth/password-reset/confirm/', payload),
  passwordChange: (payload) => api.post('/auth/password-change/', payload),
};

/** Dashboard counters — DEPRECATED in favour of aggregate endpoints below. */
const toList = (res) => {
  const data = res.data;
  return Array.isArray(data) ? data : data?.results || [];
};

export const dashApi = {
  courses: () => api.get('/courses/').then(toList),
  resources: () => api.get('/resources/').then(toList),
  quizzes: () => api.get('/quizzes/').then(toList),
  notes: () => api.get('/notes/').then(toList),
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
  list: () => api.get('/notes/').then(toList),
  create: (payload) => api.post('/notes/', payload),
  update: (id, payload) => api.patch(`/notes/${id}/`, payload),
  delete: (id) => api.delete(`/notes/${id}/`),
  bulkDelete: (ids) =>
    Promise.all(ids.map((id) => api.delete(`/notes/${id}/`))),
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

/** Chat session helpers — streaming send + rename/delete. */
export const chatApi = {
  listSessions: () =>
    api
      .get('/chat/sessions/?page_size=100')
      .then((r) => r.data.results || r.data || []),
  getMessages: (sessionId) =>
    api
      .get(`/chat/messages/?session=${sessionId}&page_size=200`)
      .then((r) => r.data.results || r.data || []),
  createSession: (payload = {}) => api.post('/chat/sessions/', payload),
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
    return api
      .post('/chat/upload/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
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
    const token = localStorage.getItem('access_token');
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `${api.defaults.baseURL}/chat/sessions/${sessionId}/messages/stream/`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: token ? `Bearer ${token}` : '',
            },
            body: JSON.stringify({ content, resource_ids: resourceIds }),
            signal: ctrl.signal,
          },
        );
        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let doneReading = false;
        while (!doneReading) {
          const { value, done } = await reader.read();
          if (done) {
            doneReading = true;
            break;
          }
          buf += decoder.decode(value, { stream: true });
          // Parse SSE events separated by double newlines
          let idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const lines = raw.split('\n');
            let event = 'message';
            let data = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) event = line.slice(7).trim();
              else if (line.startsWith('data: ')) data += line.slice(6);
            }
            if (!data) continue;
            try {
              const parsed = JSON.parse(data);
              if (event === 'token') {
                if (onToken) onToken(parsed.text || '');
              } else if (event === 'user_message') {
                if (onMeta) onMeta({ user_message: parsed });
              } else if (event === 'meta') {
                if (onMeta) onMeta(parsed);
              } else if (event === 'done') {
                if (onDone) onDone(parsed.assistant_message);
                return;
              }
            } catch {
              // malformed chunk, ignore
            }
          }
        }
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
