# Chat Send Fix and Local RLS Enforcement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make chat "Failed to send" stop happening when a message is sent while a file upload is in flight, and make the local database enforce row-level security instead of bypassing it.

**Architecture:** Two independent slices in one plan. Tasks 1-2 are a frontend fix inside `frontend/src/pages/ChatPage.jsx`: `send()` refuses to run while an upload is in flight, and the resource ids it sends are derived only from confirmed attachments (a pending upload has a local `upload-…` string where the API expects a UUID). Tasks 3-7 are an environment remediation: the local `academiai` PostgreSQL role is currently a superuser, which makes every RLS policy inert. A `postgres` superuser and a bypassed `academiai_test` role are created first, the suite is pointed at `academiai_test` while `academiai` still works, then ownership moves off the abandoned `academiai_app` role and the privilege is stripped — in that order — and `test_rls.py` is rewritten to prove enforcement through `SET ROLE academiai`. The 31 test files whose fixture writes rely on the bypass are deferred to a follow-up plan by decision; `academiai_test` is the named shim that plan deletes.

**Tech Stack:** React 19 + Vite 8 (plain JavaScript), Vitest + happy-dom + Testing Library, oxlint; Django REST + PostgreSQL 16 (pgvector image) + pytest/pytest-django/pytest-xdist; Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-22-quiz-manager-chat-nav-design.md` — Part A (chat send fix) and Part F (local RLS remediation). Read Part F's "What it breaks" and "Plan" sections before starting Task 3; they carry the live-volume evidence this plan argues from.

## Global Constraints

- **Windows + PowerShell 5.1 is the human's shell.** Do not use `&&`; chain with `;` or `cmd1; if ($?) { cmd2 }`. Commands below are written one per line for that reason.
- **`git` commands run from the repository root** and use repo-root-relative paths (`frontend/src/...`). `cd frontend` / `cd backend` precede only npm, `manage.py` and pytest invocations — a pathspec like `frontend/src/pages/ChatPage.jsx` resolved from inside `frontend/` matches nothing and fails the commit.
- **Use the venv Python explicitly:** `backend\.venv\Scripts\python.exe`. Never rely on `python` on PATH.
- **Frontend is plain JavaScript.** No TypeScript, no type annotations, no `.tsx`.
- **`oxlint` is the linter** (`npm run lint`), not eslint. `npm run build` must stay clean.
- **Compose service names, not container names:** the database service is `db` (container `academiai-db-1`). `psql -U postgres` fails on this volume until Task 3 creates that role.
- **Backend tests require the Docker DB running** (`docker compose up -d`). They are not offline-safe. `pytest.ini` sets `addopts = -n auto --create-db`; do not disable xdist for the whole suite — `test_rls.py`'s *current* fixture mutates cluster-global roles and would contaminate neighbours. To run one or two files serially, override the ini rather than the plugin: `-o addopts="--create-db"`. (`-p no:xdist` de-registers the plugin that defines `-n`, so pytest then fails with *unrecognized arguments: -n auto* before collecting anything.)
- **Never expose or commit secrets, and never run destructive git commands** (`git reset --hard`, `git clean -fd`, `git checkout -- .`) without explicit authorization. Do not stage or commit the human's unrelated working-tree changes; stage only the files named in each step.
- **RLS is applied automatically** by the `post_migrate` receiver (`apps/common/apps.py`). There is no `apply_rls` step to run.
- **`FORCE ROW LEVEL SECURITY` is load-bearing** here: the app role owns the tables, and a table owner is implicitly exempt unless FORCE is set (`apps/common/rls.py:81-84` applies it).
- **`infrastructure/postgres/init/00-extensions.sql` is load-bearing from Task 5 onward.** pgvector 0.8.6 on this cluster is `superuser = t, trusted = f`, so once `academiai` is demoted nothing can run `CREATE EXTENSION vector` (`resources/migrations/0001_initial.py:22`). Per-worker test databases only build because that script installed `vector` into `template1` at first init and they inherit it. Task 3 Step 1 verifies the inheritance instead of assuming it; if `template1` lacks `vector`, stop and install it as `postgres` first.
- **From Task 4, pytest connects as `academiai_test` (`BYPASSRLS`), not the runtime role** — via the `conftest.py` hook, overridable with `POSTGRES_TEST_USER=academiai` (an empty value works only from a POSIX shell; PowerShell deletes the variable on `""`, which would silently leave the bypass on). RLS behaviour is still tested for real: `test_rls.py` does `SET ROLE academiai`. Do not "simplify" this by granting `BYPASSRLS` to `academiai`, and do not report the suite as proving isolation.
- **The backend suite is not green on this volume and this plan does not fix that.** Its baseline is `3 failed, 266 passed`: the missing `CourseEnrollment` import at `apps/common/dashboard.py:893` and two `test_material_experience.py` preview tests stale against the `content_path` contract. They touch no role, RLS, or connection path. Every backend run below is judged as "the same three and nothing new" — a report that calls this green, or that folds these three into a task's diff, is wrong.
- **Do not wipe or recreate the `postgres_data` volume.** The whole point of Tasks 3-7 is to fix the existing volume additively.
- **No new dependencies** in either package manager.

---

### Task 1: Chat send is blocked while an upload is in flight

The keyboard path into `send()` is guarded only by `!loading`, so pressing Enter during an upload runs `send()` with a placeholder attachment whose id is not a UUID. The backend serializer (`ListField(child=UUIDField())`) rejects the body with HTTP 400 before anything is persisted, and the UI shows "Failed to send".

**Files:**
- Modify: `frontend/src/pages/ChatPage.jsx:862`
- Create: `frontend/src/test/chatSend.test.jsx`

**Interfaces:**
- Consumes: `makeApiMock()` from `frontend/src/test/apiMock.js` (already provides `chatApi.stream`, `chatApi.uploadAttachment`, `chatApi.createSession` as `vi.fn()`), and the `data-testid` hooks already present in the page: `chat-input` (`ChatPage.jsx:1359`) and `chat-send` (`:1369`).
- Produces: `frontend/src/test/chatSend.test.jsx`, the file Task 2 adds its second test case to. No production API changes.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/test/chatSend.test.jsx`. It follows the established page-mount pattern in `frontend/src/test/notifications.test.jsx:16-31` (mock `@/services/api` with `makeApiMock()`, seed `authApi.me`, mount `App` inside a `QueryClientProvider`). The first mount in a file pays for the whole lazy route graph, so the waits use a deliberately wide budget, as that file does.

```jsx
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

  it('waits for an in-flight upload instead of sending a placeholder id', async () => {
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
```

- [ ] **Step 2: Run it to verify it fails the way the bug describes**

```
cd frontend
npx vitest run src/test/chatSend.test.jsx
```

