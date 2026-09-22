/**
 * Chat send.
 *
 * The only bug this file exists for: pressing Enter while an attachment is
 * still uploading used to fire a request whose resource_ids contained the
 * placeholder's local id (`upload-…`, not a UUID), which the serializer
 * rejected with 400 — surfacing as "Failed to send" after the message had
 * already vanished from the composer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '@/App';

// vi.mock is hoisted above the imports, so resolve the shared factory lazily
// inside the async factory instead of referencing it at module scope.
vi.mock('@/services/api', async () => {
  const { makeApiMock } = await import('./apiMock');
  return makeApiMock();
});

/** A promise the test settles by hand, so "upload in flight" is a real state. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const UPLOADED_ID = '3f6a1c2b-9d4e-4f0a-8b7c-1d2e3f4a5b6c';

async function openChat() {
  window.history.pushState({}, '', '/chat');
  localStorage.setItem('academiai:session', '1');
  const { authApi, chatApi } = await import('@/services/api');
  authApi.me.mockResolvedValue({
    id: 'u1', email: 'stud@uni.edu', role: 'student', first_name: 'Stu', tenant: {},
  });
  chatApi.createSession.mockResolvedValue({
    data: { id: 's1', title: 'New chat' },
  });
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  render(
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('chat-input')).toBeInTheDocument(), {
    timeout: 60000,
  });
  return chatApi;
}

describe('chat send', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  // Per-test budget: the cold first mount of the lazy route graph can exceed
  // the global 30s testTimeout (vite.config.js), so this file passes with no
  // CLI --test-timeout override.
  it('waits for an in-flight upload instead of sending a placeholder id', { timeout: 90000 }, async () => {
    const chatApi = await openChat();
    const upload = deferred();
    chatApi.uploadAttachment.mockReturnValue(upload.promise);
    chatApi.stream.mockImplementation(() => ({ abort: vi.fn() }));

    const user = userEvent.setup();
    const input = screen.getByTestId('chat-input');
    await user.type(input, 'Summarise chapter 3');

    // The composer's file input is `className="hidden"`, so it is driven with
    // fireEvent rather than user.upload(); handleFilesSelected only reads
    // e.target.files (ChatPage.jsx:805-806).
    fireEvent.change(document.querySelector('input[type="file"]'), {
      target: { files: [new File(['x'], 'notes.pdf', { type: 'application/pdf' })] },
    });

    // The upload is genuinely in flight: the chip is present and the send
    // button is disabled (ChatPage.jsx:1367).
    await waitFor(() => expect(screen.getByTestId('chat-send')).toBeDisabled());

    await user.click(input);
    await user.type(input, '{Enter}');
    expect(chatApi.stream).not.toHaveBeenCalled();

    upload.resolve({
      resource: { id: UPLOADED_ID, title: 'notes.pdf', mime_type: 'application/pdf' },
    });
    await waitFor(() => expect(screen.getByTestId('chat-send')).toBeEnabled());

    await user.click(input);
    await user.type(input, '{Enter}');
    await waitFor(() => expect(chatApi.stream).toHaveBeenCalledTimes(1));
    expect(chatApi.stream.mock.calls[0][2].resourceIds).toEqual([UPLOADED_ID]);
  });
});
