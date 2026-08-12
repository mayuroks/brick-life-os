# Contract: Render Deploy Blueprint (`render.yaml`)

Owned by **013 (Render Dashboard Hosting)**. Defines the Render web service that deploys the
Feature 1 app. This is the only hosting interface this feature owns; the app's own contracts
(`/`, `/api/jira`, and the `JIRA_*` env vars) are owned by `012-jira-dashboard`.

## Blueprint shape

| Key | Value | Notes |
|-----|-------|-------|
| `type` | `web` | Render web service |
| `name` | `life-map-dashboard` | service display name |
| `runtime` | `node` | Node.js 24 |
| `rootDir` | `life-map-dashboard` | the 012 app directory |
| `buildCommand` | `npm install` | install app deps |
| `startCommand` | `node server.js` | matches 012's `npm start` |
| `healthCheckPath` | `/healthz` | liveness route owned by 012 (FR-006) |
| `autoDeploy` | true | branch push → deploy (FR-005) |
| `envVars` | see below | map 012's env contract to Render |

## Env mapping (to 012's env-contract)

| Render var | Source of truth | Required | Notes |
|------------|-----------------|----------|-------|
| `JIRA_URL` | 012 env-contract | yes | Jira site base URL |
| `JIRA_USERNAME` | 012 env-contract | yes | Jira account email |
| `JIRA_API_TOKEN` | 012 env-contract | yes | secret; set in Render settings, never in blueprint as real value |

## Rules
- The blueprint MUST reference the `life-map-dashboard/` app; it MUST NOT (re-)create the app
  or its routes / env contract (ownership: 012).
- No literal credential values in the committed `render.yaml` (FR-003/FR-008/SC-003).
- Rotating a credential = update the Render env var; no code change or new commit (FR-004/SC-004).
