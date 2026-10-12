"""
Performance measurement harness for AcademiAI.

Measures, against a running server (typically the load-test overlay on :8000):

  1. Non-AI API latency      — p50/p95/p99 over a set of read endpoints
  2. Chat time-to-first-token and end-to-end latency (SSE stream)
  3. Redis cache hit rate    — during a warm read workload
  4. Stepped concurrency     — peak concurrent users before SLA breach,
                               error rate under load, DB connection saturation

Usage:
    python scripts/measure_performance.py \
        --base-url http://localhost:8000 \
        --email muhammadelkufahn27@gmail.com --password 'Screenshot123!' \
        --out perf.json

It prints a summary and writes the raw per-request data to --out.

Note: concurrency numbers describe the machine they run on. Run against the
load-test overlay so DRF throttles do not confound the result, and report the
hardware alongside any figure.
"""
import argparse
import asyncio
import json
import statistics
import sys
import time
from pathlib import Path

import httpx

try:
    import redis as redis_lib
except Exception:  # pragma: no cover
    redis_lib = None

try:
    import psycopg
except Exception:  # pragma: no cover
    psycopg = None


def _pct(values, p):
    if not values:
        return None
    s = sorted(values)
    idx = min(len(s) - 1, max(0, int(round(len(s) * p)) - 1))
    return round(s[idx], 1)


def _stats(values):
    return {
        "n": len(values),
        "p50": _pct(values, 0.50),
        "p95": _pct(values, 0.95),
        "p99": _pct(values, 0.99),
        "mean": round(statistics.mean(values), 1) if values else None,
        "min": round(min(values), 1) if values else None,
        "max": round(max(values), 1) if values else None,
    }


