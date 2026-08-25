# AcademiAI — Future Implementations & Architecture Notes

This document records every feature that was **scaffolded but intentionally
not fully implemented**, plus the decisions behind them, so they can be picked
up without archaeology.

---

## 1. Tenant self-registration with platform approval

**Status:** scaffolded (status field + platform console exist).

Current flow: platform operators provision tenants in the Platform Console
(`/platform`, superuser-only) or Django admin. A tenant can be created with
`status=pending` and later approved (`status=active`) from the console — the
"Approve" button already works.

**Full future flow:**

1. Public "Register your institution" form (name, slug, owner email,
   justification, supporting documents).
2. Backend creates `Tenant(status=pending)` and emails the platform team.
3. Platform operator reviews documents (future: document upload to MinIO
   under `tenants/{id}/verification/`), then activates from the console.
4. On activation, the designated **owner email is promoted to `role=admin`**
   of that tenant automatically (audit-logged as `tenant.owner_promoted`).

**Where to build:** new public view in `apps/tenants/views.py`
(`TenantRegistrationView`), a `owner_email` column on `Tenant`, and an
activation hook in `TenantViewSet.perform_update`.

---

## 2. Role-elevation approval queue ("Approvals" page)

**Status:** full UI scaffolded at `/admin/approvals` — actions disabled,
tagged **Coming Soon** (sidebar badge included).

Today: everyone signs up as student or lecturer; elevation to admin happens
manually on the Users page (audited). The future workflow:

1. Member submits elevation request (role wanted + justification).
2. Tenant admin approves/rejects from the Approvals queue.
3. Decision is audited (`user.role_elevation.approved|rejected`) and emailed.

**Suggested model:** `RoleElevationRequest(user FK, requested_role,
justification, status[pending/approved/rejected], decided_by, decided_at)`.

---

## 3. Email domain binding

**Status:** storage exists, enforcement does not.

`Tenant.allowed_email_domains` (JSON list, e.g. `["atbu.edu.ng"]`) is already
on the model and editable via migration when needed. Enforcement point when
implemented: `apps/accounts/services.py::signup_user` — reject signups whose
email domain is not in the list (only for tenants that configure it; empty
list = no restriction). Also surface it in the signup UI as a hint
("Must use your institutional email").

---

## 4. Per-tenant subdomains (`atbu.academiai.app`)

**Status:** decision made — implement **after** core project completion. No
code was added now so nothing breaks.

Recommended implementation path (zero-breakage ordering):

1. **Now (already safe):** slugs are lowercase/digits/hyphens only
   (`^[a-z0-9-]+$` enforced by the platform console form) — valid DNS labels.
2. **Phase 1 — resolver middleware:** add a small middleware *before*
   `TenantContextMiddleware` that extracts the subdomain from
   `request.get_host()` and, if it matches a tenant slug, pins
   `request.tenant_url = tenant`. Keep the existing header/JWT resolution as
   fallback so API clients are unaffected.
3. **Phase 2 — frontend:** detect subdomain at boot; if present, skip the
   institution dropdown on `/signup` and lock it to that tenant.
4. **Phase 3 — wildcard routing:** `*.academiai.app` CNAME → app load
   balancer; TLS via wildcard cert (or per-tenant certs with Caddy/
   cert-manager). Add `ALLOWED_HOSTS = [".academiai.app"]`.
5. **Custom domains** (optional later): tenant provides `university.edu.ng`;
   verify domain ownership (TXT record) then issue cert. `Tenant.domain`
   field already exists for this.

Nothing in steps 1–2 changes existing behaviour for `localhost` or the apex
domain, which is why implementation can safely wait.

---

## 5. Storage quota enforcement

**Status:** structure exists, enforcement off (per product decision:
"keep unlimited for now").

Existing structure:

- `Tenant.storage_quota_bytes` (default 10 GB) — editable in the Platform
  Console.
- Every upload already flows through two choke points where the check slots
  in: `ResourceViewSet.request_upload_url` (presign issuance) and
  `complete_upload` (version registration).

**When enabling:** sum `ResourceVersion.file_size_bytes` per tenant (add a
DB trigger or periodic rollup for scale) and reject presigns when usage +
requested size > quota with HTTP 402/413. Also wire the tenant dashboard's
quota card to show usage vs quota (the endpoint just needs the aggregate).

---

## 6. Suspension lifecycle (IMPLEMENTED)

Implemented end-to-end:

1. Superuser suspends a tenant in the Platform Console →
   `suspended_at=now()`, all active users emailed immediately.
2. Scheduled Celery task `restrict_suspended_tenant_logins` runs **every 30
   minutes** (see `CELERY_BEAT_SCHEDULE`) and deactivates all non-superuser
   accounts of tenants suspended more than `SUSPENSION_GRACE_HOURS` (24h
   default, env-overridable) ago.
3. Reactivation clears `suspended_at` and restores those accounts
   (`reactivate_tenant_users`).

Run beat alongside the worker: `celery -A config beat` (or combined
`celery -A config worker -B`).

---

## 7. Per-tenant branding

**Status:** room reserved — `Tenant.branding` JSONField (`{}`) exists.

Planned shape: `{"logo_key": "...", "primary_color": "#...", "tagline":
"..."}` with logo files stored under `tenants/{id}/branding/` in object
storage. Frontend reads branding via the tenant directory endpoint and
applies CSS custom properties on the auth pages first, then the whole shell.
Track as one epic; do not partially ship (half-themed tenants look broken).

---

## 8. Material preview & progress

**Status:** working today via browser-native plugins.

- PDFs stream through a short-lived signed URL into `<iframe>` — the
  browser's built-in PDF viewer renders them (this *is* the plugin-based
  viewer; zero JS payload).
- Text/markdown/JSON render inline; other types get download-only.

**Future enhancement:** swap the iframe for `react-pdf` (pdf.js) to add page
picker, text selection and search inside the dialog. Worker setup for Vite:
`pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`.

**Progress recording:** concept-level progress exists
(`ProgressRecord`, fed by knowledge-graph activity). Resource-level "viewed"
tracking is not yet persisted — recommended approach when needed: a thin
`ResourceView(user, resource, viewed_at)` append-only table written by the
preview endpoint, surfaced as "Recently viewed" + completion %.

---

## 9. Other known gaps / roadmap

- **Auto-enrollment depth:** students are auto-enrolled into *active
  offerings of their programme's department* at email verification. Session-
  specific or curriculum-level enrollment rules are future work.
- **Notifications center:** in-app notification feed (suspension, approvals,
  quiz published) alongside email.
- **Platform operator analytics:** cross-tenant charts live only in Django
  admin; the React console currently manages tenants but doesn't chart them.
- **Audit log retention policy** and export (compliance).
- **Backup/DR runbook** for Postgres + MinIO.

---

## Environment & ops notes

| Setting | Default | Purpose |
|---|---|---|
| `SUSPENSION_GRACE_HOURS` | `24` | Grace period before suspended-tenant logins are disabled |
| `CELERY_BEAT_SCHEDULE` | in `config/settings.py` | Runs the restriction task every 30 min |
| Migrations | `tenants.0002` | Adds `suspended_at`, `allowed_email_domains`, `branding` |

New/changed endpoints:

- `GET /api/v1/tenants/directory/?search=` — public, active tenants (id/name/slug)
- `GET /api/v1/programme-directory/?tenant=<slug>` — public, programmes for signup/auto-enrollment
- `GET /api/v1/resources/?scope=authorized` — visibility-scoped listing (students/lecturers)
- Signup accepts `role: student|lecturer` and optional `programme` UUID
