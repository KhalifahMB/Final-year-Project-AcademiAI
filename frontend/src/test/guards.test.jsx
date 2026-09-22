import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ProtectedRoute } from '@/routes/guards';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

function LoginProbe() {
  const location = useLocation();
  const from = location.state?.from;
  return <div>{`from: ${from ? `${from.pathname}${from.search}` : 'none'}`}</div>;
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route
          path="/resources/:id"
          element={
            <ProtectedRoute roles={['student']}>
              <div>Resource detail</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hands the blocked location to /login so login can return to it', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    renderAt('/resources/r7?tab=notes');
    // The query string matters as much as the path: filtered views deep-link.
    expect(screen.getByText('from: /resources/r7?tab=notes')).toBeInTheDocument();
  });

  it('renders the page once the session resolves', () => {
    useAuth.mockReturnValue({
      user: { id: 'u1', role: 'student', tenant: {} },
      loading: false,
    });
    renderAt('/resources/r7');
    expect(screen.getByText('Resource detail')).toBeInTheDocument();
  });
});
