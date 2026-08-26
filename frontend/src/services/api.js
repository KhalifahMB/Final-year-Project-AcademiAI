/**
 * Centralized API client with JWT handling.
 */
import axios from 'axios';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

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
  me: () => api.get('/auth/me/'),
  updateMe: (payload) => api.patch('/auth/me/', payload),
  logout: (refresh) => api.post('/auth/logout/', { refresh }),
  passwordResetRequest: (payload) =>
    api.post('/auth/password-reset/request/', payload),
  passwordResetConfirm: (payload) =>
    api.post('/auth/password-reset/confirm/', payload),
  passwordChange: (payload) => api.post('/auth/password-change/', payload),
};

/** Dashboard counters — each returns the raw list (or []). */
const toList = (res) => {
  const data = res.data;
  console.log(data);
  return Array.isArray(data) ? data : data?.results || [];
};

export const dashApi = {
  courses: () => api.get('/courses/').then(toList),
  resources: (config) => api.get('/resources/').then(toList),
  quizzes: () => api.get('/quizzes/').then(toList),
  notes: () => api.get('/notes/').then(toList),
};
