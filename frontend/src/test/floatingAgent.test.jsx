/**
 * Floating agent orb placement.
 *
 * The orb's position is persisted to localStorage so it survives reloads, and
 * it is dragged freely. The invariant that matters: the orb must always land
 * inside the viewport, otherwise it is invisible *and* unreachable — there is
 * no handle left to drag back. These tests pin the clamp that enforces it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FloatingAgent from '@/components/agent/FloatingAgent';

vi.mock('@/services/api', async () => {
  const { makeApiMock } = await import('./apiMock');
  return makeApiMock();
});

const STORAGE_KEY = 'academiai:agent-position';

function setViewport(width, height) {
  window.innerWidth = width;
  window.innerHeight = height;
}

function seedPosition(value) {
  if (value === undefined) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, value);
}

/** The orb button's fixed-position wrapper carries the inline left/top. */
function orbWrapper() {
  return screen.getByRole('button', { name: /open ai agent|close ai agent/i })
    .parentElement;
}

function renderOrb() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <FloatingAgent />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function expectInsideViewport() {
  const style = orbWrapper().style;
  const x = Number.parseFloat(style.left);
  const y = Number.parseFloat(style.top);
  // 60px = ORB_EDGE (orb box + gap); anything beyond that is off-screen.
  expect(x).toBeGreaterThanOrEqual(0);
  expect(y).toBeGreaterThanOrEqual(0);
  expect(x).toBeLessThanOrEqual(window.innerWidth - 60);
  expect(y).toBeLessThanOrEqual(window.innerHeight - 60);
  return { x, y };
}

describe('FloatingAgent orb position', () => {
  beforeEach(() => {
    localStorage.clear();
    setViewport(1024, 768);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to the bottom-right of the viewport', () => {
    seedPosition();
    renderOrb();
    const { x, y } = expectInsideViewport();
    expect(x).toBe(1024 - 80);
    expect(y).toBe(768 - 80);
  });

  it('restores an in-viewport saved position untouched', () => {
    seedPosition(JSON.stringify({ x: 120, y: 240 }));
    renderOrb();
    const { x, y } = expectInsideViewport();
    expect(x).toBe(120);
    expect(y).toBe(240);
  });

  it('clamps a saved position that points off-screen', () => {
    // Saved while the window was much wider than it is now.
    seedPosition(JSON.stringify({ x: 5000, y: 4000 }));
    renderOrb();
    const { x, y } = expectInsideViewport();
    expect(x).toBe(1024 - 60);
    expect(y).toBe(768 - 60);
  });

  it('falls back to the default for a malformed saved position', () => {
    // `"null"` parses successfully, so a naive JSON.parse would return null
    // and every later position.x would throw.
    seedPosition('null');
    expect(() => renderOrb()).not.toThrow();
    const { x, y } = expectInsideViewport();
    expect(x).toBe(1024 - 80);
    expect(y).toBe(768 - 80);
  });

  it('falls back to the default for a non-numeric saved position', () => {
    seedPosition(JSON.stringify({ x: 'left', y: null }));
    renderOrb();
    expectInsideViewport();
  });

  it('re-clamps into the viewport when the window shrinks', () => {
    seedPosition(JSON.stringify({ x: 900, y: 700 }));
    renderOrb();
    expect(expectInsideViewport().x).toBe(900);

    setViewport(500, 400);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    const { x, y } = expectInsideViewport();
    expect(x).toBe(500 - 60);
    expect(y).toBe(400 - 60);
  });

  it('repairs the persisted value so the next load is already sane', () => {
    seedPosition(JSON.stringify({ x: 5000, y: 4000 }));
    renderOrb();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.x).toBeLessThanOrEqual(1024 - 60);
    expect(stored.y).toBeLessThanOrEqual(768 - 60);
  });
});