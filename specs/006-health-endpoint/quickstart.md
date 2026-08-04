# Quickstart: Health Endpoint for Uptime Monitoring — Validation Guide

**Feature**: `006-health-endpoint` | **Date**: 2026-08-03

Purpose: validate that the `/health` endpoint is externally reachable and correctly reflects readiness,
then set up a free ping/uptime monitor (UptimeRobot, cron-job.org, or any equivalent) as a keep-alive.
Manual acceptance suffices per the constitution.

## Prerequisites

- The `005` deployed service is live on Render (public `https://<app>.onrender.com`).
- An account on a free ping/uptime monitor service (e.g. UptimeRobot) for the monitor + alerts.
- Access to the Render service to check logs/restart where needed.

## 1. Verify the endpoint locally (FR-001, FR-002, FR-005)

Boot the service locally (or hit the live URL) and confirm the health contract:
`contracts/health-contract.md`.

**Healthy path** (bridge connected + agent up):

```text
curl -i http://localhost:3000/health
# expect 200  and  {"status":"ok","agent":"up","bridge":"up"}
```

**Degraded path** (e.g., before the bridge connects, or kill the agent): expect `503` and
`{"status":"degraded",...}` — this proves ready-state reflection (FR-005 / SC-003).

> Note: the canonical probe path is `/health`. This feature intentionally does not add a root `/`
> route (see plan); point your monitor at `/health`. Do **not** use `/robots.txt` — Render answers it
> without waking the service.

## 2. Verify the endpoint is publicly reachable (FR-003)

From a machine outside Render:

```text
curl -i https://<app>.onrender.com/health
```

**Expected**: `200` and `{"status":"ok",...}` (not connection-refused, not a `localhost` bind).

## 3. Set up the keep-alive monitor (FR-006)

Follow `contracts/uptimerobot-monitor.md` (UptimeRobot is one example; any equivalent free monitor with
a <15-min interval and status-based up/down works — adapt the steps to your chosen service):

1. In your monitor service, **Add New Monitor** → type **HTTP(s)** (or equivalent).
2. URL: `https://<app>.onrender.com/health`.
3. Interval: **5 minutes** (must be < 15 min; 5 min is a safe default).
4. Add alert contacts — **Email** and (optionally) **Discord** webhook.
5. Save; confirm the monitor reports **Up** (2xx = Up) on first check.

**Expected**: monitor goes **Up** (green). Subsequent state changes are visible in the monitor.

## 4. Confirm keep-alive prevents idle spin-down (SC-002)

1. Stop sending any direct traffic to the app.
2. Wait > 15 minutes of idle (only the monitor's 5-min pings hitting `/health`).
3. Send a Discord text message.
4. Confirm the bot replies in-channel without manual action.

**Expected**: the bot still answers after the idle window — proof the 5-min ping kept the Render service
awake (3× under the 15-min limit).

## 5. Confirm an outage is surfaced (SC-004)

- Optionally, stop the service (or intentionally break the bridge) and confirm the monitor flips to
  **Down** (503 counts as down) and sends the configured Email/Discord alert; restore and confirm it
  returns to Up.

## Related contracts

- Endpoint contract: `contracts/health-contract.md`
- Monitor contract: `contracts/uptimerobot-monitor.md`
- Runtime entities/data: `data-model.md`
