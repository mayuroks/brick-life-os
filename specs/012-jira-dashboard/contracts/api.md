# Contract: Server API (local dev app)

Interface exposed by the Life Map dashboard server (`life-map-dashboard/server.js`). Owned by
**012**. All Jira calls are made server-side so credentials never reach the browser (FR-008).
Feature 2 (`013`) reuses `/healthz` for Render's health check.

## Endpoints

### `GET /` — dashboard page
- Serves `public/index.html` (omni-compass template) over HTTP.
- Never contains credential material.

### `GET /healthz` — liveness probe
- `200 {"status":"ok"}` — does not require credentials. Reused by 013's Render health check for FR-006/SC-005.

### `GET /api/jira` — live Jira data for the dashboard (FR-002)
- Proxies the Jira REST fetch server-side using `JIRA_URL` + basic auth (`JIRA_USERNAME` / `JIRA_API_TOKEN`).
- **Response (success)** `200 application/json`: shape the omni-compass template expects —
  projects each with `epics[]` (each with `stories[]`, dates, progress), plus deep-link URLs.
- **Error responses**:
  - `400` — credentials not configured (env missing) — readable message, no crash (FR-007).
  - `401/502` — token missing/expired — readable auth error surfaced; last-known data retained (FR-007).
  - `500` — unexpected upstream failure; no token leak in body.

## Rules
- The browser must never receive `JIRA_URL` / `JIRA_USERNAME` / `JIRA_API_TOKEN` (FR-008/SC-005).
- Response bodies must contain no credential material.
