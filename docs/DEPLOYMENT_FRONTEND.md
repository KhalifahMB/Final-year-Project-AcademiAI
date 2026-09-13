# Frontend deployment checklist

Pre-ship, staging, and post-deploy items specific to the SPA tier.

---

## Infrastructure

| # | Item | Status |
|---|------|--------|
| 1 | **nginx.conf + Dockerfile** — SPA `try_files` fallback, `/api/` and `/media/` proxied to backend, cache headers for hashed assets, no-cache on `index.html` and `sw.js`. Backend expected at `backend:8000`. | Fixed |
| 2 | **`npm ci`** instead of `npm install` in Dockerfile for reproducible deploys | Fixed |
| 3 | **`engines` field** in package.json (`node >=20.19`, `npm >=10`) | Fixed |
| 4 | `test:e2e` uses `playwright test` directly (no `npx` indirection) | Fixed |

### nginx notes

- Backend service name must resolve to the Django container. If your compose stack
  names it differently than `backend`, either rename the service or COPY a modified
  `nginx.conf` at build time.
- TLS termination is **not** in this config — terminate at your load balancer/CDN.
- The `proxy_read_timeout 300s` covers long-running SSE streams. If you bump the
  backend SSE window, bump it here too.

---

## Security

| # | Item | Action |
|---|------|--------|
| 1 | **SameSite Strict cookies** | Verify Django `SESSION_COOKIE_SAMESITE="Strict"` and `CSRF_COOKIE_SAMESITE="Strict"` are set in `settings.py`. The app relies on this. |
| 2 | **Secure flag** | In production, `SESSION_COOKIE_SECURE=True` and `CSRF_COOKIE_SECURE=True` must be set. No `Secure` cookie should be issued over plain HTTP. |
| 3 | **CSP headers** | Add a `Content-Security-Policy` header at your edge/proxy (not in nginx.conf) to block inline scripts and restrict frame-src. The PDF viewer uses an iframe with `sandbox="allow-same-origin"` — CSP `frame-src` must allow the blob/object-storage origin. |
| 4 | **`VITE_API_BASE_URL`** | In staging/prod, set this to the **full absolute URL** of the backend (e.g. `https://api.example.com/api/v1`). Leaving it as the default `/api/v1` only works behind a reverse proxy that routes `/api/` to the backend. |
| 5 | **SW service worker cache scope** | Only `/api/public/` endpoints are cached offline. Authenticated API traffic is **never** cached by the service worker. Do not add authenticated routes to `runtimeCaching` in `vite.config.js`. |
| 6 | **`localStorage` session flag** | `academiai:session` is a non-sensitive UX hint (not a credential), stored in `localStorage`. It is cleared on logout and on session expiry. Documented in `src/lib/session.js`. |
| 7 | **Chat snapshot (`sessionStorage`)** | `academiai:chat-snapshot` is cleared on logout and on refresh-token failure to prevent cross-user data leakage on shared devices. |
| 8 | **PDF iframe** | Rendered with `sandbox="allow-same-origin"` and `referrerPolicy="no-referrer"`. Do not add `allow-scripts` unless absolutely needed. |
| 9 | **Sentry source maps** | In prod, upload source maps to Sentry via `@sentry/vite-plugin` or `sentry-upload-sourcemaps` and do **not** serve `.map` files from the CDN. |

---

## Feature flags / env vars

| Variable | Where | Required |
|----------|-------|----------|
| `VITE_API_BASE_URL` | runtime | Yes in prod (absolute URL) |
| `VITE_PUBLIC_API_BASE_URL` | runtime | Optional, defaults to `/api/public` |
| `VITE_SENTRY_DSN` | build/runtime | Optional — Sentry is a no-op if unset |
| `VITE_SENTRY_ENVIRONMENT` | runtime | Optional |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | runtime | Optional, default `0.1` |
| `VITE_GA4_MEASUREMENT_ID` | runtime | Optional — Google Analytics |