Expected: FAIL at `expect(chatApi.stream).not.toHaveBeenCalled()` — received 1 call. (If it fails earlier, on `chat-send` never becoming disabled, stop and fix the harness before touching production code; that is a test problem, not the bug.)

- [ ] **Step 3: Add the guard**

In `frontend/src/pages/ChatPage.jsx`, line 862 currently reads (two-space indent, exactly):

```js
  if ((!content && attachedResources.length === 0) || loading) return;
```

Replace it with:

```js
  if ((!content && attachedResources.length === 0) || loading || uploadingFiles) return;
```

`uploadingFiles` is the state already declared at `:632` and already used to disable the button at `:1367` and the upload button at `:1324`; `send()` was the one path that ignored it.

- [ ] **Step 4: Run it to verify it passes**

```
cd frontend
npx vitest run src/test/chatSend.test.jsx
```

Expected: PASS, one test, and no `act()` warnings or unhandled rejections in the output. If the output is not pristine, fix that before committing.

- [ ] **Step 5: Lint and commit**

```
cd frontend
npm run lint
```

```
# from the repository root
git add frontend/src/pages/ChatPage.jsx frontend/src/test/chatSend.test.jsx
git commit -m "fix(chat): block send while an upload is in flight to stop 400 on placeholder ids"
```

Expected: oxlint reports 0 errors on the two files, and the commit contains exactly those two paths.

---

### Task 2: Only confirmed attachments reach the request payload

Task 1 stops the send from starting. This task removes the bad value at its origin, so the payload cannot contain a non-UUID id even if a future code path leaves a pending chip behind while `uploadingFiles` is false. The spec calls this "the real fix"; guard 1 is the UX.

**Files:**
- Modify: `frontend/src/pages/ChatPage.jsx:60` (insert above `const SUGGESTIONS`) and `:869`
- Test: `frontend/src/test/chatSend.test.jsx`

**Interfaces:**
- Consumes: the `pending: true` flag `handleFilesSelected` already sets on its placeholder (`ChatPage.jsx:821`) and removes by replacing the placeholder with the server resource (`:828`).
- Produces: named export `confirmedResourceIds(resources: Array<{id: string, pending?: boolean}>): string[]` from `frontend/src/pages/ChatPage.jsx`. Task 2's test is the only consumer outside `send()`.

- [ ] **Step 1: Write the failing test**

Append to the `describe('chat send', …)` block in `frontend/src/test/chatSend.test.jsx`, and add the import at the top of the file:

```jsx
import { confirmedResourceIds } from '@/pages/ChatPage';
```

```jsx
  it('derives request resource_ids from confirmed attachments only', () => {
    expect(
      confirmedResourceIds([
        { id: 'upload-1727-0.4', title: 'notes.pdf', pending: true },
        { id: UPLOADED_ID, title: 'slides.pdf' },
      ]),
    ).toEqual([UPLOADED_ID]);
  });

  it('sends nothing when every attachment is still uploading', () => {
    expect(confirmedResourceIds([{ id: 'upload-1727-0.4', pending: true }])).toEqual([]);
  });

  it('returns an empty list for no attachments', () => {
    expect(confirmedResourceIds([])).toEqual([]);
  });
```

These three are pure-function cases: no mount, no waiting. `UPLOADED_ID` is already defined at module scope.

- [ ] **Step 2: Run to verify they fail**

```
cd frontend
npx vitest run src/test/chatSend.test.jsx
```

Expected: the three new tests FAIL with `confirmedResourceIds is not a function` (the named export does not exist yet). Task 1's test still passes.

- [ ] **Step 3: Write the helper and use it**

Insert above `const SUGGESTIONS = [` (line 60) in `frontend/src/pages/ChatPage.jsx`:

```js
// A pending upload's id is a local `upload-…` string, not the UUID the API
// expects, so it must never leave the composer.
export const confirmedResourceIds = (resources) =>
 resources.filter((r) => !r.pending).map((r) => r.id).filter(Boolean);
```

Then line 869 currently reads (one-space indent, exactly):

```js
 const resourceIds = attachedResources.map((r) => r.id).filter(Boolean);
```

Replace it with:

```js
 const resourceIds = confirmedResourceIds(attachedResources);
```

Leave the `attachments` display list on the line above untouched (`:868`): the chip row legitimately shows what is still uploading. That is why this is a named helper and not an in-line edit to both lines.

- [ ] **Step 4: Run to verify everything passes**

```
cd frontend
npx vitest run src/test/chatSend.test.jsx
```

Expected: 4 tests PASS, output pristine.

- [ ] **Step 5: Whole frontend suite, lint, build, commit**

```
cd frontend
npm run lint
npm run build
npm test
```

Expected: lint and build clean; the full vitest run has no new failures. `src/test/routing.test.jsx` has a documented intermittent 15s cold-mount timeout under parallelism — if only that one fails, re-run it alone (`npx vitest run src/test/routing.test.jsx`) and record the result rather than raising its budget.

```
# from the repository root
git add frontend/src/pages/ChatPage.jsx frontend/src/test/chatSend.test.jsx
git commit -m "refactor(chat): derive send payload from confirmed attachments only"
```

---

### Task 3: Create the two roles the enforced world needs

Nothing here can be done safely until a privileged role exists that is **not** the app role, and until the role the test suite will use exists to be pointed at. Today there is no `postgres`: `psql -U postgres` answers `FATAL: role "postgres" does not exist`, because this volume was initialised with `POSTGRES_USER=academiai` (its role oid is 10, the initdb bootstrap slot) while `docker-compose.yml:12` has declared `postgres` ever since. Both roles must be created while `academiai` still holds `rolcreaterole=t`, which Task 5 takes away.

**Steps 2, 3 and 5 change live role state. Show each command to the human and get an explicit yes before running it.** All three are additive: they create roles and remove nothing.

**Files:** none — database state only.

**Interfaces:**
- Consumes: the running `db` service, and `academiai`'s current `rolcreaterole=t`.
- Produces: role `postgres` (superuser, login) used by Tasks 4-7 for every privileged statement; role `academiai_test` (`LOGIN BYPASSRLS CREATEDB`, member of `academiai`) used by pytest from Task 4 onward, whose membership is what lets `test_rls.py` do `SET ROLE academiai` without `CREATEROLE`.

- [ ] **Step 1: Record the pre-fix state so the change is auditable**

```
docker compose exec -T db psql -U academiai -d academiai -c "SELECT rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname IN ('academiai','academiai_app') ORDER BY 1"
docker compose exec -T db psql -U academiai -d academiai -c "SELECT pg_get_userbyid(nspowner) AS schema_owner FROM pg_namespace WHERE nspname = 'public'"
docker compose exec -T db psql -U academiai -d academiai -c "SELECT tableowner, count(*) FROM pg_tables WHERE schemaname = 'public' GROUP BY 1"
docker compose exec -T db psql -U academiai -d template1 -c "SELECT extname FROM pg_extension ORDER BY 1"
```

