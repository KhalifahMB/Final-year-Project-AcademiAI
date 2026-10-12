import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PasswordResetPage from '@/pages/PasswordResetPage';
import { authApi } from '@/services/api';
import { passwordResetConfirmSchema } from '@/lib/validations';

vi.mock('@/services/api', async () => {
  const { makeApiMock } = await import('./apiMock');
  return makeApiMock();
});

function renderReset() {
  return render(
    <MemoryRouter initialEntries={['/password-reset']}>
      <PasswordResetPage />
    </MemoryRouter>,
  );
}

// Step 1 hands the typed email to step 2 so the confirm request can carry it.
async function reachConfirmStep(user) {
  authApi.passwordResetRequest.mockResolvedValue({ data: { success: true } });
  renderReset();
  await user.type(screen.getByLabelText(/email/i), 'stud@uni.edu');
  await user.click(screen.getByRole('button', { name: /send reset code/i }));
  await screen.findByLabelText(/^reset code/i);
}

describe('PasswordResetPage 6-digit code', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the code field numeric, digits-only and capped at 6', async () => {
    const user = userEvent.setup();
    await reachConfirmStep(user);

    const input = screen.getByLabelText(/^reset code/i);
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('maxlength', '6');

    await user.type(input, 'ab12cd34ef56');
    expect(input).toHaveValue('123456');
  });

  it('refuses to submit a code that is not exactly 6 digits', async () => {
    const user = userEvent.setup();
    await reachConfirmStep(user);

    await user.type(screen.getByLabelText(/^reset code/i), '12345');
    await user.type(screen.getByLabelText(/^new password/i), 'BrandNew!2026pw');
    await user.type(screen.getByLabelText(/^confirm new password/i), 'BrandNew!2026pw');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(authApi.passwordResetConfirm).not.toHaveBeenCalled();
    // Exact text: the page subtitle also mentions a 6-digit code.
    expect(await screen.findByText('Enter the 6-digit code')).toBeInTheDocument();
  });

  it('sends the 6-digit code to the API on a valid submit', async () => {
    authApi.passwordResetConfirm.mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    await reachConfirmStep(user);

    await user.type(screen.getByLabelText(/^reset code/i), '041927');
    await user.type(screen.getByLabelText(/^new password/i), 'BrandNew!2026pw');
    await user.type(screen.getByLabelText(/^confirm new password/i), 'BrandNew!2026pw');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(authApi.passwordResetConfirm).toHaveBeenCalledWith({
      email: 'stud@uni.edu',
      token: '041927',
      new_password: 'BrandNew!2026pw',
    });
    // The success banner and the page title both say "Password updated".
    expect(await screen.findByRole('status')).toHaveTextContent(/password updated/i);
  });

  it('shows the server reason when the code is exhausted or rejected', async () => {
    authApi.passwordResetConfirm.mockRejectedValue({
      response: { data: { error: { detail: 'Too many attempts. Request a new code.' } } },
    });
    const user = userEvent.setup();
    await reachConfirmStep(user);

    await user.type(screen.getByLabelText(/^reset code/i), '041927');
    await user.type(screen.getByLabelText(/^new password/i), 'BrandNew!2026pw');
    await user.type(screen.getByLabelText(/^confirm new password/i), 'BrandNew!2026pw');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(
      await screen.findByText('Too many attempts. Request a new code.'),
    ).toBeInTheDocument();
  });

  it('rejects anything that is not 6 digits at the schema level', () => {
    const base = {
      email: 'stud@uni.edu',
      password: 'BrandNew!2026pw',
      confirm: 'BrandNew!2026pw',
    };
    expect(passwordResetConfirmSchema.safeParse({ ...base, token: '12345' }).success).toBe(false);
    expect(passwordResetConfirmSchema.safeParse({ ...base, token: '1234567' }).success).toBe(false);
    expect(passwordResetConfirmSchema.safeParse({ ...base, token: '12ab56' }).success).toBe(false);
    expect(passwordResetConfirmSchema.safeParse({ ...base, token: '041927' }).success).toBe(true);
  });
});
