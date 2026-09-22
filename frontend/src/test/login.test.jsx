import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from '@/pages/LoginPage';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>
  );
}

// Guards bounce unauthenticated visitors to /login with the destination in
// location.state.from; the form must honour it or deep links are lost.
function renderLoginAt(from) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/login', state: from ? { from } : null }]}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/resources/:id" element={<div>Resource detail</div>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function signIn() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email/i), 'stud@uni.edu');
  await user.type(screen.getByLabelText(/^password/i), 'secret123');
  await user.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('LoginPage validation and error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reload: vi.fn(),
      isAuthenticated: false,
    });
  });

  it('shows a validation error for an invalid email', async () => {
    const login = vi.fn();
    useAuth.mockReturnValue({
      user: null,
      loading: false,
      login,
      logout: vi.fn(),
      reload: vi.fn(),
      isAuthenticated: false,
    });
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'a@b');
    await user.type(screen.getByLabelText(/^password/i), 'whatever123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    // Validation must block submission entirely.
    expect(login).not.toHaveBeenCalled();
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
  });

  it('surfaces API error messages for failed logins', async () => {
    const login = vi.fn().mockRejectedValue({
      response: { data: { error: { detail: 'Invalid credentials.' } } },
    });
    useAuth.mockReturnValue({
      user: null,
      loading: false,
      login,
      logout: vi.fn(),
      reload: vi.fn(),
      isAuthenticated: false,
    });
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'stud@uni.edu');
    await user.type(screen.getByLabelText(/^password/i), 'wrongpass1');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });

  it('returns the user to the page they were pushed away from', async () => {
    renderLoginAt({ pathname: '/resources/r7' });
    await signIn();
    expect(await screen.findByText('Resource detail')).toBeInTheDocument();
  });

  it('falls back to the dashboard when login was opened directly', async () => {
    renderLoginAt(null);
    await signIn();
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });
});
