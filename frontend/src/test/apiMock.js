/**
 * Shared `@/services/api` mock for route-level smoke tests.
 *
 * Mirrors the shape routing.test.jsx stubs, plus the calendar surface those
 * tests never touch. Keep endpoints permissive: a missing stub resolves to an
 * empty list rather than throwing, so a test failure points at the component,
 * not at this file.
 */
export function makeApiMock() {
  const emptyList = () => Promise.resolve({ data: { results: [], count: 0 } });
  const emptyObj = () => Promise.resolve({ data: {} });

  // Anchor to "today" so the default month/week/day views are populated.
  const dayAt = (offset, hour) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  // Mutable so markRead/markAllRead behave like the server instead of being
  // overwritten by the next list() call.
  let feed = [];
  const badgeCount = () =>
    feed.filter(
      (n) => !n.is_read && (n.severity === 'warn' || n.severity === 'critical'),
    ).length;

  const events = [
    {
      id: 'e1',
      title: 'Linear Algebra',
      layer: 'academic',
      event_type: 'lecture',
      start: dayAt(0, 9),
      end: dayAt(0, 11),
      all_day: false,
      venue: 'Hall B',
      description: 'Eigenvalues',
      status: 'confirmed',
      visibility: 'public',
      course_code: 'MTH201',
      notify_enabled: true,
      reminders_minutes: [30],
    },
    {
      id: 'e2',
      title: 'Revision block',
      layer: 'personal',
      event_type: 'study',
      start: dayAt(2, 14),
      end: dayAt(2, 16),
      all_day: false,
      venue: '',
      description: '',
      status: 'confirmed',
      visibility: 'private',
      course_code: '',
      notify_enabled: false,
      reminders_minutes: [],
    },
    {
      id: 'e3',
      title: 'Exam period begins',
      layer: 'exams',
      event_type: 'exam',
      start: dayAt(5, 8),
      end: dayAt(5, 17),
      all_day: true,
      venue: 'Main Hall',
      description: '',
      status: 'confirmed',
      visibility: 'public',
      course_code: '',
      notify_enabled: true,
      reminders_minutes: [1440],
    },
    // Overflow today's cell past MAX_CHIPS so the "N more" button and the day
    // dialog it opens have to render.
    ...[6, 12, 22].map((hour, i) => ({
      id: `e${4 + i}`,
      title: `Extra revision ${i + 1}`,
      layer: 'personal',
      event_type: 'study',
      start: dayAt(0, hour),
      end: dayAt(0, hour + 1),
      all_day: false,
      venue: '',
      description: '',
      status: 'confirmed',
      visibility: 'private',
      course_code: '',
      notify_enabled: false,
      reminders_minutes: [],
    })),
    // Spans several days, and crosses a week boundary, so the month grid has to
    // lay out its span/lane/tint path rather than dropping it into a day cell.
    {
      id: 'e7',
      title: 'Placement block',
      layer: 'personal',
      event_type: 'study',
      start: dayAt(0, 20),
      end: dayAt(3, 10),
      all_day: false,
      venue: 'Remote',
      description: 'Multi-day',
      status: 'confirmed',
      visibility: 'private',
      course_code: '',
      notify_enabled: false,
      reminders_minutes: [],
    },
  ];

  return {
    default: {
      get: vi.fn(emptyList),
      post: vi.fn(emptyObj),
      patch: vi.fn(emptyObj),
      delete: vi.fn(emptyObj),
      defaults: { baseURL: 'http://test/api/v1' },
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    },
    authApi: {
      me: vi.fn(),
      login: vi.fn(emptyObj),
      logout: vi.fn(emptyObj),
      signup: vi.fn(emptyObj),
      verifyEmail: vi.fn(emptyObj),
      passwordResetRequest: vi.fn(emptyObj),
      passwordResetConfirm: vi.fn(emptyObj),
      passwordChange: vi.fn(emptyObj),
      updateMe: vi.fn(emptyObj),
    },
    dashboardApi: {
      student: vi.fn(() =>
        Promise.resolve({
          counts: {},
          totals: {},
          enrolled_courses: [],
          recent_resources: [],
          recent_chats: [],
        }),
      ),
      admin: vi.fn(() => Promise.resolve({ totals: {}, materials_by_status: [], structure: [] })),
      lecturer: vi.fn(() => Promise.resolve({ counts: {}, totals: {} })),
      studentActivity: vi.fn(async () => ({ timeline: [] })),
      adminAuditSummary: vi.fn(async () => ({
        total_events: 0, timeline: [], by_action: [], by_entity_type: [], top_actors: [], recent: [],
      })),
    },
    calendarApi: {
      layers: vi.fn(() =>
        Promise.resolve({
          default_layers: ['personal', 'academic', 'exams', 'office_hours', 'institution'],
        }),
      ),
      listEventsLight: vi.fn(() => Promise.resolve({ results: events, count: events.length })),
      // The real endpoint is .order_by("start") (apps/calendar/views.py), and
      // UpcomingPanel groups runs of equal date labels, so an unsorted fixture
      // describes an API the server never sends.
      upcoming: vi.fn(() =>
        Promise.resolve(
          [...events].sort((a, b) => a.start.localeCompare(b.start)),
        ),
      ),
      createEvent: vi.fn(emptyObj),
      updateEvent: vi.fn(emptyObj),
      deleteEvent: vi.fn(emptyObj),
      exportIcs: vi.fn(() => Promise.resolve(new Blob(['BEGIN:VCALENDAR']))),
      scheduleTemplate: vi.fn(() => Promise.resolve(new Blob(['x']))),
      previewSchedule: vi.fn(() =>
        Promise.resolve({
          row_count: 1,
          warnings: ['Row 3 skipped: end before start'],
          rows: [
            {
              title: 'Thermo lecture',
              layer: 'academic',
              start: '2026-10-05T09:00:00Z',
              end: '2026-10-05T10:00:00Z',
              venue: 'Lab 2',
            },
          ],
        }),
      ),
      commitSchedule: vi.fn(() =>
        Promise.resolve({ event_count: 1, error_count: 1 }),
      ),
    },
    plansApi: { list: vi.fn(emptyList) },
    notesApi: {
      list: vi.fn(emptyList), create: vi.fn(emptyObj), update: vi.fn(emptyObj),
      delete: vi.fn(emptyObj), bulkDelete: vi.fn(emptyObj),
    },
    platformApi: {
      stats: vi.fn(emptyObj), health: vi.fn(emptyObj),
      tenants: { list: vi.fn(emptyList), create: vi.fn(emptyObj), update: vi.fn(emptyObj) },
      tenantRequests: { list: vi.fn(emptyList), create: vi.fn(emptyObj), review: vi.fn(emptyObj) },
      announcements: { list: vi.fn(emptyList), create: vi.fn(emptyObj), update: vi.fn(emptyObj), delete: vi.fn(emptyObj) },
      auditLogs: vi.fn(emptyList), tenantDetail: vi.fn(emptyObj),
    },
    chatApi: {
      listSessions: vi.fn(emptyList), getMessages: vi.fn(emptyList),
      createSession: vi.fn(emptyObj), renameSession: vi.fn(emptyObj),
      deleteSession: vi.fn(emptyObj), send: vi.fn(emptyObj),
      uploadAttachment: vi.fn(emptyObj), stream: vi.fn(() => ({ abort: vi.fn() })),
    },
    agentApi: {
      identities: vi.fn(() =>
        Promise.resolve({
          agents: [{ key: 'tutor', name: 'Tutor', avatar: '/avatars/tutor.svg', presence: 'online', guardian: 'Guide', tagline: 'Learn' }],
          default_key: 'tutor',
          settings: { enabled: true, default_agent: 'tutor', tone: 'balanced', filters: {}, reminders_enabled: true },
        }),
      ),
      getSettings: vi.fn(emptyObj),
      updateSettings: vi.fn((d) => Promise.resolve({ data: d })),
      listSessions: vi.fn(() => Promise.resolve({ results: [], count: 0 })),
      getSession: vi.fn(emptyObj),
      createSession: vi.fn(() => Promise.resolve({ id: 'mock' })),
      renameSession: vi.fn(emptyObj), deleteSession: vi.fn(emptyObj),
      stream: vi.fn(() => null),
    },
    // Stateful, like the real feed: /notifications/ re-derives `unread_count`
    // from stored read state, so a test that marks something read and then
    // re-fetches sees the update rather than the original fixture. The badge
    // rule mirrors services.BADGE_SEVERITIES (unread warn + critical).
    notificationsApi: {
      // Test-only: seeds the feed. Defaults to empty so a page that merely
      // mounts the inbox shows no alerts.
      setFeed: (rows) => {
        feed = (rows || []).map((r) => ({ ...r }));
      },
      list: vi.fn(() =>
        Promise.resolve({
          results: feed.map((r) => ({ ...r })),
          count: feed.length,
          unread_count: badgeCount(),
        }),
      ),
      unreadCount: vi.fn(() => Promise.resolve({ unread_count: badgeCount() })),
      markRead: vi.fn((id) => {
        const row = feed.find((n) => n.id === id);
        if (row) row.is_read = true;
        return Promise.resolve({ ok: true });
      }),
      markAllRead: vi.fn(() => {
        feed.forEach((r) => {
          r.is_read = true;
        });
        return Promise.resolve({ ok: true, updated: feed.length });
      }),
      preferences: vi.fn(() => Promise.resolve({ preferences: [] })),
      setPreference: vi.fn(() => Promise.resolve({ ok: true })),
    },
  };
}