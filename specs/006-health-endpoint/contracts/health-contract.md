# Contract: Health Endpoint (HTTP)

**Feature**: `006-health-endpoint` | **Date**: 2026-08-03

Contract between the node web-service app (`deploy/discord-agent`) and any external prober (UptimeRobot,
Render health check, curl) for the `/health` endpoint.

## Endpoint

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Primary liveness + readiness probe. |
| `GET` | `/` | Root catch-all; returns the same 200 so pinger/monitors that only check the root URL work. |

## Response contract

| Case | HTTP status | Body (`application/json`) |
|------|-------------|---------------------------|
| Healthy (agent + bridge up) | `200` | `{ "status": "ok", "agent": "up", "bridge": "up" }` |
| Degraded (agent or bridge down) | `503` | `{ "status": "degraded", "agent": "up"\|"down", "bridge": "up"\|"down" }` |

### Status code semantics (must stay stable)

- **`2xx` = Up** — required so UptimeRobot (free tier, non-customizable) counts the service as up and
  renders it healthy.
- **`5xx` (incl. `503`) = Down** — signals real readiness failure so the monitor alerts. This is
  intentional, not a bug (FR-005 / SC-003).

## Behavior rules

- Must respond within **5 seconds** (Render health-check timeout and UptimeRobot bounds).
- Must be reachable from the **public** `https://<app>.onrender.com` URL (not localhost-only).
- Must not be rate-limited by per-probe work: it reads only in-memory state, no I/O, no external calls.
- `GET /health` is the canonical monitor target; `GET /` is a convenience for root-only pingers.

## Implementation reference (current, satisfying the contract)

`deploy/discord-agent/src/health.js` — `createHealthApp(state)` spawns an Express app. The one change
for this feature: add `app.get('/', ...)` returning the same `200`/`ok` body as `/health`.

## Related

- Runtime config/entities: `../data-model.md`
- Validation guide: `../quickstart.md`
