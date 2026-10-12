// A pending upload's id is a local `upload-…` string, not the UUID the API
// expects, so it must never leave the composer.
export const confirmedResourceIds = (resources) =>
  resources
    .filter((r) => !r.pending)
    .map((r) => r.id)
    .filter(Boolean);

const CHAT_SNAPSHOT_KEY = 'academiai:chat-snapshot';

export function saveSnapshot({ sessionId, sessionTitle, messages, input }) {
  try {
    if (!sessionId) {
      window.sessionStorage.removeItem(CHAT_SNAPSHOT_KEY);
      return;
    }
    const payload = {
      sessionId,
      sessionTitle,
      messages,
      input,
      savedAt: Date.now(),
    };
    window.sessionStorage.setItem(CHAT_SNAPSHOT_KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function loadSnapshot() {
  try {
    const raw = window.sessionStorage.getItem(CHAT_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
