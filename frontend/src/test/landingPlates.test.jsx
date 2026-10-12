import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '@/context/AuthContext';
import { FragmentedMaterialsPlate } from '@/components/shared/landingPlates';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { results: [], count: 0 } })),
  },
  publicApi: {
    getStats: vi.fn(() => Promise.resolve({ institutions_total: 0 })),
  },
}));

// DESIGN.md forbids a baked-in hue so both themes stay deliberate, and the
// landing assets this replaces were disqualified by words and metrics rendered
// into the pixels. Both rules are checkable from markup, so check them.
function assertTokenDriven(node) {
  expect(node.outerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
}

function assertWordless(node) {
  expect(node.querySelector('text')).toBeNull();
  expect(node.textContent.trim()).toBe('');
}

describe('landing plates', () => {
  it('renders the fragmented-materials plate as decorative art', () => {
    const { container } = render(<FragmentedMaterialsPlate />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws with currentColor instead of a baked-in hue', () => {
    const { container } = render(<FragmentedMaterialsPlate />);
    const svg = container.querySelector('svg');
    expect(svg.outerHTML).toContain('currentColor');
    assertTokenDriven(svg);
  });

  it('bakes no words, numbers or metrics into the artwork', () => {
    const { container } = render(<FragmentedMaterialsPlate />);
    assertWordless(container.querySelector('svg'));
  });
});

describe('problem section copy', () => {
  it('renders token-driven problem copy on the routed landing', async () => {
    // Imported after the api mock is registered, and mounted directly rather
    // than through App so the test skips the cold lazy-route graph. The routed
    // landing at `/` is the Cinnabar variant (see pages.js).
    const { default: CinnabarLanding } = await import(
      '@/pages/landing/variants/CinnabarLanding'
    );
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    render(
      <AuthContext.Provider value={{ isAuthenticated: false }}>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={['/']}>
            <CinnabarLanding />
          </MemoryRouter>
        </QueryClientProvider>
      </AuthContext.Provider>,
    );

    const heading = await screen.findByRole('heading', {
      name: /materials are fragmented/i,
    });
    // The problem copy is present outright — imagery must reinforce, not hold,
    // the headline and the claims beneath it.
    expect(
      screen.getByText('Materials live in a dozen drives'),
    ).toBeInTheDocument();
    // No baked-in hues anywhere the landing renders (tokens only, both themes).
    assertTokenDriven(document.body);
    expect(heading).toBeInTheDocument();
  });
});
