import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SignupPage from '@/pages/SignupPage';

vi.mock('@/services/api', async () => {
  const { makeApiMock } = await import('./apiMock');
  return makeApiMock();
});

function renderSignup() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/signup']}>
        <SignupPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// The zod schema accepts any 8 characters, so before the meter 'aaaaaaaa' and
// 'Tr0ub4dor&3x' got identical feedback.
describe('SignupPage password strength', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows nothing until the user starts typing a password', async () => {
    renderSignup();
    expect(screen.queryByText(/weak|fair|good|strong/i)).not.toBeInTheDocument();
  });

  it('labels a minimum-length password made of one character class as weak', async () => {
    renderSignup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^password/i), 'abcdefgh');
    expect(await screen.findByText('Weak')).toBeInTheDocument();
  });

  it('rewards length and variety with a strong rating', async () => {
    renderSignup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^password/i), 'Abcdefghij1!');
    expect(await screen.findByText('Strong')).toBeInTheDocument();
  });
});
