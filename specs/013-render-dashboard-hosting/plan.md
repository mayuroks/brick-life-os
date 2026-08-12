# Implementation Plan: Render Dashboard Hosting

**Branch**: `013-render-dashboard-hosting` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-render-dashboard-hosting/spec.md`

## Summary

Deploy the existing Life Map dashboard app (**built by Feature 1, `012-jira-dashboard`, in
`life-map-dashboard/`**) to render.com so it is publicly reachable over HTTPS, with Jira
credentials supplied as Render environment variables (never in the repo or served pages) and
auto-deploy + health/restart wired up. This feature owns **only the hosting wiring**:
`render.yaml` and the Render deploy configuration on top of the 012 app. It should not build or
duplicate any of the dashboard application.

## Technical Context

**Language/Version**: N/A — inherits the app runtime from Feature 1 (Node.js 24, `life-map-dashboard/`).

**Primary Dependencies**: render.com (Blueprint web service, free/hobby tier). The app's own deps (Express, dotenv) are owned by Feature 1.

**Storage**: N/A — Inherited from 012; no hosting-specific storage.

**Testing**: Manual + quickstart.md deploy runbook (constitution §IV).

**Target Platform**: render.com web service (free/hobby tier), auto-deploy from the repo's default branch.

**Project Type**: deployment/hosting wiring for an existing web-service app.

**Performance Goals**: Single-user personal prototype; cold-start latency after idle spin-down acceptable (per spec assumption).

**Constraints**: Stay on render.com free/hobby tier; credentials supplied via Render env, never in repo/served pages (FR-003/FR-008); failed build must keep the previous version live (FR-007); health/restart automatic (FR-006). Depends on the 012 app being present (do not re-build it here).

**Scale/Scope**: 1 deployed environment, 1 public URL, auto-deploy, no staged/multi-env pipeline.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Note |
|-----------|--------|------|
| I. Jira is SSOT | PASS | Hosts the app; data still fetched by the app from Jira |
| II. Agent Is Interface | PASS | Not affected |
| III. Fear + Streaks + Metrics | PASS | Not affected |
| IV. Prototype Pragmatism | PASS | Minimal config (render.yaml); does not re-build the app |
| V. Sub-Agent Delegation | PASS | Install/test/verify delegated during implementation |

**Gates (post-design):** PASS — no constitution violations requiring justification.
No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/013-render-dashboard-hosting/
├── plan.md              # This file
├── research.md          # Phase 0: Render blueprint + env wiring
├── data-model.md        # Phase 1: Hosted Environment + Deployment entities
├── quickstart.md        # Phase 1: deploy validation runbook
├── contracts/
│   └── deploy-contract.md  # render.yaml service contract (env mapping, health, start cmd)
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
render.yaml                          # Render Blueprint (owned by THIS feature)
life-map-dashboard/                  # The app (owned by 012) — referenced, NOT created here
```

**Structure Decision**: A single `render.yaml` Blueprint at the repo root defines the Render
web service (start `node server.js`, health `/healthz`, env vars mapping to the 012 app's
`JIRA_URL` / `JIRA_USERNAME` / `JIRA_API_TOKEN`, auto-deploy from the default branch). The
`life-map-dashboard/` app it deploys is owned by Feature 1 (`012`) — 013 only references it.

## Complexity Tracking

No constitution violations to justify — Complexity Tracking table left empty.
