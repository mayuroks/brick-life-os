# Research: Health Endpoint for Uptime Monitoring

**Feature**: `006-health-endpoint` | **Date**: 2026-08-03

## Decisions

### D1. Keep-alive monitor: UptimeRobot (free), HTTP(s) monitor, 5-minute interval

**Decision**: Use UptimeRobot's free tier — an **HTTP(s)** monitor pointed at the public
`https://<app>.onrender.com/health` URL, checking every **5 minutes** (the free-tier minimum),
alerting via **Email and Discord**.

**Rationale**: 
- Render free tier spins down after **15 min** of no inbound traffic; a 5-min ping keeps it awake
  with a **3× safety margin** (5 < 15). This is the cheapest reliable way to satisfy the keep-alive
  goal.
- Free plan gives **50 monitors** — one is all we need. Email + Discord alerts are free.
- `/health` already returns `200`/`ok` when healthy, and UptimeRobot counts 2xx–3xx as **Up** — a
  clean match with no paid customization.

**Alternatives considered**:
- **60-second interval (UptimeRobot Solo, ~$10/mo)** — tighter margin, but paid and unnecessary given
  the 15-min window. Rejected: prototype pragmatism (constitution IV).
- **Other free pingers (cron-job.org, Kaffeine-style repo watchers, Google Apps Script)** — viable but
  add an extra moving part, scheduler, or signup; UptimeRobot is purpose-built for this, gives
  integrated Discord alerts, and is the tool the user named. Rejected as primary.
- **Render paid "starter" plan (guaranteed always-on)** — removes the sleep entirely but costs money.
  Deferred; the pinger is free and sufficient for the prototype.

### D2. Monitor target route must return 2xx when healthy

**Decision**: Keep the probe targeting `GET /health`, which returns `HTTP 200` with body
`{"status":"ok",...}` when agent + bridge are up.

**Rationale**: UptimeRobot free (HTTP(s) monitor) treats **2xx–3xx as Up** and any error status
(including **503**) as **Down**; free cannot customize which statuses count as up. So the endpoint
must return 2xx when healthy — it already does. Returning `503`/`degraded` when a dependency is down
correctly surfaces as an alert (FR-005/SC-003).

**Alternatives considered**:
- **Keyword monitor** (expects `ok` in body) — could catch a naive 200-always liveness response that
  ignores readiness. Not needed because the endpoint already reflects readiness via status codes, so
  a plain HTTP(s) status monitor is sufficient and simpler.
- **Always-200 liveness-only endpoint** — would defeat the readiness signal (US2). Rejected.

### D3. Render's own health check is NOT a keep-alive

**Decision**: Do not rely on Render's `healthCheckPath` to keep the service awake; it is for
**deploy/restart** validation only.

**Rationale**: Render's health checks only run against an **already-running** instance and do not
wake a spun-down free service. A sleeping instance has nothing to probe. Thus an **external** pinger
hitting the public URL is required — exactly the feature's purpose. The existing `healthCheckPath:
/health` in `render.yaml` is kept (it earns correct deploy/restart behavior).

### D4. Answer on the root path too (small hardening)

**Decision**: Add a `GET /` handler to the health app that also returns `200`/`ok`.

**Rationale**: Some pingers/monitors only probe a site's root URL, and the spec edge case calls this
out ("ping service uses root path"). A `/` → 200 keeps such monitors happy. Note `/robots.txt` does
not wake Render free services, so we intentionally do not rely on disallow-route tricks. Cost is one
route; low risk.

## Key constraints & gotchas

- **Public URL required**: the monitor target is the `onrender.com` subdomain, never localhost.
- **`/robots.txt` won't wake Render**: point the monitor at `/health` (or `/`), not `/robots.txt`.
- **UptimeRobot UA**: sends `Mozilla/5.0+(compatible; UptimeRobot/2.0; ...)`; Render does not block
  it, and our app has no UA block — fine.
- **503 triggers an alert**: expected and desirable (readiness). Document so it is not reported as a
  false defect.
- **Free instance-hours**: a kept-awake free service consumes ~730 hours/mo (Render free cap 750);
  this is inherent to keeping it up 24/7 on free tier, not a defect. Noted in the README.
- **UptimeRobot data retention** on free is 3 months; no recurring notifications.

## Sources

- UptimeRobot pricing/feature matrix: https://uptimerobot.com/pricing/ (50 monitors free, 5-min min
  interval, free Email + Discord, Telegram paid).
- UptimeRobot FAQ (status handling): https://uptimerobot.com/faq/ (2xx–3xx Up; 5xx Down;
  customized statuses paid-only).
- Render free tier docs: https://render.com/docs/free (15-min idle spin-down, wake on inbound,
  ~1-min spin-up, 512 MB/0.1 CPU, 750 instance-hours, ephemeral fs).
- Render health checks: https://render.com/docs/health-checks (2xx–3xx healthy within 5 s; restarts
  after 60 s unhealthy; does not wake a sleeping service).
- Render web services: https://render.com/docs/web-services ($PORT=10000, public onrender.com URL).
