/**
 * Notification inbox.
 *
 * The feed, the badge and the read state all derive from one query
 * (['notifications']), so the tests below assert on what the user can see:
 * a counted bell, the rows it opens, and the two ways a row can be dismissed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '@/App';

// vi.mock is hoisted above the imports, so resolve the shared factory lazily
// inside the async factory instead of referencing it at module scope.
vi.mock('@/services/api', async () => {
  const { makeApiMock } = await import('./apiMock');
  return makeApiMock();
});

function renderAt(path) {
  window.history.pushState({}, '', path);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>,
  );
}

/** The shape NotificationSerializer returns, minus pagination noise. */
function notification(overrides = {}) {
  return {
    id: 'n1',
    kind: 'course_behind',
    severity: 'warn',
    title: 'Linear Algebra needs attention',
    body: "You're at 40% progress.",
    link: '/courses/offering-1',
    is_read: false,
    created_at: new Date(Date.now() - 3_600_000).toISOString(),
    ...overrides,
  };
}

/** Sign in as a student and mount a page that renders the shell topbar. */
async function openInbox(results = []) {
  localStorage.setItem('academiai:session', '1');
  const { authApi, notificationsApi } = await import('@/services/api');
  authApi.me.mockResolvedValue({
    id: 'u1', email: 'stud@uni.edu', role: 'student', first_name: 'Stu', tenant: {},
  });
  notificationsApi.setFeed(results);
  renderAt('/resources');
  return notificationsApi;
}

/**
 * The bell. The first mount in a file pays for the whole lazy route graph
 * (13s cold on this machine, ~0.5s warm), so the budget is deliberately wide.
 */
async function findBell() {
  return screen.findByRole(
    'button',
    { name: /notifications/i },
    { timeout: 60000 },
  );
}

describe('notification inbox', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('counts unread alerts on the bell', async () => {
    await openInbox([notification()]);

    const bell = await findBell();
    await waitFor(() => expect(bell).toHaveTextContent('1'));
  }, 60000);

  it('lists each notification with its title and body', async () => {
    await openInbox([
      notification(),
      notification({
        id: 'n2',
        kind: 'pipeline_failed',
        severity: 'critical',
        title: 'Quantum Notes failed to process',
        body: 'Re-upload the file to index it.',
        link: '/resources/upload',
      }),
    ]);

    await userEvent.click(await findBell());
    // Scoped to the opened menu: the toaster can surface the same alert text.
    const menu = await screen.findByRole('menu', {}, { timeout: 10000 });
    expect(
      within(menu).getByText('Linear Algebra needs attention'),
    ).toBeInTheDocument();
    expect(
      within(menu).getByText('Quantum Notes failed to process'),
    ).toBeInTheDocument();
    expect(within(menu).getByText(/Re-upload the file/)).toBeInTheDocument();
  }, 60000);

  it('says so when there is nothing in the feed', async () => {
    await openInbox([]);

    await userEvent.click(await findBell());
    expect(await screen.findByText(/caught up/i, {}, { timeout: 10000 })).toBeInTheDocument();
  }, 60000);

  it('marks every alert read from the header action', async () => {
    const notificationsApi = await openInbox([notification()]);
    const bell = await findBell();
    await waitFor(() => expect(bell).toHaveTextContent('1'));

    await userEvent.click(bell);
    await userEvent.click(await screen.findByRole('button', { name: /mark all read/i }));

    await waitFor(() => expect(notificationsApi.markAllRead).toHaveBeenCalled());
    await waitFor(() => expect(bell).not.toHaveTextContent('1'), { timeout: 10000 });
  }, 60000);

  it('opens an alert route and marks only that alert read', async () => {
    const notificationsApi = await openInbox([
      notification(),
      notification({
        id: 'n2',
        severity: 'critical',
        title: 'Quantum Notes failed to process',
        body: 'Re-upload the file to index it.',
        link: '/resources/upload',
      }),
    ]);
    const bell = await findBell();
    await waitFor(() => expect(bell).toHaveTextContent('2'));

    await userEvent.click(bell);
    const menu = await screen.findByRole('menu', {}, { timeout: 10000 });
    await userEvent.click(
      within(menu).getByText('Quantum Notes failed to process'),
    );

    await waitFor(() => expect(notificationsApi.markRead).toHaveBeenCalledWith('n2'));
    await waitFor(() => expect(window.location.pathname).toBe('/resources/upload'), {
      timeout: 10000,
    });
    // The other alert is still unread, so the badge drops to 1 rather than 0.
    // Re-queried because the route change remounts the shell.
    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: /notifications/i }),
        ).toHaveTextContent('1'),
      { timeout: 10000 },
    );
  }, 60000);

  it('toasts the alert body, not just its heading', async () => {
    await openInbox([notification()]);

    // Sonner owns the live region; assert on the text it announces.
    await waitFor(
      () => {
        const region = document.querySelector('section[aria-live="polite"]');
        expect(region?.textContent).toMatch(/You're at 40% progress\./);
      },
      { timeout: 10000 },
    );
  }, 60000);

  it('leaves alerts unread when the agent panel opens', async () => {
    const notificationsApi = await openInbox([notification()]);
    const bell = await findBell();
    await waitFor(() => expect(bell).toHaveTextContent('1'));

    await userEvent.click(
      await screen.findByRole('button', { name: /open ai agent/i }),
    );
    expect(
      await screen.findByRole('button', { name: /close ai agent/i }, { timeout: 10000 }),
    ).toBeInTheDocument();

    expect(notificationsApi.markAllRead).not.toHaveBeenCalled();
    expect(bell).toHaveTextContent('1');
  }, 60000);
});