def login(base, email, password):
    r = httpx.post(f"{base}/api/v1/auth/login/",
                   json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    return r.json()["access"]


def measure_latency(base, token, endpoints, samples):
    headers = {"Authorization": f"Bearer {token}"}
    out = {}
    with httpx.Client(base_url=base, headers=headers, timeout=30) as client:
        for name, path in endpoints:
            times, errors = [], 0
            for _ in range(samples):
                t0 = time.perf_counter()
                try:
                    r = client.get(path)
                    ms = (time.perf_counter() - t0) * 1000
                    if r.status_code >= 400:
                        errors += 1
                    else:
                        times.append(ms)
                except Exception:
                    errors += 1
            out[name] = {"path": path, "errors": errors, **_stats(times)}
    return out


def measure_chat(base, token, samples, question):
    headers = {"Authorization": f"Bearer {token}"}
    result = {"ttft_ms": [], "total_ms": [], "errors": 0, "samples": samples}
    with httpx.Client(base_url=base, headers=headers, timeout=120) as client:
        r = client.post("/api/v1/chat/sessions/", json={"title": "perf-measure"})
        r.raise_for_status()
        session_id = r.json()["id"]
        for _ in range(samples):
            url = f"/api/v1/chat/sessions/{session_id}/messages/stream/"
            t0 = time.perf_counter()
            ttft = None
            total = None
            try:
                with client.stream("POST", url, json={"content": question}) as resp:
                    if resp.status_code >= 400:
                        result["errors"] += 1
                        resp.read()
                        continue
                    for line in resp.iter_lines():
                        if line.startswith("event: token") and ttft is None:
                            ttft = (time.perf_counter() - t0) * 1000
                        elif line.startswith("event: error"):
                            result["errors"] += 1
                            break
                        elif line.startswith("event: done"):
                            total = (time.perf_counter() - t0) * 1000
                            break
            except Exception:
                result["errors"] += 1
                continue
            if ttft is not None:
                result["ttft_ms"].append(ttft)
            if total is not None:
                result["total_ms"].append(total)
    result["ttft_summary"] = _stats(result["ttft_ms"])
    result["total_summary"] = _stats(result["total_ms"])
    result["total_median"] = _pct(result["total_ms"], 0.50)
    return result


def _redis_stats():
    if redis_lib is None:
        return None
    try:
        c = redis_lib.from_url("redis://localhost:6379/0")
        info = c.info("stats")
        return int(info.get("keyspace_hits", 0)), int(info.get("keyspace_misses", 0))
    except Exception:
        return None


def measure_cache(base, token, reads):
    headers = {"Authorization": f"Bearer {token}"}
    with httpx.Client(base_url=base, headers=headers, timeout=30) as client:
        listing = client.get("/api/v1/resources/").json()
        items = listing.get("results", listing) if isinstance(listing, dict) else listing
        ids = [row["id"] for row in items if isinstance(row, dict) and row.get("id")]
        if not ids:
            return {"error": "no resources visible to this account"}
        ids = ids[:10]
        for rid in ids:  # warm
            client.get(f"/api/v1/resources/{rid}/")
        before = _redis_stats()
        for i in range(reads):
            client.get(f"/api/v1/resources/{ids[i % len(ids)]}/")
        after = _redis_stats()
    if not before or not after:
        return {"error": "redis stats unavailable"}
    hits = after[0] - before[0]
    misses = after[1] - before[1]
    total = hits + misses
    return {
        "reads": reads,
        "keyspace_hits": hits,
        "keyspace_misses": misses,
        "hit_rate": round(hits / total, 4) if total else None,
    }


def _db_conn():
    if psycopg is None:
        return None
    try:
        with psycopg.connect(host="localhost", port=5432, dbname="academiai",
                             user="academiai", password="academiai") as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM pg_stat_activity WHERE usename='academiai'")
                n = cur.fetchone()[0]
                cur.execute("SHOW max_connections")
                m = int(cur.fetchone()[0])
        return {"app_connections": n, "max_connections": m}
    except Exception:
        return None


async def _worker(client, paths, stop_at, latencies, errors):
    i = 0
    while time.perf_counter() < stop_at:
        path = paths[i % len(paths)]
        i += 1
        t0 = time.perf_counter()
        try:
            r = await client.get(path)
            ms = (time.perf_counter() - t0) * 1000
            if r.status_code >= 400:
                errors.append(1)
            else:
                latencies.append(ms)
        except Exception:
            errors.append(1)


async def _run_level(base, token, paths, concurrency, duration):
    latencies, errors = [], []
    limits = httpx.Limits(max_connections=concurrency + 10,
                          max_keepalive_connections=concurrency)
    stop_at = time.perf_counter() + duration
    async with httpx.AsyncClient(base_url=base, limits=limits, timeout=30,
                                 headers={"Authorization": f"Bearer {token}"}) as client:
        workers = [_worker(client, paths, stop_at, latencies, errors)
                   for _ in range(concurrency)]
        start = time.perf_counter()
        await asyncio.gather(*workers)
        elapsed = time.perf_counter() - start
    total = len(latencies) + len(errors)
    return {
        "concurrency": concurrency,
        "duration_s": round(elapsed, 2),
        "requests": total,
        "throughput_rps": round(total / elapsed, 1) if elapsed else None,
        "error_count": len(errors),
        "error_rate": round(len(errors) / total, 4) if total else None,
        **_stats(latencies),
    }


def measure_concurrency(base, token, levels, duration, p95_target=300.0, err_target=0.01):
    paths = ["/api/v1/health/", "/api/v1/chat/sessions/", "/api/v1/resources/"]
    rows = []
    peak_before_breach = 0
    first_breach = None
    for level in levels:
        row = asyncio.run(_run_level(base, token, paths, level, duration))
        row["db_connections"] = _db_conn()
        breach = (row["p95"] is not None and row["p95"] > p95_target) or \
                 (row["error_rate"] is not None and row["error_rate"] > err_target)
        row["breach"] = breach
        rows.append(row)
        if breach:
            first_breach = level
            break
        peak_before_breach = level
    return {
        "p95_target_ms": p95_target,
        "error_rate_target": err_target,
        "levels": rows,
        "peak_concurrency_before_breach": peak_before_breach,
        "first_breaching_level": first_breach,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:8000")
    ap.add_argument("--email", default="muhammadelkufahn27@gmail.com")
    ap.add_argument("--password", default="Khalifah@8442")
    ap.add_argument("--latency-samples", type=int, default=40)
    ap.add_argument("--chat-samples", type=int, default=5)
    ap.add_argument("--cache-reads", type=int, default=200)
    ap.add_argument("--levels", default="1,10,25,50,100,200")
    ap.add_argument("--concurrency-duration", type=float, default=10.0)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    base = args.base_url.rstrip("/")
    token = login(base, args.email, args.password)

    endpoints = [
        ("health", "/api/v1/health/"),
        ("me", "/api/v1/auth/me/"),
        ("chat_sessions", "/api/v1/chat/sessions/"),
        ("resources", "/api/v1/resources/"),
        ("concepts", "/api/v1/concepts/"),
    ]

    print("1/4 non-AI API latency ...")
    latency = measure_latency(base, token, endpoints, args.latency_samples)
    print("2/4 chat TTFT + end-to-end ...")
    chat = measure_chat(base, token, args.chat_samples,
                        "Summarize the key ideas in the course material.")
    print("3/4 redis cache hit rate ...")
    cache = measure_cache(base, token, args.cache_reads)
    levels = [int(x) for x in args.levels.split(",") if x.strip()]
    print(f"4/4 concurrency sweep {levels} ...")
    concurrency = measure_concurrency(base, token, levels, args.concurrency_duration)

    result = {
        "base_url": base,
        "account": args.email,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "latency": latency,
        "chat": chat,
        "cache": cache,
        "concurrency": concurrency,
    }

    print("\n=== Non-AI API latency (ms) ===")
    for name, s in latency.items():
        print(f"  {name:<16} p50={s['p50']} p95={s['p95']} p99={s['p99']} "
              f"n={s['n']} err={s['errors']}")
    print("\n=== Chat ===")
    print(f"  TTFT ms: {chat['ttft_summary']}")
    print(f"  end-to-end median ms: {chat['total_median']}  ({chat['total_summary']})")
    print("\n=== Cache ===")
    print(f"  {cache}")
    print("\n=== Concurrency ===")
    for row in concurrency["levels"]:
        print(f"  users={row['concurrency']:<4} rps={row['throughput_rps']:<7} "
              f"p95={row['p95']:<7} err={row['error_rate']} "
              f"db={row['db_connections']} breach={row['breach']}")
    print(f"  peak before breach: {concurrency['peak_concurrency_before_breach']} "
          f"(first breach: {concurrency['first_breaching_level']})")

    if args.out:
        Path(args.out).write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(f"\nwrote {args.out}")


if __name__ == "__main__":
    sys.exit(main())
