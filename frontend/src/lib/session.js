/**
 * Session-state marker for cookie-JWT auth.
 *
 * The JWT payload itself never touches localStorage (it lives in HttpOnly
 * SameSite=Strict cookies that JS cannot read). This flag only records *that*
 * a session was started so the app can skip probing `/auth/me/` for
 * anonymous visitors — it is not a credential.
 */
export const SESSION_FLAG = 'academiai:session';

export const hasSessionFlag = () => localStorage.getItem(SESSION_FLAG) === '1';
export const setSessionFlag = () => localStorage.setItem(SESSION_FLAG, '1');
export const clearSessionFlag = () => localStorage.removeItem(SESSION_FLAG);

// User-scoped ephemeral data that must never survive a logout or a session
// expiry (chat drafts are restored on next login and could leak between
// people sharing a device). Call this wherever the session ends.
export const clearUserScopedStorage = () => {
  try {
    localStorage.removeItem('academiai:chat-snapshot');
    window.sessionStorage.removeItem('academiai:chat-snapshot');
  } catch {
    /* storage unavailable — ignore */
  }
};