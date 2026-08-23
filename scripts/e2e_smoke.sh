#!/usr/bin/env bash
# End-to-end smoke against a running stack (backend on :8000).
set -euo pipefail
BASE="${API_BASE:-http://localhost:8000/api/v1}"

echo "== health =="
curl -sf "$BASE/health/" | head -c 200
echo

echo "== signup (may fail if exists) =="
EMAIL="smoke_$(date +%s)@demo.local"
curl -s -X POST "$BASE/auth/signup/" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"SmokeTest123!\",\"first_name\":\"Smoke\",\"tenant_slug\":\"demo-uni\",\"role\":\"student\"}" || true
echo

echo "== login (seed admin) =="
LOGIN=$(curl -s -X POST "$BASE/auth/login/" -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.local","password":"DemoAdmin123!"}' || true)
echo "$LOGIN" | head -c 300
echo
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access') or json.load(open('/dev/stdin')).get('tokens',{}).get('access',''))" 2>/dev/null || true)
# simpler extract
TOKEN=$(python3 -c "import json,os; d=json.loads('''$LOGIN'''); print(d.get('access') or (d.get('data') or {}).get('access') or '')" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  echo "Could not parse access token; check login response shape and seed_demo."
  exit 1
fi

auth() { curl -s -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' "$@"; }

echo "== me =="
auth "$BASE/auth/me/" | head -c 200
echo

echo "== list resources =="
auth "$BASE/resources/" | head -c 200
echo

echo "== list quizzes =="
auth "$BASE/quizzes/" | head -c 200
echo

echo "Smoke HTTP checks finished."
