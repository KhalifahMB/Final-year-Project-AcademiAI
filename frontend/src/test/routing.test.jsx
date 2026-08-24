import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '@/App';

// Mock the centralized API client so tests never hit the network.
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { results: [] } })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
  },
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    signup: vi.fn(),
    verifyEmail: vi.fn(),
    passwordResetRequest: vi.fn(),
    passwordResetConfirm: vi.fn(),
    passwordChange: vi.fn(),
  },
}));

import { authApi } from '@/services/api';

function navigate(path) {
  window.history.pushState({}, '', path);
}

describe('routing and access control', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('redirects unauthenticated users from a protected page to /login', async () => {
    navigate('/dashboard');
    render(<App />);
    // LoginPage content appears instead of the dashboard.
    expect(
      await screen.findByText(/academiai institutional workspace/i)
    ).toBeInTheDocument();
  });

  it('renders the dashboard for an authenticated user', async () => {
    localStorage.setItem('access_token', 'test-token');
    localStorage.setItem('refresh_token', 'test-refresh');
    authApi.me.mockResolvedValue({
      data: { id: 'u1', email: 'stud@uni.edu', role: 'student', first_name: '' },
    });
    navigate('/dashboard');
    render(<App />);
    const cards = await screen.findAllByText(/quick actions/i);
    expect(cards.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/browse resources/i).length).toBeGreaterThan(0);
  });

  it('denies a student access to an admin-only page (role gate)', async () => {
    localStorage.setItem('access_token', 'test-token');
    authApi.me.mockResolvedValue({
      data: { id: 'u2', email: 'stud@uni.edu', role: 'student' },
    });
    navigate('/admin/users');
    render(<App />);
    // Redirected to /dashboard; the admin user-management view must never appear.
    await screen.findAllByText(/welcome/i);
    expect(screen.queryByText(/accounts in your institution/i)).not.toBeInTheDocument();
  });

  it('allows an admin to open an admin-only page', async () => {
    localStorage.setItem('access_token', 'test-token');
    authApi.me.mockResolvedValue({
      data: { id: 'u3', email: 'admin@uni.edu', role: 'admin' },
    });
    navigate('/admin/users');
    render(<App />);
    expect(await screen.findAllByText(/users/i).then((els) => els.length > 0)).toBe(true);
    expect(await screen.findByText(/roles and activation status/i)).toBeInTheDocument();
  });
});
