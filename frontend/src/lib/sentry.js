/**
 * Frontend error tracking — env-gated Sentry.
 *
 * Completely inert without `VITE_SENTRY_DSN` (dev builds are offline).
 * All event/env plumbing stays behind the DSN check so the browser never
 * contacts Sentry unless explicitly configured.
 */
import * as Sentry from '@sentry/react';

const ENABLED = () => Boolean(import.meta.env.VITE_SENTRY_DSN);

export function initSentry() {
  if (!ENABLED()) return false;
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment:
      import.meta.env.VITE_SENTRY_ENVIRONMENT ||
      (import.meta.env.DEV ? 'development' : 'production'),
    release:
      import.meta.env.VITE_SENTRY_RELEASE ||
      `academiai@${import.meta.env.VITE_COMMIT_SHA || 'dev'}`,
    tracesSampleRate: Number(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1',
    ),
    replaySessionSampleRate: 0,
    replayOnErrorSampleRate: 0,
  });
  return true;
}

/** Route-level error boundaries can use Sentry's <ErrorBoundary> wrapper. */
export { ErrorBoundary as SentryErrorBoundary } from '@sentry/react';

/** Non-fatal capture helper — safe no-op when Sentry is off. */
export function reportError(error, extra) {
  if (!ENABLED()) return;
  Sentry.captureException(error, extra ? { extra } : undefined);
}