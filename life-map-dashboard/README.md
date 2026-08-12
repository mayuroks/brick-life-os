# Life Map Dashboard

Live Jira-powered "Life Map: Paths & Timelines" dashboard (Feature 1 / `012-jira-dashboard`).

## Prerequisites

- Node.js 24
- Jira credentials: `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your local env from the template (do not commit):
   ```bash
   cp .env.example .env
   # edit .env and paste real JIRA_URL / JIRA_USERNAME / JIRA_API_TOKEN
   ```

## Run (live dev server)

```bash
npm start
# served at http://localhost:3000
```

## Stop

Press `Ctrl-C` in the terminal running `npm start`. The server shuts down cleanly and releases the port.

## Endpoints

- `GET /` — the dashboard (static omni-compass template, Jira-data-fed)
- `GET /healthz` — liveness probe
- `GET /api/jira` — server-side Jira proxy (projects/epics/stories; no credentials exposed)

All Jira calls are proxied server-side so credentials never reach the browser.

## Deploy

Deployment (render.com) is handled by Feature 2 (`013-render-dashboard-hosting`) via `render.yaml`, which sets the same `JIRA_*` env vars.