Expected, matching the evidence in the spec: `academiai` all-`t`; `academiai_app` super/bypass/createrole `f`, createdb `t`; schema owner `academiai_app`; tables split 47 `academiai_app` / 19 `academiai`; and `template1` listing **`vector`** alongside `plpgsql`.

That last query is not a formality. `resources/migrations/0001_initial.py:22` runs `CREATE EXTENSION IF NOT EXISTS vector`, and pgvector 0.8.6 is `superuser = t, trusted = f` on this cluster, so a non-superuser can only build a database that already has the extension. `infrastructure/postgres/init/00-extensions.sql:6-7` installs it into `template1` for exactly that reason, and it ran at first init — verified 2026-09-22 by creating a scratch database from `template1` (it inherited `vector`) and dropping it again. **If `template1` does not list `vector`, stop**: every later step still works, but Task 4's suite run cannot, and the gap must be closed as `postgres` before going on.

If any of the other four answers differ from the above, **stop and report the difference** — the rest of the plan is sequenced on this exact state.

- [ ] **Step 2: Get approval, then create the bootstrap superuser**

Ask the human to approve this single command before running it:

```
docker compose exec -T db psql -U academiai -d academiai -c "CREATE ROLE postgres LOGIN SUPERUSER PASSWORD 'postgres'"
```

`'postgres'` is the value already committed in `docker-compose.yml:13` for this local container; it is not a production credential and must not be reused outside a dev volume.

- [ ] **Step 3: Verify the new role can connect**

```
docker compose exec -T db psql -U postgres -d academiai -c "SELECT current_user, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_super"
```

Expected: `postgres | t`. Inside the container the socket is `trust` (Task 3 Step 1 connected as `academiai` with no password), so no prompt should appear there. Django reaches the same server over a published port, where `pg_hba.conf` ends in `host all all all scram-sha-256` — that is why the roles below need real passwords. If an in-container command does ask for one, prefix `PGPASSWORD=<value>` and note which was needed.

- [ ] **Step 4: Get approval, then create the test-suite role**

```
docker compose exec -T db psql -U postgres -d academiai -c "CREATE ROLE academiai_test LOGIN NOSUPERUSER BYPASSRLS NOCREATEROLE NOREPLICATION CREATEDB PASSWORD 'academiai_test'"
docker compose exec -T db psql -U postgres -d academiai -c "GRANT academiai TO academiai_test"
```

Three attributes are load-bearing and each has a reason: `BYPASSRLS` carries the 31 still-unconverted test files (see Task 4), `CREATEDB` is what pytest-django needs for its per-worker databases, and the `academiai` membership is what lets `test_rls.py` `SET ROLE academiai` — `SET ROLE` requires membership, not `CREATEROLE`, which is precisely why the old `CREATE ROLE "rls_tester"` approach dies in Task 5.

- [ ] **Step 5: Verify both new roles are configured as intended**

```
docker compose exec -T db psql -U postgres -d academiai -c "SELECT rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname IN ('postgres','academiai','academiai_test') ORDER BY 1"
docker compose exec -T db psql -U postgres -d academiai -c "SELECT r.rolname AS member_of, m.rolname AS granted_to FROM pg_auth_members a JOIN pg_roles r ON r.oid = a.member JOIN pg_roles m ON m.oid = a.roleid WHERE r.rolname = 'academiai_test'"
```

`pg_auth_members` on this cluster (PostgreSQL 16.15, image `pgvectorscale:16.15`)
names its columns `member` / `roleid` / `grantor`; `memberid` and `grantorid` do
not exist there, so a query written against current upstream docs fails with
`column a.memberid does not exist`. Verified live 2026-09-22.

Expected: `academiai_test` → `rolsuper=f rolbypassrls=t rolcreaterole=f rolcreatedb=t`, and one membership row `academiai_test | academiai`.

- [ ] **Step 6: Confirm the application is untouched by all of this**

```
cd backend
.\.venv\Scripts\python.exe manage.py migrate
```

Expected: `No migrations to apply`, and **no** `Failed to auto-apply RLS policies after migrate` line. Nothing has been demoted yet, so a running dev server is harmless at this point; Task 5 Step 1 is where it must stop.

---

### Task 4: Point the test suite at the bypassed role — before anything is demoted

The suite moves to `academiai_test` first, while `academiai` is still a superuser, so the two variables are separated. If any test secretly needed *superuser* rights rather than merely the RLS bypass, this task finds out with the runtime role untouched and no recovery needed. The demotion itself is Task 5.

Measured scope of what this is papering over, so nobody mistakes the shim for a fix: **31 test files contain ~280 direct `Model.objects.create()` calls on the 42 tenant-scoped models with no `tenant_scope()` in the file** — `common/tests/test_dashboards.py` (41), `academics/tests/test_content_intelligence.py` (24), `notifications/tests/test_notifications_api.py` (23), `calendar/tests/test_plan_calendar_sync.py` (20), the legacy `agent/tests.py` (11) and `assessments/tests.py` (7), and 25 more. Converting them is its own follow-up plan, which ends by dropping `academiai_test`.

**Files:**
- Modify: `backend/conftest.py` (add one hook above the existing fixture)