---

## SEO / PWA

| # | Item | Notes |
|---|------|-------|
| 1 | **`og:image`** | Currently `/pwa-512.png`. Change to an absolute URL before sharing on social media, or it won't render. |
| 2 | **`robots.txt` + `sitemap.xml`** | Not present. Add before public launch. |
| 3 | **PWA `registerType`** | Set to `autoUpdate` — users get a new SW automatically. Be aware this can cause "flash of old content" on slow connections. Consider prompting with a "reload" toast instead. |
| 4 | **`/sw.js` cache header** | `no-cache, must-revalidate` — browsers will re-validate. If you want an immediate update window, serve the old SW for a known period then swap. |

---

## Asset / bundle size

| Chunk | Gzipped | Notes |
|-------|---------|-------|
| `NotesPage` | ~132 KB | tiptap editor + extensions. If notes become a core flow, consider lazy-loading the editor only when editing. |
| `AppShell` | ~150 KB | Shared sidebar + nav. Always in main bundle. Acceptable. |
| `BrandMark` | ~92 KB | Large SVG/image asset. Consider `loading="lazy"` if it's an `<img>`, or move to a smaller format. |
| `BarChart` | ~100 KB | Recharts. Always code-split into route chunks if not already. |
| Total dist | ~8 MB | **9 MB before gzip.** Consider running `npx source-map-explorer` on large chunks to identify what can be deferred. |

---

## Deferred items (product decision required)

| Item | Severity | Decision needed |
|------|----------|-----------------|
| **Quiz question pagination** | Medium | Backend `DefaultPagination` caps at 20. Frontend now requests `page_size=100`, but quizzes with >100 questions need a backend override or pagination UI. |
| **Backend `/media/` caching** | Low | MinIO CDN / nginx `proxy_cache_valid 200 10m` covers signed URLs. Confirm signed-URL TTL matches your media policy. |
| **`refetchOnWindowFocus`** | Low | Currently disabled globally. Enable per-page where fresh data matters (e.g. Dashboard, Chat) by passing `refetchOnWindowFocus: true` to individual queries. |
| **`useAgent` boot dedupe** | Low | `fetchIdentity` fires on mount regardless of query cache. Could be deduped via `staleTime` instead of a guard. |
| **Sonner v1 -> v2** | Low | Sonner v2 changes toast API surface. Bump when the migration effort is budgeted. |
| **`@tanstack/eslint-plugin-query`** | Low | Wired but using `oxlint` which doesn't consume it yet. Evaluate if ESLint is adopted for stricter React Query lint rules. |
| **`design-variants/` folder** | — | Confirm it should be deleted from `public/`. It's excluded from the SW precache. |

---

## Smoke test before deploy

```bash
cd frontend

# 1. Full build + lint
npm run lint
npm run build

# 2. Unit tests
npx vitest run

# 3. Verify nginx.conf parses
docker run --rm -v "$PWD/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t

# 4. Local preview with backend
docker compose -f ../docker-compose.yml up -d
npm run preview   # opens on :4173, check /dashboard deep link loads

# 5. Check SW
open Chrome -> Application -> Service Workers: confirm sw.js registered, no /api/ cache entries
```

---

## Post-deploy verification

- [ ] `/` lands on the login page (no blank SPA)
- [ ] `/dashboard` deep link renders (nginx `try_files` working)
- [ ] `/api/v1/auth/me/` returns 200 or 401 (proxy working)
- [ ] `/media/` assets load (MinIO proxy working)
- [ ] PDF preview opens in sandboxed iframe
- [ ] Chat session survives page refresh (snapshot restores)
- [ ] Logout clears chat snapshot; logging in with a different account shows a clean slate
- [ ] PWA "Add to Home Screen" prompt appears on mobile (after a few visits)
- [ ] Sentry receives errors (if configured)
