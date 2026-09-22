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

describe('problem section imagery', () => {
  it('shows the plate beside the problem copy', async () => {
    // Imported after the api mock is registered, and mounted directly rather
    // than through App so the test skips the cold lazy-route graph.
    const { default: LandingPage } = await import('@/pages/LandingPage');
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    render(
      <AuthContext.Provider value={{ isAuthenticated: false }}>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={['/']}>
            <LandingPage />
          </MemoryRouter>
        </QueryClientProvider>
      </AuthContext.Provider>,
    );

    const plate = await screen.findByTestId('problem-plate');
    assertWordless(plate);
    assertTokenDriven(plate);
    // The plate reinforces the copy; it must not displace it.
    expect(
      screen.getByRole('heading', { name: /materials are fragmented/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Materials live in a dozen drives'),
    ).toBeInTheDocument();
  });
});
