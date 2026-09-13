/**
 * Router-navigation bridge for non-React code.
 *
 * React components navigate with `useNavigate()`/`<Navigate>` directly.
 * The axios layer (api.js) and the auth provider (mounted above
 * <BrowserRouter>) have no router access, so they go through this tiny
 * indirection: a component inside the router registers its `navigate`, and
 * everything else calls `go()`. Until a navigator is registered (e.g. a 401
 * arriving before the app mounts) it falls back to a full-page redirect.
 */
import { reportError } from '@/lib/sentry';

let navigateFn = null;

export function setNavigator(fn) {
  navigateFn = fn;
}

export function go(to, options) {
  if (navigateFn) {
    navigateFn(to, options);
    return;
  }
  // Reached only if a redirect fires before RouterBridge registers the
  // navigator (a render-order regression). The full-page fallback keeps the
  // app functional, but it must never be silent.
  const message = `Navigation requested before the router navigator was registered (${String(to)}); falling back to window.location.assign.`;
  console.warn(message);
  reportError(new Error(message));
  window.location.assign(to);
}