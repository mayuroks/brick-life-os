# Contract: UptimeRobot Keep-Alive Monitor

**Feature**: `006-health-endpoint` | **Date**: 2026-08-03

Contract for the external free monitoring service used to keep the Render free-tier service awake and
to surface outages. This is the FR-006 "documented setup" deliverable.

## Monitor configuration

| Setting | Value | Notes |
|---------|-------|-------|
| Service | UptimeRobot (free tier) | 50 free monitors max; we use 1 |
| Monitor type | HTTP(s) | status-code based (not keyword) |
| URL | `https://<app>.onrender.com/health` | the public target — replace `<app>` with the Render service name |
| Check interval | **5 minutes** | free-tier minimum; 5 < 15-min Render idle window = 3× margin |
| Successful HTTP status | 2xx–3xx | `200` is the healthy code returned by `/health` |
| Failed HTTP status | any other (incl. 503) | indicates readiness failure → alerts |
| Method | HTTPS GET (default) | UptimeRobot defaults to HEAD; an HTTP(s) monitor still evaluates status correctly |
| Timeout | default | our endpoint answers in < 5 s |

> Do NOT point the monitor at `/robots.txt` — Render answers such requests without waking the service.

## Alert configuration (notifications)

- **Email**: free, recommended (primary).
- **Discord**: free on UptimeRobot (Webhook integration) — recommended for immediate visibility.
- Telegram/Slack/Mattermost: paid (Solo+) — not needed; skip.

## Operational expectations

- A **503 / degraded** alert is expected behavior when agent or bridge is down — not a defect (see
  `health-contract.md`).
- Keeping the service awake on free tier consumes toward the Render **750 instance-hours/mo** cap
  (~730 hrs kept up) — inherent to 24/7 free hosting; documented, not a bug.
- Free-tier UptimeRobot retains monitor data for 3 months; no recurring/persistent notifications.

## Verification (quick)

```text
curl -i https://<app>.onrender.com/health
# expect HTTP/1.1 200 and {"status":"ok",...} while healthy
```

## Related

- Endpoint contract: `health-contract.md`
- Runtime entities: `../data-model.md`
- Validation guide: `../quickstart.md`
