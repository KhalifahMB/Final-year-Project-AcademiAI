/**
 * Calendar smoke coverage.
 *
 * CalendarPage is a container plus twelve view/dialog components that share
 * date and layer helpers. The module split is mechanical, so the real risk is
 * a helper or constant that stops being imported in the file that still uses
 * it — which neither oxlint nor the production build reports (an undefined
 * identifier is a runtime ReferenceError). Rendering every view is what
 * catches that.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

async function signIn(as = 'student') {
  localStorage.setItem('academiai:session', '1');
  const { authApi } = await import('@/services/api');
  authApi.me.mockResolvedValue(
    as === 'tenant_admin'
      ? {
          id: 'a1', email: 'admin@uni.edu', role: 'tenant_admin',
          first_name: 'Ad', is_superuser: false, tenant: {},
        }
      : {
          id: 'u1', email: 'stud@uni.edu', role: 'student',
          first_name: 'Stu', tenant: {},
        },
  );
}

/** Mount the calendar and wait until the seeded lecture is on screen. */
async function openCalendar(as = 'student') {
  await signIn(as);
  renderAt('/calendar');
  // Budget for the FIRST caller, which pays a cold Vite transform of the lazy
  // calendar route: this file completes in 20.3s of test time when run alone,
  // but in a full run it measured 56.5s and its first test lost this wait at
  // the 20s it used to allow. routing.test.jsx cost 31.6s for the same class of
  // cold mount in that same run, against the 10.6-16.3s quiet / 55-68s loaded
  // range vite.config.js:153-158 documents. Same treatment as that file
  // (8e82c96): a wait above the worst observed, with the test's own budget
  // raised past it.
  expect(
    await screen.findByText('Linear Algebra', {}, { timeout: 90000 }),
  ).toBeInTheDocument();
}

describe('calendar views', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the seeded event in week, day and agenda modes', async () => {
    await openCalendar();

    for (const mode of ['week', 'day', 'agenda']) {
      await userEvent.click(
        screen.getByRole('button', { name: new RegExp(`^${mode}$`, 'i') }),
      );
      await waitFor(
        () => {
          expect(screen.getAllByText(/Linear Algebra/i).length).toBeGreaterThan(0);
        },
        { timeout: 10000 },
      );
    }
  }, 150000);

  it('renders the events-only month strip', async () => {
    await openCalendar();

    await userEvent.click(screen.getByRole('button', { name: /events only/i }));
    await waitFor(
      () => {
        expect(screen.getAllByText(/Linear Algebra/i).length).toBeGreaterThan(0);
      },
      { timeout: 10000 },
    );
  }, 60000);

  it('opens the schedule dialog', async () => {
    await openCalendar();

    // The label appears twice: the shell action bar and the inline toolbar.
    const [trigger] = screen.getAllByRole('button', { name: /^schedule$/i });
    await userEvent.click(trigger);
    expect(
      await screen.findByRole('heading', { name: /^schedule$/i }),
    ).toBeInTheDocument();
  }, 60000);

  it('opens the import timetable dialog', async () => {
    // Gated behind isAdmin (tenant_admin / superuser) in the shell actions.
    await openCalendar('tenant_admin');

    await userEvent.click(
      screen.getByRole('button', { name: /import timetable/i }),
    );
    expect(
      await screen.findByRole('heading', { name: /import timetable/i }),
    ).toBeInTheDocument();
  }, 60000);

  it('hides events when their layer is toggled off', async () => {
    await openCalendar();

    await userEvent.click(screen.getByRole('switch', { name: /lectures/i }));
    await waitFor(
      () => {
        expect(screen.queryByText('Linear Algebra')).toBeNull();
      },
      { timeout: 10000 },
    );
  }, 60000);

  it('renders a multi-day event as a week ribbon', async () => {
    await openCalendar();

    // The same title is also carried by the upcoming-list row, so a text query
    // matches several nodes. A ribbon is the only button positioned as a
    // percentage span across the seven-column grid (weekSpan -> left/width).
    await waitFor(
      () => {
        const ribbons = [...document.querySelectorAll('button[title="Placement block"]')].filter(
          (b) => b.style.left.startsWith('calc('),
        );
        expect(ribbons.length).toBeGreaterThan(0);
      },
      { timeout: 10000 },
    );
  }, 60000);

  it('opens the day dialog from the overflow button', async () => {
    await openCalendar();

    const overflow = await screen.findByText(/more$/, {}, { timeout: 20000 });
    await userEvent.click(overflow);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Extra revision 1');
    expect(dialog).toHaveTextContent('Linear Algebra');
  }, 60000);

  it('shows the hover card with the event description', async () => {
    await openCalendar();

    const [chip] = screen.getAllByTitle('Linear Algebra');
    await userEvent.hover(chip);
    expect(
      await screen.findByText('Eigenvalues', {}, { timeout: 10000 }),
    ).toBeInTheDocument();
  }, 60000);

  it('opens the edit dialog for an own-layer event', async () => {
    await openCalendar();

    await userEvent.click(await screen.findByTitle('Extra revision 1'));
    expect(
      await screen.findByRole('heading', { name: 'Edit event' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Extra revision 1');
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  }, 60000);

  it('previews an uploaded timetable before importing', async () => {
    // Gated behind isAdmin, so import is exercised as tenant_admin.
    await openCalendar('tenant_admin');

    await userEvent.click(
      screen.getByRole('button', { name: /import timetable/i }),
    );
    // The file input has no label association, so reach it by type.
    const input = document.querySelector('input[type="file"]');
    await userEvent.upload(
      input,
      new File(['title,start,end\n'], 'timetable.csv', { type: 'text/csv' }),
    );

    await userEvent.click(screen.getByRole('button', { name: /^preview$/i }));
    expect(
      await screen.findByText('Thermo lecture', {}, { timeout: 10000 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Row 3 skipped: end before start/),
    ).toBeInTheDocument();
  }, 60000);
});
