import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '@/App';

vi.mock('@/services/api', () => {
  const emptyList = () => Promise.resolve({ data: { results: [], count: 0 } });
  const emptyObj = () => Promise.resolve({ data: {} });
  const mockApi = {
    get: vi.fn(emptyList),
    post: vi.fn(emptyObj),
    patch: vi.fn(emptyObj),
    delete: vi.fn(emptyObj),
    defaults: { baseURL: 'http://test/api/v1' },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    default: mockApi,
    authApi: {
      me: vi.fn(emptyObj),
      login: vi.fn(emptyObj),
      logout: vi.fn(emptyObj),
      signup: vi.fn(emptyObj),
      verifyEmail: vi.fn(emptyObj),
      passwordResetRequest: vi.fn(emptyObj),
      passwordResetConfirm: vi.fn(emptyObj),
      passwordChange: vi.fn(emptyObj),
      updateMe: vi.fn(emptyObj),
    },
    dashApi: {
      courses: vi.fn(emptyList),
      resources: vi.fn(emptyList),
      quizzes: vi.fn(emptyList),
      notes: vi.fn(emptyList),
    },
    dashboardApi: {
      student: vi.fn(() =>
        Promise.resolve({
          counts: { enrollments: 0, resources: 0, quiz_attempts: 0, notes: 0 },
          totals: {},
          enrolled_courses: [],
          recent_resources: [],
          recent_chats: [],
        }),
      ),
      admin: vi.fn(() =>
        Promise.resolve({
          totals: { users: 0, resources: 0, quizzes: 0, chat_sessions: 0 },
          materials_by_status: [],
          structure: [],
        }),
      ),
      studentActivity: vi.fn(async () => ({ timeline: [] })),
      adminAuditSummary: vi.fn(async () => ({
        total_events: 0,
        timeline: [],
        by_action: [],
        by_entity_type: [],
        top_actors: [],
        recent: [],
      })),
    },
    notesApi: {
      list: vi.fn(emptyList),
      create: vi.fn(emptyObj),
      update: vi.fn(emptyObj),
      delete: vi.fn(emptyObj),
      bulkDelete: vi.fn(emptyObj),
    },
    platformApi: {
      stats: vi.fn(emptyObj),
      health: vi.fn(emptyObj),
      tenants: { list: vi.fn(emptyList), create: vi.fn(emptyObj), update: vi.fn(emptyObj) },
      tenantRequests: { list: vi.fn(emptyList), create: vi.fn(emptyObj), review: vi.fn(emptyObj) },
      announcements: { list: vi.fn(emptyList), create: vi.fn(emptyObj), update: vi.fn(emptyObj), delete: vi.fn(emptyObj) },
      auditLogs: vi.fn(emptyList),
      tenantDetail: vi.fn(emptyObj),
    },
    chatApi: {
      listSessions: vi.fn(emptyList),
      getMessages: vi.fn(emptyList),
      createSession: vi.fn(emptyObj),
      renameSession: vi.fn(emptyObj),
      deleteSession: vi.fn(emptyObj),
      send: vi.fn(emptyObj),
      uploadAttachment: vi.fn(emptyObj),
      stream: vi.fn(() => ({ abort: vi.fn() })),
    },
  };
});

import { authApi } from '@/services/api';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return ({ children }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function navigate(path) {
  window.history.pushState({}, '', path);
}

describe('routing and access control', () => {
  let Wrapper;
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Wrapper = makeWrapper();
  });

  it('redirects unauthenticated users from a protected page to /login', async () => {
    authApi.me.mockRejectedValue({ response: { status: 401 } });
    navigate('/dashboard');
    render(<App />, { wrapper: Wrapper });
    expect(
      await screen.findByText(/welcome back/i),
    ).toBeInTheDocument();
  });

  it('renders the dashboard for an authenticated student', async () => {
    localStorage.setItem('access_token', 'test-token');
    localStorage.setItem('refresh_token', 'test-refresh');
    authApi.me.mockResolvedValue({
      data: { id: 'u1', email: 'stud@uni.edu', role: 'student', first_name: 'Stu', tenant: {} },
    });
    navigate('/dashboard');
    render(<App />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getAllByText(/quick actions/i).length).toBeGreaterThan(0);
    });
  });

  it('denies a student access to admin-only page (redirects to dashboard)', async () => {
    localStorage.setItem('access_token', 'test-token');
    localStorage.setItem('refresh_token', 'test-refresh');
    authApi.me.mockResolvedValue({
      data: { id: 'u2', email: 'stud@uni.edu', role: 'student', first_name: 'Stu', tenant: {} },
    });
    navigate('/admin/users');
    render(<App />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getAllByText(/welcome/i).length).toBeGreaterThan(0);
    });
  });
});
