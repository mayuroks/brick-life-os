# Data Model: Render Dashboard Hosting

Phase 1 output for `013-render-dashboard-hosting`. Owns only the deployment/hosting entities.
The domain data and server runtime config are owned by Feature 1 (`012-jira-dashboard`); this
feature references the app without re-defining it.

## Entities

### 1. Hosted Environment (render.com web service)

Runtime/deployment settings owned by this feature's `render.yaml` or the Render dashboard.
Never committed secrets; not part of git structure other than the blueprint.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| serviceName | string | yes | "life-map-dashboard" |
| plan | string | yes | free / hobby tier |
| region | string | yes | single region |
| rootDir | string | no | `life-map-dashboard/` (the 012 app) |
| startCommand | string | yes | `node server.js` |
| healthCheckPath | string | yes | `/healthz` (liveness route owned by 012) |
| autoDeploy | bool | yes | true — branch deploy (FR-005) |
| envVars | map<string,string> | partial | `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN` (FR-003) — secrets |

**Validation**: Values MUST NOT be committed as literal secrets; the repo/blueprint carries
placeholders, real secrets live in Render settings (FR-008/SC-003). `JIRA_API_TOKEN` must not
appear in the repo or served pages.

### 2. Deployment

A build + release of the dashboard code to the hosted environment; maps repo changes to the
public URL.

| Field | Type | Notes |
|-------|------|-------|
| sourceBranch | string | default branch (auto-deploy trigger) |
| buildStatus | enum | success / failed |
| publicUrl | string | stable HTTPS URL (Render-assigned) |
| releaseState | enum | live (served) / not-served |

**State transitions**:
```
change pushed → build → success → replaces live release (FR-005)
change pushed → build → FAILED → previous live release kept (FR-007)
runtime crash → health check fails → auto-restart (FR-006/SC-005)
inactivity → service spun down → first load slower, still serves (assumption)
```

## Relationships

- **Hosted Environment → Deployment**: 1—N (each deploy is a build+release into the environment).
- **Hosted Environment → 012 app**: inputs the `life-map-dashboard/` app (owned by Feature 1) and
  its env contract (`JIRA_*`) + `/healthz` route; 013 configures, does not build them.
