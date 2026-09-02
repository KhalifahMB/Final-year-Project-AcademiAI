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
import api from '@/services/api';

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
      await screen.findByText(/welcome back/i, {}, { timeout: 15000 }),
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
    await waitFor(
      () => {
        expect(screen.getAllByText(/continue learning|up next/i).length).toBeGreaterThan(0);
      },
      { timeout: 15000 },
    );
  }, 15000);

  it('denies a student access to an admin-only page (walks them to /forbidden)', async () => {
    localStorage.setItem('access_token', 'test-token');
    localStorage.setItem('refresh_token', 'test-refresh');
    authApi.me.mockResolvedValue({
      data: { id: 'u2', email: 'stud@uni.edu', role: 'student', first_name: 'Stu', tenant: {} },
    });
    navigate('/admin/users');
    render(<App />, { wrapper: Wrapper });
    expect(
      await screen.findByText(/access denied/i, {}, { timeout: 15000 }),
    ).toBeInTheDocument();
    // Guard redirected before the page mounted — no tenant API calls fired.
    await waitFor(() => expect(api.get).not.toHaveBeenCalled());
  });

  it('sends a platform superuser away from tenant pages to /platform without firing tenant API calls', async () => {
    localStorage.setItem('access_token', 'test-token');
    localStorage.setItem('refresh_token', 'test-refresh');
    authApi.me.mockResolvedValue({
      data: {
        id: 'su1', email: 'operator@academiai.app', role: 'tenant_admin',
        first_name: 'Op', is_superuser: true,
      },
    });
    navigate('/resources');
    render(<App />, { wrapper: Wrapper });
    expect(
      await screen.findByText(/platform dashboard/i, {}, { timeout: 15000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(api.get).not.toHaveBeenCalled());
  });

  it('lets a tenant_admin open a workspace route like /resources', async () => {
    localStorage.setItem('access_token', 'test-token');
    localStorage.setItem('refresh_token', 'test-refresh');
    authApi.me.mockResolvedValue({
      data: {
        id: 'a1', email: 'admin@uni.edu', role: 'tenant_admin',
        first_name: 'Ad', is_superuser: false, tenant: {},
      },
    });
    navigate('/resources');
    render(<App />, { wrapper: Wrapper });
    // Page actually mounted (its queries fired) instead of being blocked.
    expect(
      await screen.findByText(/no resources yet/i, {}, { timeout: 15000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
  }, 15000);

  it('keeps lecturer-grade routes open to tenant admins who can also teach', async () => {
    localStorage.setItem('access_token', 'test-token');
    localStorage.setItem('refresh_token', 'test-refresh');
    authApi.me.mockResolvedValue({
      data: {
        id: 'a2', email: 'admin@uni.edu', role: 'tenant_admin',
        first_name: 'Ad', is_superuser: false, tenant: {},
      },
    });
    navigate('/assigned-courses');
    render(<App />, { wrapper: Wrapper });
    // AssignedCoursesPage mounts and calls /lecturer-assignments/.
    expect(
      await screen.findByText(/no assignments yet/i, {}, { timeout: 15000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
  }, 15000);

  it('sends a signed-in user with no tenant to institution onboarding', async () => {
    localStorage.setItem('access_token', 'test-token');
    localStorage.setItem('refresh_token', 'test-refresh');
    authApi.me.mockResolvedValue({
      data: { id: 'u3', email: 'orphan@example.com', role: 'student', first_name: 'Or' },
    });
    navigate('/dashboard');
    render(<App />, { wrapper: Wrapper });
    expect(
      await screen.findByText(/get your institution on academiai/i, {}, { timeout: 15000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(api.get).not.toHaveBeenCalled());
  });
});

