#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# e2e_smoke.sh — quick HTTP smoke check against a running AcademiAI backend.
#
# Usage:
#   ./scripts/e2e_smoke.sh                 # hits http://localhost:8000/api/v1
#   API_BASE=http://host:port/api/v1 ./scripts/e2e_smoke.sh
#
# Expects:
#   - Backend running (python manage.py runserver or gunicorn/uwsgi)
#   - Seed demo superuser admin@demo.local / DemoAdmin123! present
#     (created by python manage.py seed_demo)
#
# What it does:
#   1. GET  /health/
#   2. POST /auth/signup/  (random student; idempotent — fails if exists)
#   3. POST /auth/login/   (demo admin; extracts access token)
#   4. GET  /auth/me/
#   5. GET  /resources/
#   6. GET  /quizzes/
#
# Exit code 0 = all 200s after login. Non-zero = something failed.
# This is NOT a replacement for pytest/vitest — it's a 5-second gut-check
# after pulling/rebooting the stack.
# -----------------------------------------------------------------------------
set -euo pipefail

BASE="${API_BASE:-http://localhost:8000/api/v1}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@demo.local}"
ADMIN_PASS="${ADMIN_PASS:-DemoAdmin123!}"

# ---------- helpers ------------------------------------------------------------
log() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
ok()  { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
fail(){ printf '  \033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

check() {
  local url="$1"; shift
  local body
  body=$(curl -sS -o /tmp/smoke_body -w '%{http_code}' "$@" "$url") || fail "curl failed: $url"
  if [ "${body:0:1}" != "2" ] && [ "${body:0:1}" != "3" ]; then
    cat /tmp/smoke_body; echo
    fail "$url returned HTTP $body"
  fi
  head -c 220 /tmp/smoke_body; echo
}

# ---------- run ----------------------------------------------------------------
log "health"
check "$BASE/health/"
ok   "health endpoint reachable"

log "signup (random student — may already exist, that's fine)"
EMAIL="smoke_$(date +%s)@demo.local"
curl -sS -X POST "$BASE/auth/signup/" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"SmokeTest123!\",\"first_name\":\"Smoke\",\"tenant_slug\":\"demo-uni\",\"role\":\"student\"}" \
  -o /tmp/smoke_body -w '%{http_code}\n' || true
echo
ok   "signup attempted"

log "login as $ADMIN_EMAIL"
LOGIN=$(curl -sS -X POST "$BASE/auth/login/" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
TOKEN=$(python3 -c "import sys,json
d=json.loads(sys.stdin.read())
print(d.get('access') or (d.get('data') or {}).get('access') or '')" <<<"$LOGIN")
[ -n "$TOKEN" ] || { echo "$LOGIN" | head -c 400; echo; fail "could not parse access token from login response"; }
ok   "got access token (${#TOKEN} chars)"

auth() { curl -sS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' "$@"; }

log "auth/me"
check "$BASE/auth/me/" -H "Authorization: Bearer $TOKEN"
ok   "authenticated me"

log "resources"
check "$BASE/resources/" -H "Authorization: Bearer $TOKEN"
ok   "resources reachable"

log "quizzes"
check "$BASE/quizzes/" -H "Authorization: Bearer $TOKEN"
ok   "quizzes reachable"

echo
printf '\033[1;32mSmoke HTTP checks finished — backend looks healthy.\033[0m\n'