**Interfaces:**
- Consumes: role `academiai_test` from Task 3.
- Produces: every pytest database connection authenticated as `academiai_test`, and the `POSTGRES_TEST_USER` escape hatch (`POSTGRES_TEST_USER=` runs the suite as the runtime role — the follow-up plan's lever). Task 6's tripwire test asserts this state rather than assuming it.

- [ ] **Step 1: Confirm the suite is green while the connection is still a superuser**

```
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

Expected: green. This is the baseline the next two steps are compared against; if it is not green to begin with, stop and report which tests already fail.

> Measured on execution (2026-09-22, commit `f2d7a05`): **not** green — `3 failed, 266 passed`. All three are pre-existing and role-independent (`apps/common/dashboard.py:893` missing `CourseEnrollment` import; two `test_material_experience.py` preview tests stale against the `content_path` contract in `apps/resources/views.py:521-535`). The controller ruled they stay out of this plan; the steps below are compared against that 3-failure baseline. See the ledger's Task 4 ruling.

- [ ] **Step 2: Add the hook**

`config/settings.py:152` builds `DATABASES["default"]["USER"]` from `os.getenv("POSTGRES_USER", "academiai")` at settings-import time, and pytest-django imports settings inside `pytest_load_initial_conftests` — before this conftest's own module body runs. So setting an environment variable at module level here is too late, and mutating `settings.DATABASES` from a `pytest_configure` hook is not: it runs before `django_db_setup` creates any database. Append to `backend/conftest.py`:

```python
def pytest_configure(config):
    """Run the test databases as the BYPASSRLS role, not the runtime role.

    The runtime role `academiai` is NOBYPASSRLS by design, and ~280 direct
    Model.objects.create() calls in 31 test files still write tenant-scoped rows
    outside tenant_scope(). They pass only because this connection skips RLS.
    apps/common/tests/test_rls.py opts out with SET ROLE academiai, and
    test_suite_connection_bypasses_rls is the tripwire that fails when the
    conversion plan lands and this shim should be deleted.

    POSTGRES_TEST_USER= (empty) runs the suite as the runtime role instead.
    """
    import os

    from django.conf import settings
    from django.db import connections

    user = os.environ.get("POSTGRES_TEST_USER", "academiai_test")
    if not user:
        return
    settings.DATABASES["default"].update(
        USER=user, PASSWORD=os.environ.get("POSTGRES_TEST_PASSWORD", user)
    )
    # `connections` snapshots DATABASES into a copy on first access; drop the
    # snapshot so the next read picks the update up. Verified on Django 6.1:
    # BaseConnectionHandler.settings is a cached_property that re-derives from
    # django_settings.DATABASES when the cache is gone.
    try:
        del connections.settings
    except AttributeError:
        pass
```

- [ ] **Step 3: Run `test_rls.py` and read the failure as the proof**

```
cd backend
.\.venv\Scripts\python.exe -m pytest apps/common/tests/test_rls.py -o addopts="--create-db" -q
```

Expected: the three behaviour tests error with `permission denied to create role` (its fixture's `CREATE ROLE "rls_tester"`, `test_rls.py:77`). That failure is the evidence the role swap took effect: the session user is now a role without `CREATEROLE`. `test_rls_table_list_is_derived` still passes — it touches no role state. Do not fix this file here; Task 6 replaces it.

- [ ] **Step 4: Prove the rest of the suite does not need superuser rights**

```
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

Expected: everything passing except `apps/common/tests/test_rls.py` and the three
known pre-existing failures from Step 1's measured baseline (measured on execution:
`263 passed, 3 failed, 3 errors` — the 3 errors being exactly `test_rls.py`'s
behaviour tests, which is the correct delta). That is the whole point of doing this before Task 5 — a fresh per-worker test database is now built by a non-superuser, migrations run as it, and ~280 unscoped writes succeed only because `BYPASSRLS` is set. Anything that still needs a true superuser shows up here as `must be superuser to create extension "vector"` or a `permission denied` on a schema/table; report the exact statement instead of granting up.

- [ ] **Step 5: Commit**

```
# from the repository root
git add backend/conftest.py
git commit -m "test(db): run pytest databases as the BYPASSRLS academiai_test role"
```

---

### Task 5: Move ownership, then strip the privilege — in that order

`GRANT USAGE, CREATE ON SCHEMA public` and even schema ownership do not let a role run `ALTER TABLE` on a table it does not own. Part C's future `0007` migration runs `ALTER TABLE quiz_questions ADD COLUMN`; if `academiai` were demoted while `academiai_app` still owned 47 tables, that migration would die with `must be owner of table quiz_questions`. Ownership moves first.

**Each command in Steps 2, 4 and 6 changes live state. Get an explicit yes per step.**

> **Executed 2026-09-24 — this task needed a different mechanism on a volume where the
> app role IS the bootstrap superuser.** If `SELECT oid, rolname FROM pg_authid WHERE
> oid = 10` returns `academiai` (true on any volume initialized under the old
> `POSTGRES_USER: academiai`), then Step 4's `ALTER ROLE ... NOSUPERUSER` fails with
> `permission denied to alter role / The bootstrap user must have the SUPERUSER
> attribute`, and Step 2's `REASSIGN OWNED` for that role fails with `objects ...
> required by the database system`. PostgreSQL will not let either happen, so
> `01-app-role.sql:22-26`'s defensive branch is unexecutable on such a volume
> permanently. The approved substitute (same end state, names unchanged, data
> untouched): rename the bootstrap role out of the way, create the runtime role
> under the documented name, and move ownership per-relation instead of by role:
> `ALTER ROLE academiai RENAME TO academiai_bootstrap`; `CREATE ROLE academiai LOGIN
> PASSWORD 'academiai' NOSUPERUSER NOCREATEROLE NOREPLICATION NOBYPASSRLS CREATEDB`;
> `GRANT ALL PRIVILEGES ON DATABASE academiai TO academiai`; then a `DO` block running
> `ALTER TABLE ... OWNER TO academiai` for every `relkind='r'` row in `public`
> (do NOT target `relkind='S'` — a table-owned sequence cannot be re-owned
> independently; it follows its table); `ALTER SCHEMA public OWNER TO academiai`; and
> `GRANT academiai TO academiai_test`, which is load-bearing because an existing
> membership grant follows the *renamed* role, so Task 6's `SET ROLE academiai` would
> otherwise fail. Verify with `psql -U academiai -c "SELECT usesuper, usebypassrls FROM
> pg_user WHERE usename=CURRENT_USER"` → `f|f`. The residue is an inert
> `academiai_bootstrap` superuser that cannot be dropped; mark it `NOLOGIN` only if
> the human asks. On a fresh volume (`POSTGRES_USER: postgres`, the current compose)
> none of this applies — Steps 2 and 4 work as written.

**Files:** none — database state only.

**Interfaces:**
- Consumes: role `postgres` from Task 3.
- Produces: `academiai` as the sole owner of every relation, sequence and the `public` schema, and as `NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOREPLICATION` — the posture Task 6's tests assert through `SET ROLE`.

- [ ] **Step 1: Stop anything holding the database**

Tell the human: stop `manage.py runserver` and any Celery worker before Step 4, because the demotion takes effect for new connections and an in-flight request can fail confusingly mid-change. Existing connections keep the old attributes until they reconnect.

- [ ] **Step 2: Reassign everything the abandoned role owns**

```
docker compose exec -T db psql -U postgres -d academiai -c "REASSIGN OWNED BY academiai_app TO academiai"
```

Expected: `REASSIGN OWNED`.

- [ ] **Step 3: Verify ownership, including the schema**

```
docker compose exec -T db psql -U postgres -d academiai -c "SELECT pg_get_userbyid(relowner) AS owner, count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r','S') GROUP BY 1"
docker compose exec -T db psql -U postgres -d academiai -c "SELECT nspname, pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname = 'public'"
```

Expected: a single owner row, `academiai`, covering the 66 relations plus sequences; and `public | academiai`. **`REASSIGN OWNED` is not assumed to cover the schema** — if the second query still says `academiai_app`, run the explicit statement the init script intends (`01-app-role.sql:32`), after approval:

```
docker compose exec -T db psql -U postgres -d academiai -c "ALTER SCHEMA public OWNER TO academiai"
```

Then re-run the check and expect `public | academiai`.

- [ ] **Step 4: Strip the privilege last**

