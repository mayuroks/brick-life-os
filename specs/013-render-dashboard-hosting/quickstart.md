# Quickstart: Render Dashboard Hosting

Validation/run guide for `013-render-dashboard-hosting`. Proves the hosted dashboard works
end-to-end. **This feature owns only the deploy wiring** — the app itself and local live testing
are validated in Feature 1 (`specs/012-jira-dashboard/quickstart.md`).

Deploy contract & entities live in [`contracts/deploy-contract.md`](./contracts/deploy-contract.md)
and [`data-model.md`](./data-model.md).

## Prerequisites

- The Life Map dashboard app from Feature 1: `life-map-dashboard/` (server, proxy, index.html)
  built and validated locally (see 012's quickstart).
- A render.com account; repo pushed to GitHub with `life-map-dashboard/` + `render.yaml` on the default branch.
- The three Jira env vars from 012's env-contract: `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`.

## A. Deploy to render.com (FR-001 / FR-005 / FR-006 / FR-007)

> **Path used (verified 2026-08-12):** Render **Web Service (Docker)** from the repo root, not Blueprint.
> The Blueprint (`render.yaml`) requires a payment method on file even on the free tier, so the free-tier
> no-payment path uses the root `Dockerfile` (build context = repo root, builds `life-map-dashboard/`).
> The root `Dockerfile` + `.dockerignore` are owned by this feature alongside `render.yaml`.

1. Ensure the root `Dockerfile` (builds `life-map-dashboard/`, `CMD ["node","server.js"]`) is present and pushed.
2. In Render: **New → Web Service** → connect the repo → branch `main` → leave **Root Directory blank** (repo root has the `Dockerfile`).
3. Render auto-detects **Docker** → **Create Web Service**.
4. Set the three env vars (`JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`) in the Render service — never in the repo.
5. Render builds via the `Dockerfile`, runs `node server.js`, assigns a public HTTPS URL (e.g. `https://brick-life-os-3.onrender.com`).
   - **Expected**: opening the public URL loads the live Jira dashboard over HTTPS with no cert warnings (FR-001/SC-001/SC-002). Auto-deploy is on by default — every push to `main` redeploys (FR-005).
   - **Verified**: `/healthz` → `{"status":"ok"}`; `/api/jira` → 200 live Jira data; token absent from served pages (FR-008).

## B. Failure behaviors (expect on Render)

- **Runtime crash** → Render health check fails `/healthz` → auto-restart; returns to service (FR-006/SC-005).
- **Failed build** → previous working version stays live (FR-007).
- **Rotate token** in the Render env var (no code change) → refresh reflects it (FR-004/SC-004).
- **Cold start** after idle spin-down → first load slower, still serves (assumption).

## C. Credential sweep (FR-003 / FR-008 / SC-003)

- `grep -r "JIRA_API_TOKEN" rendered page source + repo` → the token value appears nowhere.
- Verify the blueprint holds placeholders, real secrets only in Render settings.

## Acceptance mapping

| Scenario | How to validate |
|----------|-----------------|
| FR-001 live public HTTPS URL | Step A.4 |
| FR-002 hosted instance serves live Jira (from 012 app) | Step A.4 |
| FR-003 creds via env, not committed | Step C |
| FR-004/SC-004 rotate token | Rotate + refresh |
| FR-005 auto-update | Push code change → URL reflects it |
| FR-006/SC-005 crash restart | Force crash → auto-restart |
| FR-007 failed build | Bad build → previous stays live |
| FR-008/SC-003 no token in pages | Step C |

Local start/stop and app behavior (FR-009→016 equivalent in 012) are covered by
Feature 1's quickstart.
