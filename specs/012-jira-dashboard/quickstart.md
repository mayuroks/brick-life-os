# Quickstart: Jira-Powered Life Map Dashboard

Validation/run guide for `012-jira-dashboard`. Proves the app works end-to-end: **live Jira data
drives the dashboard** and **local live dev server start + stop**. Hosting/deploy lives in
Feature 2 (`specs/013-render-dashboard-hosting/quickstart.md`).

Contracts & data model live in [`contracts/api.md`](./contracts/api.md),
[`contracts/env-contract.md`](./contracts/env-contract.md), and [`data-model.md`](./data-model.md).

## Prerequisites

- Node.js 24 (repo standard).
- Jira credentials: `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN` (see env-contract).
- The `.lavish/omni-compass-hud.html` template as the visual base.

## A. Local live dev server (FR-015 / FR-016)

1. Create `life-map-dashboard/.env` from `.env.example` and paste real credentials (`.env` is git-ignored).
2. Start the server:
   ```bash
   cd life-map-dashboard
   npm install
   npm start
   ```
3. Open `http://localhost:3000/` in a browser.
   - **Expected**: Live Jira dashboard renders (projects/Epics/Stories from Jira), no auth error.
   - **Expected**: an Epic's progress matches Jira's Done/total ratio (SC-002).
   - **Expected**: `http://localhost:3000/healthz` → `200 {"status":"ok"}`.
4. Click an Epic Gantt bar and a project box:
   - **Expected**: navigates to the corresponding Jira issue/project page (FR-011/FR-012).
5. Stop the local server:
   ```bash
   # press Ctrl-C in the terminal running npm start
   ```
   - **Expected**: process exits cleanly; port released (FR-016).

**Refresh check (US2/FR-006):** change an Epic's status in Jira, click refresh → dashboard
reflects it without a full page reload.

**Negative check:** temporarily expire `JIRA_API_TOKEN` and reload `/` → dashboard shows a
readable auth error and keeps last-known data; server does not crash (FR-007).

**Credential sweep (FR-008/SC-005):** view-source the served page and `grep -r JIRA_API_TOKEN .`
— the token value appears nowhere.

## Acceptance mapping

| Requirement | How to validate |
|-------------|-----------------|
| FR-001 fetch projects/epics/stories | Step A.3 |
| FR-002/003/004 render rows/bars/progress | Step A.3 |
| FR-005 story modal | Open an Epic modal |
| FR-006 refresh without reload | Refresh check |
| FR-007 error + retain data | Negative check |
| FR-008/SC-005 no token | Credential sweep |
| FR-009 empty tolerance | Force an empty project/missing dates |
| FR-011/FR-012 deep-link nav | Step A.4 |
| FR-013 current-week highlight | Visual check of timeline |
| FR-015 local live server | Step A.3 |
| FR-016 stop local server | Step A.5 |

Deploy to render.com is covered by Feature 2 (`013`).