```
docker compose exec -T db psql -U postgres -d academiai -c "ALTER ROLE academiai NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOREPLICATION LOGIN"
```

`CREATEDB` is deliberately **not** revoked: pytest-django creates one database per xdist worker and `01-app-role.sql:17` grants `CREATEDB` for exactly that reason. The init script's defensive branch (`:22-26`) omits `NOCREATEDB` too — this command mirrors it.

- [ ] **Step 5: Verify the posture**

```
docker compose exec -T db psql -U postgres -d academiai -c "SELECT rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication FROM pg_roles WHERE rolname IN ('academiai','academiai_app') ORDER BY 1"
```

Expected: `academiai` → `rolsuper=f rolbypassrls=f rolcreaterole=f rolcreatedb=t rolreplication=f`. This is the first moment RLS is genuinely active for real traffic in this environment.

- [ ] **Step 6: Confirm the application still serves and migrates as the demoted role**

```
cd backend
.\.venv\Scripts\python.exe manage.py migrate
```

Expected: `No migrations to apply`, no `Failed to auto-apply RLS policies after migrate`. Then the request path:

```
.\.venv\Scripts\python.exe manage.py runserver
```

and in a second terminal:

```
curl -s -o NUL -w "%{http_code}" http://localhost:8000/api/v1/auth/me/
```

Expected: `401` (unauthenticated but served) — the exemption of `accounts_user` and `tenants_tenant` is what keeps a tenantless auth lookup alive. A `500` means a request path depends on the bypass: read the traceback and fix the missing `tenant_scope()`, do not re-elevate. Leave the server running for Task 7 Step 1 only if it got this far; otherwise report and stop.

- [ ] **Step 7: If anything failed halfway, recover**

The recovery is additive and destroys nothing — re-elevate through `postgres`, fix the failing statement, re-run:

```
docker compose exec -T db psql -U postgres -d academiai -c "ALTER ROLE academiai SUPERUSER"
```

Report the failure to the human rather than retrying blind three times.

---

### Task 6: Make `test_rls.py` prove enforcement instead of assuming a bypass

`apps/common/tests/test_rls.py` was written against the opposite premise — its docstring says "Django's normal test DB role is a SUPERUSER" (`:5-7`) — so it creates a `rls_tester` role (`:77`) and grants `academiai` to it (`:81`). Both need `CREATEROLE`, which Task 5 removed, so the file has been red since Task 4 Step 3. It also *built its own policies* (`:87-96`) and dropped them on teardown (`:105-107`), which is why it configured RLS rather than checking that RLS was configured.

The replacement keeps the three behaviour assertions, gets the elevation from `SET ROLE academiai` (membership from Task 3, no `CREATEROLE` needed), adds a posture guard that fails loudly unless the **runtime** role is demoted and every tenant-scoped table is ENABLE + FORCE + `tenant_isolation`, and adds one tripwire test that documents the suite's remaining bypass.

**Files:**
- Modify: `backend/apps/common/tests/test_rls.py` (full rewrite; the first test is carried over unchanged)
- Modify: `backend/conftest.py` (one docstring line — see Step 5)

**Interfaces:**
- Consumes: `apps.common.rls.TABLES` (the derived tenant-scoped table list), role `academiai` and its membership in `academiai_test` from Task 3, and the session role `academiai_test` from Task 4.
- Produces: a pytest fixture named `rls_enforced` that leaves the connection acting as `academiai`; no production code consumes it.

- [ ] **Step 1: Re-read the captured failure**

Open the Task 4 Step 3 output. The three behaviour tests must be failing on role privileges, not on collection errors — a collection error means the conftest hook did not take effect and Task 4 needs fixing first.

- [ ] **Step 2: Write the replacement file**

Replace the contents of `backend/apps/common/tests/test_rls.py` with:

