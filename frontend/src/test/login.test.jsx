import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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
});
