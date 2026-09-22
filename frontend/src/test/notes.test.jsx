import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotesPage from '@/pages/NotesPage';

vi.mock('@/services/api', () => ({
  notesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    bulkDelete: vi.fn(),
  },
}));

import { notesApi } from '@/services/api';

vi.mock('@/components/layout/AppShell', () => ({
  default: ({ title, description, actions, children }) => (
    <section>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
      {children}
    </section>
  ),
}));

vi.mock('@/hooks/useKeyboardShortcut', () => ({
  useKeyboardShortcut: () => {},
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function queryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient()}>
      <NotesPage />
    </QueryClientProvider>,
  );
}

describe('NotesPage save behaviour after the editor is destroyed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notesApi.list.mockResolvedValue([]);
    notesApi.create.mockResolvedValue({
      data: { id: 1, title: 'Untitled', content: '<p>typed body</p>' },
    });
  });

  it('saves without throwing when the TipTap editor has been destroyed (regression: Cannot read properties of null reading cached)', async () => {
    const user = userEvent.setup();
    renderPage();

    // Get past the empty state and open a brand-new note.
    await user.click(await screen.findByRole('button', { name: /new note/i }));

    // The ProseMirror contenteditable is the TipTap surface. TipTap tags its
    // DOM node with a back-reference to the Editor instance (view.dom.editor),
    // so we can reach the real editor and tear it down mid-edit.
    const editable = await screen.findByRole('textbox', { name: '' });
    const editor = editable && editable.editor;
    expect(editor).toBeTruthy();

    await user.type(editable, 'typed body');

    // Wait for TipTap's onUpdate to mark the note dirty and snapshot content.
    await waitFor(() => expect(editable.innerHTML).toContain('typed body'));

    // Simulate the editor being torn down while the user still has unsaved
    // work (schema nulled => editor.getHTML() throws; the old code crashed
    // here and the note could never be saved).
    editor.destroy();
    expect(editor.schema).toBeNull();

    // Saving must NOT throw, and must persist the last known content. (The
    // editor blur + form submit can each trigger a save; every save must carry
    // the typed body — that is what crashed before this fix.)
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(notesApi.create).toHaveBeenCalled());
    for (const [payload] of notesApi.create.mock.calls) {
      expect(payload.title).toBe('Untitled');
      expect(payload.content).toContain('typed body');
    }
  });
});