```python
"""
Database-level RLS tests: prove PostgreSQL Row-Level Security denies
cross-tenant access even for direct ORM/raw queries.

The rest of the suite connects as `academiai_test`, which has BYPASSRLS so the
~280 tenant-scoped writes that have not been converted to tenant_scope() keep
working. Nothing in this file runs under that bypass: `rls_enforced` does
`SET ROLE academiai` — the role that owns the schema and serves production
traffic — and every assertion below is made through it. Membership in
`academiai` is granted once by the remediation plan (Task 3), so no CREATEROLE
is needed here, and `test_suite_connection_bypasses_rls` records the gap this
file deliberately does not paper over.

Why that role and not another: `academiai` owns the tables, and a table owner
is exempt from its own policies unless the table FORCES them
(`apps/common/rls.py:81-84`). Testing any other identity would test a posture
the application never runs in.

Policies are already enabled and FORCE'd by the migration graph
(`apps/common/migrations/0001_rls_tenant_isolation.py` plus the `post_migrate`
receiver in `apps/common/apps.py`); the posture guard below checks that and
says so, instead of quietly re-creating what it is supposed to verify.

The table list is NOT maintained here — it comes from the single source of
truth ``apps.common.rls.TABLES`` (derived from the model registry), so adding
a tenant-scoped model automatically extends both the policies and this test.
"""
import pytest
from contextlib import contextmanager
from django.db import connection

from apps.academics.models import Faculty
from apps.tenants.models import Tenant
from apps.common.rls import TABLES as RLS_TABLES

RUNTIME_ROLE = "academiai"


def _rows(sql, params=None):
    with connection.cursor() as cursor:
        cursor.execute(sql, params or [])
        return list(cursor.fetchall())


def _scalar(sql, params=None):
    rows = _rows(sql, params)
    return rows[0][0] if rows and rows[0] else None


def _set_tenant(tenant_id):
    _scalar("SELECT set_config('app.current_tenant_id', %s, false)", [str(tenant_id)])


def _clear_tenant():
    _scalar("SELECT set_config('app.current_tenant_id', '', false)")


def test_rls_table_list_is_derived():
    """RLS coverage must come from the model registry, never a hand list.

    Every tenant-scoped model (TenantScopedModel subclass, or any other table
    with a tenant_id column) must appear in TABLES; the only tenant-bearing
    exemptions are the two platform identity tables.
    """
    from django.apps import apps as django_apps

    from apps.common.models import TenantScopedModel
    from apps.common import rls

    assert rls.TABLES == rls.derive_tenant_scoped_tables()

    for model in django_apps.get_models():
        if model._meta.abstract or not model._meta.managed:
            continue
        label = f"{model._meta.app_label}.{model._meta.model_name}"
        tenant_bearing = any(f.attname == "tenant_id" for f in model._meta.fields)
        if issubclass(model, TenantScopedModel) or tenant_bearing:
            if label in rls.EXEMPT_TENANT_BEARING_MODELS:
                continue
            assert model._meta.db_table in rls.TABLES, (
                f"{label} is tenant-scoped but missing from RLS policy tables"
            )

    # Deliberate exemptions are exactly the two platform identity tables.
    assert rls.EXEMPT_TENANT_BEARING_MODELS == {"accounts.user", "tenants.tenant"}


@pytest.mark.django_db
def test_runtime_role_is_demoted():
    """The role real traffic uses must not be able to skip RLS.

    Cluster-wide catalog state, so it holds in a test database as much as in
    the developer's. If this fails, someone ran
    `ALTER ROLE academiai SUPERUSER` and every isolation guarantee is fiction.
    """
    flags = _rows(
        "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = %s",
        [RUNTIME_ROLE],
    )
    assert flags, f"role {RUNTIME_ROLE} does not exist"
    assert not flags[0][0], "the runtime role is a superuser, which bypasses RLS"
    assert not flags[0][1], "the runtime role has BYPASSRLS"


@pytest.mark.django_db
def test_suite_connection_bypasses_rls():
    """Tripwire for the shim in conftest.py, not an assertion of intent.

    The suite runs as a BYPASSRLS role because 31 files still write
    tenant-scoped rows outside tenant_scope(). When that conversion lands, this
    test fails — and the fix is to delete it and the conftest hook, not to make
    it pass some other way.
    """
    assert _scalar("SELECT current_user") != RUNTIME_ROLE
    assert _scalar(
        "SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user"
    ), "the test connection no longer bypasses RLS: the conversion is done"


def _posture_problems():
    """Return reasons RLS is not genuinely configured in this database."""
    problems = []
    if _scalar("SELECT rolsuper FROM pg_roles WHERE rolname = %s", [RUNTIME_ROLE]):
        problems.append(f"{RUNTIME_ROLE} is a superuser and would skip every policy")
    if _scalar("SELECT rolbypassrls FROM pg_roles WHERE rolname = %s", [RUNTIME_ROLE]):
        problems.append(f"{RUNTIME_ROLE} has BYPASSRLS and would skip every policy")

    state = {
        row[0]: (row[1], row[2])
        for row in _rows(
            "SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity "
            "FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = 'public' AND c.relkind = 'r'"
        )
    }
    # A table with RLS enabled but no policy is not filtered, it is simply
    # empty for everyone — a confusing way to pass an isolation test.
    policed = {
        row[0]
        for row in _rows(
            "SELECT tablename FROM pg_policies WHERE schemaname = 'public' "
            "AND policyname = 'tenant_isolation'"
        )
    }
    missing = [t for t in RLS_TABLES if t not in state]
    if missing:
        problems.append(f"tenant-scoped tables absent from the schema: {sorted(missing)}")
    unforced = [t for t in RLS_TABLES if t in state and not all(state[t])]
    if unforced:
        problems.append(
            "tables without RLS ENABLED + FORCED (an owner bypasses a policy it "
            f"does not force): {sorted(unforced)}"
        )
    unpolicied = [t for t in RLS_TABLES if t in state and t not in policed]
    if unpolicied:
        problems.append(f"tables with no tenant_isolation policy: {sorted(unpolicied)}")
    return problems


@contextmanager
def _as_runtime_role():
    with connection.cursor() as cursor:
        cursor.execute(f'SET ROLE "{RUNTIME_ROLE}"')
        try:
            yield
        finally:
            cursor.execute("RESET ROLE")


@pytest.fixture
def rls_enforced(transactional_db):
    """Configure the session to act as the runtime role, then hand it over.

    Two things the test database needs that production already has: the
    privileges (this database's objects belong to `academiai_test`, which built
    them) and the demoted posture (asserted before switching, so a
    re-elevated `academiai` fails loudly here rather than passing vacuously).
    The GUC is cleared on teardown because it is session-scoped; the role
    context manager resets itself.
    """
    with connection.cursor() as cursor:
        cursor.execute(f'GRANT USAGE ON SCHEMA public TO "{RUNTIME_ROLE}"')
        cursor.execute(
            f'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "{RUNTIME_ROLE}"'
        )
        cursor.execute(
            f'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "{RUNTIME_ROLE}"'
        )

    problems = _posture_problems()
    assert not problems, "RLS is not enforced for the runtime role:\n- " + "\n- ".join(problems)

    with _as_runtime_role():
        yield
    _clear_tenant()


@pytest.mark.django_db(transaction=True)
def test_rls_blocks_cross_tenant_reads(rls_enforced):
    ta = Tenant.objects.create(name="A", slug="a-rls")
    tb = Tenant.objects.create(name="B", slug="b-rls")

    _set_tenant(ta.id)
    Faculty.objects.create(tenant=ta, name="Fac A", code="FA")
    _set_tenant(tb.id)
    Faculty.objects.create(tenant=tb, name="Fac B", code="FB")

    _set_tenant(ta.id)
    assert set(Faculty.objects.values_list("code", flat=True)) == {"FA"}

    _set_tenant(tb.id)
    assert set(Faculty.objects.values_list("code", flat=True)) == {"FB"}

    _clear_tenant()
    assert Faculty.objects.count() == 0


@pytest.mark.django_db(transaction=True)
def test_rls_blocks_insert_without_tenant_context(rls_enforced):
    from django.db.utils import IntegrityError, ProgrammingError

    ta = Tenant.objects.create(name="A2", slug="a2-rls")
    _clear_tenant()
    with pytest.raises((IntegrityError, ProgrammingError)):
        Faculty.objects.create(tenant=ta, name="NoCtx", code="NC")


@pytest.mark.django_db(transaction=True)
def test_rls_blocks_cross_tenant_updates(rls_enforced):
    ta = Tenant.objects.create(name="A3", slug="a3-rls")
    tb = Tenant.objects.create(name="B3", slug="b3-rls")

    _set_tenant(tb.id)
    Faculty.objects.create(tenant=tb, name="Fac B3", code="FB3")

    _set_tenant(ta.id)
    assert Faculty.objects.filter(code="FB3").update(name="Hacked") == 0

    _set_tenant(tb.id)
    assert Faculty.objects.get(code="FB3").name == "Fac B3"
```

- [ ] **Step 3: Run the file under real enforcement**

```
cd backend
.\.venv\Scripts\python.exe -m pytest apps/common/tests/test_rls.py -o addopts="--create-db" -q
```

Expected: 6 passed. Two ways this can fail that are the environment's fault, not the test's, and how to read them: `permission denied for table …` inside a behaviour test means the fixture's `GRANT` ran but `academiai` is not a member of what it needs — check Task 3 Step 5's membership row; `role "academiai" is not permitted to connect`-style errors mean something re-ran `ALTER ROLE ... NOLOGIN`. If the posture guard fails instead, it is reporting a genuine gap (a table without FORCE, a missing policy, or a re-elevated role) — fix that cause; do not weaken the assertion.

- [ ] **Step 4: Prove the guard actually fails on a bypassed connection**

