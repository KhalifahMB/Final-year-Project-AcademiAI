import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import AtlasLanding from '@/pages/landing/variants/AtlasLanding';
import CinnabarLanding from '@/pages/landing/variants/CinnabarLanding';
import LandingLab from '@/pages/landing/LandingLab';

// The variants pull live numbers through the shared hooks, so stub the API with
// the two surfaces they touch (directory page + public stats).
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { results: [] } })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    defaults: { baseURL: 'http://test/api/v1' },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  publicApi: {
    getStats: vi.fn(() => Promise.resolve({ institutions_total: 3 })),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  }),
}));

// happy-dom lacks these observers; kept for variants that reveal on scroll.
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
window.scrollTo = vi.fn();

function renderIn(Component) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const VARIANTS = [
  ['Atlas', AtlasLanding, 'atlas'],
  ['Cinnabar', CinnabarLanding, 'cinnabar'],
];

describe('landing-lab variants render end to end', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it.each(VARIANTS)(
    '%s mounts every section without crashing',
    (_name, Component, rootClass) => {
      const { container } = renderIn(Component);
      expect(container.querySelector(`.${rootClass}`)).toBeTruthy();
      // Every variant must carry the full section set, including the two new
      // anchors (roadmap + institutions) and the footer.
      expect(container.querySelectorAll('h2').length).toBeGreaterThanOrEqual(8);
      expect(container.querySelector('#roadmap')).toBeTruthy();
      expect(container.querySelector('#institutions')).toBeTruthy();
      expect(container.querySelector('footer')).toBeTruthy();
    },
  );

  it('lab shows a 2-tab picker and defaults to the Atlas variant', () => {
    const { container, getByRole } = renderIn(LandingLab);
    expect(getByRole('tablist')).toBeTruthy();
    expect(container.querySelectorAll('[role="tab"]').length).toBe(2);
    expect(container.querySelector('.atlas')).toBeTruthy();
  });
});
