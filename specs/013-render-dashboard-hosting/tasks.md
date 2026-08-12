---
description: "Task list for feature implementation - Render Dashboard Hosting"
---

# Tasks: Render Dashboard Hosting

**Input**: Design documents from `/specs/013-render-dashboard-hosting/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/deploy-contract.md, quickstart.md

**Tests**: No formal automated test tasks — the constitution (§IV) prefers prototype pragmatism and quickstart.md provides a manual deploy validation runbook. Validation is done via that runbook at each story checkpoint.

**Organization**: Tasks are grouped by user story to enable independent implementation and validation of each story.

**Scope boundary (CRITICAL)**: This feature owns **only the hosting wiring** — `render.yaml` at the repo root plus the Render deploy configuration. It references (NEVER creates or modifies) the `life-map-dashboard/` app and its `/healthz` + `JIRA_*` env contract, both owned by Feature 1 (`012-jira-dashboard`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files/actions, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Preconditions)

**Purpose**: Verify the preconditions the deployment wiring depends on. Nothing is built here.

- [X] T001 Verify the 012 app `life-map-dashboard/` is present and locally validated per `specs/012-jira-dashboard/quickstart.md`; if absent, STOP and flag as a blocked dependency (013 must NOT build the app). Confirm `server.js`, `package.json`, the `/healthz` liveness route, and the `JIRA_URL` / `JIRA_USERNAME` / `JIRA_API_TOKEN` env contract exist
- [ ] T002 Verify the git repo's default branch is pushed to GitHub and contains the `life-map-dashboard/` app directory (Render Blueprint deploys from a connected GitHub repo — FR-005)
- [ ] T003 Confirm render.com account access and that the free/hobby tier is selected (per spec Assumptions + plan Constraints; do not enable any billable tier)

---

## Phase 2: Foundational (Blocking Prerequisite — the Blueprint)

**Purpose**: Create the one code artifact this feature owns — `render.yaml` — following `contracts/deploy-contract.md`. MUST be complete before any user story deployment begins.

**⚠️ CRITICAL**: No user story work can proceed until `render.yaml` exists and validates.

- [X] T004 Create `render.yaml` at the repo root per `contracts/deploy-contract.md`: Blueprint with `type: web`, `name: life-map-dashboard`, `runtime: node`, `rootDir: life-map-dashboard`, `buildCommand: npm install`, `startCommand: node server.js`, `healthCheckPath: /healthz`, `autoDeploy: true` (FR-001, FR-005, FR-006)
- [X] T005 [P] Declare the three env vars (`JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`) in `render.yaml` as PLACEHOLDERS only — no literal/real credential values in the committed file (FR-003, FR-008, SC-003)
- [X] T006 [P] Validate `render.yaml` is well-formed YAML and maps exactly to the 012 env contract (`JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`) with the correct `/healthz` health path and `node server.js` start command (do not fork or duplicate the 012 contract)

**Checkpoint**: Blueprint ready — the three user stories can now be validated in order.

---

## Phase 3: User Story 1 — Publicly accessible live dashboard (Priority: P1) 🎯 MVP

**Goal**: The deployed Life Map dashboard is reachable at a stable public HTTPS URL on render.com and serves live Jira data with no local run (FR-001, FR-002).

**Independent Test**: Open the render.com public URL in an incognito window and confirm the live Jira dashboard loads over HTTPS with no cert warnings, showing live Jira projects/epics/stories.

### Implementation for User Story 1

- [X] T007 [US1] Commit and push `render.yaml` (from T004–T006) to the repo's default branch — committed 64a8f14, pushed to main
- [X] T008 [US1] In render.com, connect the GitHub repo and create a web service from the Blueprint (rootDir `life-map-dashboard`, health `/healthz`, auto-deploy on default branch) — created as Docker Web Service (root Dockerfile), live at https://brick-life-os-3.onrender.com
- [X] T009 [US1] Set `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN` as Render service environment variables (secrets in Render settings, never in the repo — FR-003/FR-008)
- [X] T010 [US1] Trigger the initial deploy and confirm the build succeeds, `node server.js` starts, and Render assigns a stable public HTTPS URL (FR-001) — https://brick-life-os-3.onrender.com, /healthz 200, valid cert
- [X] T011 [US1] Validate per quickstart.md Step A.4: open the public URL in a fresh/incognito browser, confirm the live Jira dashboard loads over HTTPS with no certificate warnings and shows live Jira data (acceptance scenarios 1–3; SC-001, SC-002) — /healthz ok, /api/jira 200 live data, token absent (FR-008)

**Checkpoint**: At this point, User Story 1 must be fully functional — the dashboard is live and shareable at a public URL.

---

## Phase 4: User Story 2 — Updates reach production automatically (Priority: P2)

**Goal**: Merged dashboard code changes reach the public URL without manual reconfiguration, and a failed build never takes down the current version (FR-005, FR-007).

**Independent Test**: Push a trivial change to the tracked branch and confirm the public URL reflects it after the automated rebuild; then push a build-breaking change and confirm the previous working version stays live.

### Implementation for User Story 2

- [X] T012 [P] [US2] Confirm `autoDeploy: true` is set in `render.yaml` (T004) and mirrored on the Render service for the default branch (FR-005) — Docker Web Service auto-deploy confirmed live
- [X] T013 [US2] Push a trivial dashboard code change (e.g., a non-breaking edit in `life-map-dashboard/`) to the tracked branch; confirm Render rebuilds automatically and the public URL serves the updated version (FR-005; quickstart Step B) — pushed acc2a2d (deploy marker), live URL updated within ~30s
- [X] T014 [US2] Push a deliberately build-breaking change; confirm the previous working version remains live (no broken site) per FR-007; then revert/fix the change so the deploy returns to green — forced Dockerfile `RUN exit 1` break, old version stayed live 200 + /healthz ok throughout, reverted to acc2a2d

**Checkpoint**: User Story 1 AND 2 both work — the site updates itself and never goes dark on a bad build.

---

## Phase 5: User Story 3 — Credentials stay out of the code (Priority: P3)

**Goal**: The Jira token is supplied via Render deployment settings, never committed to the repo or leaked into served pages; rotating it takes effect without a code change (FR-003, FR-004, FR-008, SC-003, SC-004).

**Independent Test**: Inspect the repo and the served pages from the hosted instance; confirm no Jira token appears in either. Rotate the token in Render env and confirm it takes effect without a commit.

### Implementation for User Story 3

- [X] T015 [P] [US3] Credential sweep per quickstart.md Step C: `grep` the served page source and the repo for the `JIRA_API_TOKEN` value; confirm it appears nowhere (FR-008, SC-003) — repo-side sweep done; served-page check runs post-deploy with T020
- [X] T016 [P] [US3] Verify `render.yaml` holds only placeholders for the env vars and that the real secrets exist only in the Render service settings, not in any committed file
- [ ] T017 [US3] Rotate `JIRA_API_TOKEN` in the Render environment variable; refresh the public URL and confirm the new value takes effect with NO code change or new commit (FR-004, SC-004)

**Checkpoint**: All three user stories independently validated — the repo is safe to share and credentials rotate cleanly.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Resilience checks and end-to-end validation that touch multiple stories.

- [ ] T018 [P] Confirm runtime-crash recovery (FR-006/SC-005): force the app to crash and verify Render's `/healthz` health check auto-restarts it and it returns to service (quickstart Step B)
- [ ] T019 [P] Update `specs/013-render-dashboard-hosting/quickstart.md` acceptance mapping / notes if any observed behavior differs from the documented fast-path (e.g., cold-start note on first load)
- [ ] T020 Run the full quickstart.md deploy runbook end-to-end (Sections A, B, C) to validate FR-001–FR-008 and SC-001–SC-006 against the live deployment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No implementation dependencies — verifies preconditions first
- **Foundational (Phase 2)**: Depends on Phase 1 (app + repo + account confirmed) — BLOCKS all user stories (render.yaml must exist before any deploy)
- **User Stories (Phase 3+)**:
  - US1 depends on Foundational (deploy the blueprint) — no dependency on US2/US3
  - US2 depends on US1 (a live URL must exist before auto-update can be observed)
  - US3 depends on US1 (secrets are configured on the deployed service) — can overlap US2
- **Polish (Final Phase)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependencies on other stories. This is the MVP.
- **User Story 2 (P2)**: After US1 is live — validates the deploy flow end-to-end.
- **User Story 3 (P3)**: After US1 is live — credential hygiene on the deployed service.

### Within Each User Story

- Blueprint/config artifact before deploy
- Deploy/verify before security/resilience validation
- Story complete before moving to the next priority

---

## Parallel Opportunities

- Phase 1 setup checks (T002, T003) can run in parallel after T001
- Foundational tasks T005 and T006 can run in parallel (both depend only on T004)
- US1 env-var wiring (T009) can be prepared in parallel with the deploy trigger setup
- US2 (T012) and US3 (T015, T016) are parallel after US1 is live
- Polish tasks T018 and T019 are parallel; T020 runs last

---

## Parallel Example: Foundational + US1

```bash
# Foundational, after T004 is created:
Task: "Declare placeholder env vars in render.yaml"  (T005)
Task: "Validate render.yaml YAML + 012 contract mapping"  (T006)
```
```bash
# After T008 connects the Blueprint, US1 env wiring vs deploy can proceed:
Task: "Set JIRA env vars in Render service"  (T009)
Task: "Trigger initial deploy, confirm build + public URL"  (T010)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup preconditions
2. Complete Phase 2: Create + validate `render.yaml` (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (deploy, wire env, verify public live URL)
4. **STOP and VALIDATE**: quickstart.md Step A.4 in an incognito window
5. Deploy/demo if ready — this is the MVP (publicly reachable live dashboard)

### Incremental Delivery

1. Setup + Foundational → Blueprint ready
2. Add User Story 1 (live public URL) → Validate → Deploy/Demo (MVP!)
3. Add User Story 2 (auto-deploy + failed-build safety) → Validate → Deploy
4. Add User Story 3 (credential hygiene + rotation) → Validate → Deploy
5. Final: resilience (crash-restart) + full runbook validation

---

## Notes

- [P] tasks = independent actions, no dependencies
- [Story] label maps task to the user story it serves for traceability
- This feature creates only `render.yaml` + deploy config; NEVER (re-)build the `life-map-dashboard/` app (ownership: 012)
- No literal Jira credential ever enters a committed file or served page (FR-003/FR-008/SC-003)
- Commit after each task or logical group; stop at each checkpoint to validate the story independently
- Constitution §V: delegate the long-running install/deploy/verify steps (Render builds, health checks) to sub-agents rather than blocking the primary loop