The two-sided check from the spec, run as one command so the guard is seen doing its job rather than trusted:

```
docker compose exec -T db psql -U postgres -d academiai -c "ALTER ROLE academiai BYPASSRLS"
cd backend
.\.venv\Scripts\python.exe -m pytest apps/common/tests/test_rls.py -o addopts="--create-db" -q -k "runtime_role_is_demoted or cross_tenant_reads"
docker compose exec -T db psql -U postgres -d academiai -c "ALTER ROLE academiai NOBYPASSRLS"
.\.venv\Scripts\python.exe -m pytest apps/common/tests/test_rls.py -o addopts="--create-db" -q -k "runtime_role_is_demoted or cross_tenant_reads"
```

Expected: the first run fails both tests — `test_runtime_role_is_demoted` on the posture, and the read test because a bypassing role sees both tenants' rows. The second run passes both. Then confirm the attribute is back to `f` with Task 5 Step 5's query, and paste both outputs into the task notes.

> **Executed 2026-09-24 — both sides behaved, but the read test fails one layer
> earlier than the wording predicts.** With `academiai` re-elevated:
> `1 failed, 4 deselected, 1 error` — `test_runtime_role_is_demoted` FAILED on
> `AssertionError: the runtime role has BYPASSRLS` (`test_rls.py:102`), and
> `test_rls_blocks_cross_tenant_reads` ERRORed in the `rls_enforced` fixture with
> `RLS is not enforced for the runtime role: - academiai has BYPASSRLS and would
> skip every policy` (`test_rls.py:191`). So the elevation is caught by the
> posture guard *before* the row-visibility assertion is ever reached — the
> bypass is rejected rather than demonstrated through a leaked read. Either way
> the guard is proven not to pass vacuously. After `NOBYPASSRLS`:
> `2 passed, 4 deselected`. Full file under enforcement: `6 passed`. Final
> `pg_roles` check: `academiai` → `rolsuper=f rolbypassrls=f`, `academiai_test`
> → `rolbypassrls=t`, `postgres` → `rolsuper=t`.

- [ ] **Step 5: Correct the conftest docstring now that the tripwire exists**

Task 4's hook docstring (`backend/conftest.py:33`) says `POSTGRES_TEST_USER= (empty) runs the suite as the runtime role instead.` That invocation is POSIX-only: in PowerShell — the human's documented shell — `$env:POSTGRES_TEST_USER=""` *removes* the variable, so `os.environ.get` falls back to the `"academiai_test"` default and the suite runs with the bypass while the operator believes it does not. The follow-up conversion plan verifies itself with this lever, so a silently inverted lever is worse than a cosmetic doc problem.

Replace that one line with both working forms:

```
    Run the suite as the runtime role instead with POSTGRES_TEST_USER=academiai
    (PowerShell: $env:POSTGRES_TEST_USER="academiai"). An empty value also works,
    but only from a POSIX shell — PowerShell deletes the variable on "".
```

Keep the rest of the docstring as Task 4 wrote it; Step 2's new
`test_suite_connection_bypasses_rls` is what makes the existing
"tripwire" sentence refer to a test that is actually in the file.

- [ ] **Step 6: Full suite, then commit**

```
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

Expected: `test_rls.py` contributing 6 passes, and the rest of the suite matching the
baseline recorded in the ledger — **three known pre-existing failures**
(`test_dashboards.py::test_student_reminders_only_due_exams_and_milestones` from the
missing `CourseEnrollment` import at `apps/common/dashboard.py:893`, and the two
stale `test_material_experience.py` preview tests). The suite is not green on this
volume and this plan does not fix them; see the ledger's Task 4 ruling. A new failure
anywhere else is a signal the demotion broke something real — report it rather than
wrapping it in another bypass.

> Measured on execution (2026-09-24, commit `e988097`): **`3 failed, 268 passed`** —
> the same three tests named above and nothing else. Task 4 Step 4's 3 errors are
> gone, and 263 → 268 is exactly `test_rls.py` moving from 1 pass + 3 errors to
> 6 passes.

```
# from the repository root
git add backend/apps/common/tests/test_rls.py backend/conftest.py
git commit -m "test(rls): prove enforcement through the runtime role instead of assuming a bypass"
```

---

### Task 7: Prove isolation on the developer database and record the decision

The suite passing on per-worker databases is not the same as the developer database being filtered — and in the developer database `academiai` *owns* the tables, so this is the one place FORCE rather than `SET ROLE` is doing the work. This task checks that real one, then records what changed.

**Files:**
- Modify: `docs/DECISIONS.md` — section D3 at `:28-45`

**Interfaces:**
- Consumes: Task 5's demoted role, Task 6's suite at the recorded baseline, the running server restarted against it.
- Produces: a D3 correction (its first bullet currently claims `academiai` is the bootstrap superuser *and* the app role — a rename artifact from `ad92276`) plus the three-role posture and the deferred test conversion.

- [ ] **Step 1: Confirm the server serves tenant-scoped traffic as the demoted owner**

If Task 5 Step 6 left `runserver` running, restart it so it reconnects as the demoted role, then:

```
curl -s -o NUL -w "%{http_code}" http://localhost:8000/api/v1/calendar/events/upcoming/
```

Expected: `401` (unauthenticated but served). A `500` means an unauthenticated route reaches a tenant-scoped table without a GUC — that is a real bug the bypass was hiding; read the traceback.

- [ ] **Step 2: Prove the tenantless query returns nothing on the developer database**

> **Corrected at execution (Task 7 Step 2).** This step originally named
> `academics_faculty` and `tenants_tenant`. Neither relation exists: Django's
> default table naming in this project drops the app prefix, so the real names
> are `faculties` and `tenants`. The queries below are the corrected ones.

```
docker compose exec -T db psql -U academiai -d academiai -c "SELECT count(*) AS any_tenant FROM faculties"
docker compose exec -T db psql -U academiai -d academiai -c "SELECT set_config('app.current_tenant_id', (SELECT id::text FROM tenants ORDER BY 1 LIMIT 1), false) AS t; SELECT count(*) AS one_tenant FROM faculties"
```

Expected: the first is `0` — before this plan it returned every row. The second is the count for one tenant, which may also be 0 if that tenant has no faculties; if so, re-run it with a tenant id that does (`SELECT tenant_id, count(*) FROM academics_faculty GROUP BY 1` is itself filtered, so read a tenant id from `tenants_tenant`, which is exempt). If the seeded demo data is missing entirely, `manage.py seed_demo` repopulates it through the request-free path — note in the report whether it needed `tenant_scope()`, because that command is a known candidate.

- [ ] **Step 3: Confirm migrations still apply their own policies**

```
cd backend
.\.venv\Scripts\python.exe manage.py migrate
```

Expected: clean, and no `Failed to auto-apply RLS policies after migrate` line. That line is the specific failure mode `apps/common/apps.py:31-35` can swallow silently — its absence is the check.

```
docker compose exec -T db psql -U postgres -d academiai -c "SELECT count(*) AS policies, count(DISTINCT tablename) AS tables FROM pg_policies WHERE schemaname = 'public'"
```

Expected: `45 | 45`, matching the pre-fix measurement — the demotion must not have dropped policy coverage.

> **Executed 2026-09-24 (Steps 1-3), controller-measured.** All three passed.
> - Step 1: `runserver` restarted against the demoted owner; `GET /api/v1/calendar/events/upcoming/`
>   → `401`, `GET /api/v1/auth/me/` → `401`. Both served, neither raised.
> - Step 2: tenantless `SELECT count(*) FROM faculties` as `academiai` → **0**, where the
>   same query as `postgres` → **9** across 2 tenants. Bound to
>   `34d82f63-…` (Demo University) → **1**, which is exactly that tenant's share of the
>   9 (`8` belong to `dd2fa18c-…`). So the policy filters rather than blanks.
> - Step 3: `manage.py migrate` → `No migrations to apply`, and
>   `INFO [apps.common.apps] RLS enforced on 45 tenant-scoped tables` with no
>   `Failed to auto-apply` line. `pg_policies` → `45 | 45`.
> - Posture recheck at handoff: `academiai` `super=f bypass=f createrole=f createdb=t
>   replication=f login=t`; `academiai_test` `bypass=t`, member of `academiai` (needed
>   for `SET ROLE`) **and of `academiai_bootstrap`** — the latter is the stray left by
>   Task 5's rename (the membership followed the OID, not the name) and gives the dev
>   test role a path to superuser. Revoking it is pending a human yes.
>   `academiai_bootstrap` remains `super=t` (it is the initdb identity and cannot be
>   demoted); marking it `NOLOGIN` is likewise pending.

- [ ] **Step 4: Correct D3 in the decision log**

In `docs/DECISIONS.md`, the two bullets at `:36-39` currently both name `academiai`, which is a leftover of the `ad92276` rename and describes an impossible two-role model with one name. Replace that bullet pair with:

```markdown
- `postgres` — Docker bootstrap superuser, declared as `POSTGRES_USER` in
  `docker-compose.yml`. Owns nothing at runtime. A volume initialised before
  that rename has no `postgres` role at all and its `academiai` is the initdb
  superuser; `docs/superpowers/plans/2026-09-22-chat-send-fix-and-rls-enforcement.md`
  (Tasks 3-5) is the additive remediation.
