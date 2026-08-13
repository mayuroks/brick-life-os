# Implementation Plan: Jira-Powered Life Map Dashboard

**Branch**: `012-jira-dashboard` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-jira-dashboard/spec.md`

## Summary

Build the runnable Life Map dashboard app in a new `life-map-dashboard/` folder: a small
Node/Express server that serves the `.lavish/omni-compass-hud.html` template and proxies Jira
REST requests server-side (so credentials never reach the browser), rendering live projects /
Epics / Stories from Jira. It runs locally as a live dev server (start via `npm start`, stop via
Ctrl-C) for testing (FR-015/FR-016), and is the deployable unit that Feature 2 (`013`) hosts on
render.com.

## Technical Context

**Language/Version**: Node.js 24 (matches repo precedent `deploy/discord-agent` on `node:24-slim`)

**Primary Dependencies**: Express (HTTP server + static serving + server-side Jira proxy); dotenv (env config); native fetch (Node 24) or axios for Jira REST. No build step.

**Storage**: N/A — Jira is the single source of truth (constitution §I); no local persistence.

**Testing**: Manual + quickstart.md runbook (constitution §IV: tests optional where they don't save rework).

**Target Platform**: Local Node.js dev server; the same app is hosted by Feature 2 on render.com.

**Project Type**: web-service (small Express server serving a static dashboard + server-side Jira proxy).

**Performance Goals**: Single-user personal prototype; no load requirements; refresh returns in a few seconds on a normal connection (SC-003).

**Constraints**: Credentials must never reach the browser or tracked files (FR-008/SC-005); all Jira calls proxied server-side; local server must be startable and stoppable (FR-015/FR-016); smallest working thing (constitution §IV).

**Scale/Scope**: Single personal Jira (9 domain projects); small data volume; last-known-data retention on fetch failure (assumption).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Note |
|-----------|--------|------|
| I. Jira is SSOT | PASS | Fetches live Jira data; no duplicate store |
| II. Agent Is Interface | PASS | Not affected |
| III. Fear + Streaks + Metrics | PASS | Not affected |
| IV. Prototype Pragmatism | PASS | Minimal Express server, no gold-plating |
| V. Sub-Agent Delegation | PASS | Install/test/verify delegated during implementation |

**Gates (post-design):** PASS — no constitution violations requiring justification.
No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/012-jira-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0: stack + security approach
├── data-model.md        # Phase 1: domain entities + server runtime config
├── quickstart.md        # Phase 1: local live-server start/stop runbook
├── contracts/
│   ├── env-contract.md  # JIRA_URL / JIRA_USERNAME / JIRA_API_TOKEN / PORT
│   └── api.md           # Server / , /healthz, /api/jira proxy contract
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
life-map-dashboard/                  # The dashboard app (owned by THIS feature)
├── server.js                        # Express: static serving + /api/jira proxy + /healthz
├── package.json                     # start script (npm start → node server.js)
├── .env.example                     # JIRA_URL / JIRA_USERNAME / JIRA_API_TOKEN / PORT
├── .gitignore                       # ignores .env (secrets never committed)
└── public/
    └── index.html                   # omni-compass-hud.html base, fed by /api/jira
```

**Structure Decision**: Single flat `life-map-dashboard/` Node service (default single-project
option). Local run: `npm start` → live Jira fetch; stop: Ctrl-C (FR-016). This same folder is the
deployable unit Feature 2 (`013-render-dashboard-hosting`) hosts with `render.yaml`.

## Complexity Tracking

No constitution violations to justify — Complexity Tracking table left empty.
