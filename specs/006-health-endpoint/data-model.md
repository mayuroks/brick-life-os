# Data Model: Health Endpoint for Uptime Monitoring

**Feature**: `006-health-endpoint` | **Date**: 2026-08-03

The feature is stateless — it introduces no persistent storage (matching the 005 ephemeral-filesystem
and prototype-pragmatism constraints). The only "data" is the in-process readiness state read by the
health endpoint and the HTTP response shape it exposes.

## Entity: Health readiness state

The health endpoint reads a small in-memory readiness state shared with the Discord bridge. There is
no persistence; the state is rebuilt on every process boot.

| Field | Type | Values | Meaning |
|-------|------|--------|---------|
| `agentUp` | boolean | `true` / `false` | Whether the headless agent ('opencode serve') is reachable/working. Starts `true`; set `false` when an agent call fails, `true` again on the next successful reply. |
| `bridgeUp` | boolean | `true` / `false` | Whether the Discord Gateway bridge is connected. Starts `false`; set `true` once the bridge logs in (`client.once('ready')`). |

### State transitions

- **Boot**: `{agentUp:true, bridgeUp:false}` → degraded until the bridge connects.
- **Bridge ready**: `bridgeUp` flips `false → true` → healthy (if agent is also up).
- **Agent failure** (agent call throws/timeout): `agentUp` flips `true → false` → degraded; restored on
  the next successful reply.
- **Process exit/restart**: state is lost and rebuilt on boot.

### Validation rules

- Overall status is **healthy** (`ok`) only when `agentUp === true && bridgeUp === true`.
- Any other combination → **degraded** (`503`).
- No external input; the state is internal and not user-modifiable.

## Entity: Health endpoint contract (HTTP surface)

The externally visible resource monitored by the ping service. Defined precisely in
`contracts/health-contract.md`.

| Attribute | Value |
|-----------|-------|
| Paths | `GET /health` (primary), `GET /` (root, for pinger coverage) |
| Healthy response | `200` + `{"status":"ok","agent":"up","bridge":"up"}` |
| Degraded response | `503` + `{"status":"degraded","agent":"up|down","bridge":"up|down"}` |
| Content-Type | `application/json` |

## Entity: Uptime monitor (external)

External to the repo — the free monitoring service (UptimeRobot) that probes the endpoint. Documented
as an operational entity so the setup is reproducible (FR-006).

| Attribute | Value |
|-----------|-------|
| Type | UptimeRobot HTTP(s) monitor |
| Target URL | `https://<app>.onrender.com/health` |
| Interval | 5 minutes (free-tier minimum; < 15-min Render idle window) |
| Up = | 2xx–3xx |
| Down = | 5xx (incl. 503) — represents readiness failure |
| Alerts | Email + Discord (free) |

## Relationships

```
Uptime monitor ──probes──▶ /health endpoint ──reads──▶ readiness state {agentUp, bridgeUp}
                                                              ▲
                                                     updated by the Discord bridge
```