- `academiai` — LOGIN, `NOSUPERUSER`, **NOBYPASSRLS**, `NOCREATEROLE`,
  `CREATEDB` (needed by pytest-django; revoke in production). Used by Django
  for migrations, runtime traffic, and — through `SET ROLE` — the isolation
  tests. It owns every relation in `public`, which is why migrations can run at
  all as a non-superuser.
- `academiai_test` — LOGIN, `BYPASSRLS`, `CREATEDB`, member of `academiai`.
  **Dev/CI only**, selected by `backend/conftest.py` for pytest databases. It
  exists because 31 test files still write tenant-scoped rows outside
  `tenant_scope()`; the follow-up conversion plan removes it. Never grant it to
  a deployment.
```

Then replace the paragraph at `:41-45` so it says what is true now:

```markdown
All tenant-scoped tables use `ENABLE ROW LEVEL SECURITY` +
`FORCE ROW LEVEL SECURITY` + a policy keyed on
`current_setting('app.current_tenant_id', true)`. Because the runtime role is
the table owner, FORCE is required and applied. Database-level tests
(`apps/common/tests/test_rls.py`) run `SET ROLE academiai`, assert that role is
neither superuser nor BYPASSRLS, assert every derived tenant-scoped table is
ENABLE + FORCE + policy-bearing, and then try to defeat isolation;
`test_suite_connection_bypasses_rls` records the suite's remaining bypass as a
tripwire to delete once the unscoped fixture writes are converted.

Two prerequisites this decision depends on, both measured rather than assumed:
`template1` must already carry the `vector` extension (pgvector is not
`trusted`, so a non-superuser cannot create it; `init/00-extensions.sql` puts it
there at first init), and a hosted deployment needs the same pre-install before
a non-superuser `academiai` can run `migrate`.
```

- [ ] **Step 5: Final verification, then commit**

```
cd backend
.\.venv\Scripts\python.exe -m pytest -q
cd ../frontend
npm run lint
npm run build
npm test
```

Expected: the backend run matches the ledger's recorded baseline — the three
pre-existing failures and nothing else — and lint, build and the frontend suite are
clean. Every claim of completion in the handoff report must quote actual output from
these commands, not intent, and must not describe the backend run as green.

```
# from the repository root
git add docs/DECISIONS.md
git commit -m "docs(decisions): correct D3 role model and record RLS enforcement posture"
```

- [ ] **Step 6: Ask about the leftover role, do not act on it**

`academiai_app` is **left in place**: after `REASSIGN OWNED` it is a live login that owns nothing, and removing it is a decision, not a side effect. Ask the human at handoff, offering the statement without running it:

```
docker compose exec -T db psql -U postgres -d academiai -c "DROP ROLE academiai_app"
```

Nothing in `backend/` references the name any more (the remaining hits are inside the stale `.kilo/worktrees/` copy), so dropping it is safe — but it is irreversible without a re-create, so it happens only on an explicit yes.

---

## Deferred by this plan, on purpose

Two things this plan deliberately does **not** do, so neither gets lost:

1. **Convert the 31 test files.** Their ~280 direct `Model.objects.create()` calls on tenant-scoped models need `with tenant_scope(tenant.id):` around the fixture writes, after which `academiai_test` is dropped and `conftest.py`'s hook deleted (its tripwire test fails first, which is the prompt). Its own plan, because a ~280-call mechanical diff is the worst possible thing to review on top of a security fix.
2. **Production migration prerequisites.** `00-extensions.sql` proves the extension cannot be created by a non-superuser, so a hosted deploy needs `vector` pre-installed by the provider, and the `CREATEDB` grant on `academiai` must be revoked there. Record it when the deployment plan is written.

## Completion report format

When every task is done, report to the human with:

1. The four chat test names and their actual vitest output.
2. The exact `pg_roles` rows for `academiai`, `academiai_test` and `postgres` (Task 3 Step 1 vs Task 5 Step 5 vs Task 3 Step 5).
3. Task 4 Step 4's full-suite result — the number of failures and which files, which is the size of the deferred conversion.
4. Task 6 Step 4's two runs, showing the guard failing on a bypassed role and passing on the demoted one.
5. Task 7 Step 2's two counts — the number that proves isolation is real on the developer database.
6. Any step skipped, and why. Never describe a step as done without the output that shows it.
