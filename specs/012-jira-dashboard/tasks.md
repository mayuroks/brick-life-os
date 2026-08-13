---

description: "Task list for Jira-Powered Life Map Dashboard implementation"
---

# Tasks: Jira-Powered Life Map Dashboard

**Input**: Design documents from `/specs/012-jira-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/env-contract.md, contracts/api.md, quickstart.md

**Tests**: Not requested in the spec; per the Life OS constitution (prototype pragmatism) tests are optional and skipped. Validation is manual via quickstart.md.

**Organization**: Tasks grouped by user story for independent implementation and testing. Setup and Foundational phases must complete before any user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (live data), US2 (refresh), US3 (security), US4 (local live server)
- Include exact file paths

**Root**: all app code lives in `life-map-dashboard/` at the repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the `life-map-dashboard/` app folder (owned by this feature; Feature 2 `013` deploys it).

- [x] T001 Create `life-map-dashboard/` folder structure per plan.md (`life-map-dashboard/`, `life-map-dashboard/public/`, `life-map-dashboard/src/`)
- [x] T002 Initialize `life-map-dashboard/package.json` — name `life-map-dashboard`, `start` script `node server.js`, deps `express` + `dotenv`
- [x] T003 [P] Create `life-map-dashboard/.gitignore` ignoring `.env` and `node_modules/` (scripts §3: never track secrets)
- [x] T004 [P] Create `life-map-dashboard/.env.example` with placeholder `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`, `PORT` per `contracts/env-contract.md`
- [x] T005 [P] Copy `.lavish/omni-compass-hud.html` into `life-map-dashboard/public/index.html` as the visual base

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core server + Jira proxy infrastructure that MUST be complete before ANY user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T006 Create Express server in `life-map-dashboard/server.js` serving `public/` statically and a `GET /healthz` route returning `200 {"status":"ok"}` (per `contracts/api.md`)
- [x] T007 Implement env loading (dotenv) in `life-map-dashboard/server.js` reading `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`, `PORT` per `contracts/env-contract.md`
- [x] T008 [P] Implement server-side Jira client `life-map-dashboard/src/jiraClient.js` — basic-auth REST fetch of projects/epics/stories (FR-001)
- [x] T009 Implement `GET /api/jira` proxy route in `life-map-dashboard/server.js` delegating to `jiraClient`, with error mapping 400 (creds missing) / 401/502 (auth) / 500 per `contracts/api.md` (FR-007 no-crash errors)
- [x] T010 Implement `life-map-dashboard/src/normalize.js` mapping Jira projects/epics/stories → the template's expected shape (project/epic/story, progress, deep links) per `data-model.md`

**Checkpoint**: `npm start` serves `/healthz` and `/api/jira` returns live Jira JSON. Foundation ready.

---

## Phase 3: User Story 1 - Live Jira data drives the dashboard (Priority: P1) 🎯 MVP

**Goal**: Dashboard shows live Jira projects/Epics/Stories instead of hardcoded sample data.

**Independent Test**: Load the dashboard pointing at valid Jira creds; verify on-screen projects/epics/stories match real open Epics in Jira (quickstart §A.3).

### Implementation for User Story 1

- [x] T011 [US1] Wire `life-map-dashboard/public/index.html` to fetch `GET /api/jira` on load and render live data (drop reliance on hardcoded sample JSON)
- [x] T012 [P] [US1] Render project-vector rows (name + epic count) in `life-map-dashboard/public/app.js` (FR-002)
- [x] T013 [P] [US1] Render Epic Gantt bars positioned/sized by start/end dates in `life-map-dashboard/public/app.js` (FR-003)
- [x] T014 [P] [US1] Compute Epic progress % from Done/total Stories and render Story list modal in `life-map-dashboard/public/app.js` (FR-004/FR-005)
- [x] T015 [US1] Add deep-link navigation: click Epic bar → its Jira issue page, click project box → its Jira project page (FR-011/FR-012/FR-014)
- [x] T016 [US1] Highlight the current real-world week/month column darker in `life-map-dashboard/public/app.js` (FR-013)
- [x] T017 [US1] Tolerate empty projects/epics/missing dates (default band) without breaking layout in `life-map-dashboard/public/app.js` (FR-009)

**Checkpoint**: User Story 1 fully functional and testable independently.

---

## Phase 4: User Story 2 - Fresh data on demand (Priority: P2)

**Goal**: Re-pull Jira data without a full page reload.

**Independent Test**: Change an Epic's status in Jira, click refresh, confirm the dashboard reflects it (quickstart refresh check).

### Implementation for User Story 2

- [x] T018 [US2] Implement manual refresh that re-fetches `GET /api/jira` and re-renders without full page reload in `life-map-dashboard/public/app.js` (FR-006)
- [x] T019 [US2] On refresh failure, show a readable error and retain last-known data in `life-map-dashboard/public/app.js` (FR-007)

**Checkpoint**: Stories 1 AND 2 work independently.

---

## Phase 5: User Story 4 - Test locally as a live server (Priority: P2)

**Goal**: Run/stop the dashboard locally as a live dev server fetching real Jira data.

**Independent Test**: Start locally, load in browser to see live Jira data, Ctrl-C to stop and confirm port released (quickstart §A).

### Implementation for User Story 4

- [x] T020 [US4] Ensure `npm start` (node `life-map-dashboard/server.js`) launches the live dev server fetching real Jira data; print a clear startup line with port (FR-015)
- [x] T021 [US4] Ensure Ctrl-C (SIGINT) terminates the server cleanly and releases the port; verify against quickstart §A.5 (FR-016)

**Checkpoint**: Local live-server start/stop validated end-to-end.

---

## Phase 6: User Story 3 - Secure credential handling (Priority: P3)

**Goal**: Jira credentials stay out of the browser and out of version control.

**Independent Test**: Inspect served page source and repo diff — no Jira token appears in either (quickstart credential sweep).

### Implementation for User Story 3

- [x] T022 [US3] Audit that credentials are proxy-only (never sent to browser): remove any client-side token/reference in `life-map-dashboard/public/index.html` and `life-map-dashboard/public/app.js` (FR-008)
- [x] T023 [US3] Ensure `.env` is git-ignored and no token appears in tracked files (`life-map-dashboard/.gitignore`, server config) per `contracts/env-contract.md` (FR-008/SC-005)
- [x] T024 [US3] Ensure `JIRA_API_TOKEN` is never logged by `life-map-dashboard/server.js` or `life-map-dashboard/src/jiraClient.js` (FR-008)

**Checkpoint**: All user stories independently functional and secure.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation + docs affecting all stories; proves Feature 1 is deployable for Feature 2 (`013`).

- [x] T025 Run `specs/012-jira-dashboard/quickstart.md` §A local validation end-to-end (start → live data → refresh → stop)
- [x] T026 [P] Add `life-map-dashboard/README.md` with run (`npm start`) and stop (Ctrl-C) instructions
- [x] T027 Run a final credential sweep across the repo (grep for the token value) to confirm SC-005

**Checkpoint**: Feature 1 (`012`) app complete, locally testable, and ready for Feature 2 (`013`) to deploy via `render.yaml`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational; proceed sequentially P1 → P2 → P2 → P3
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: After Foundational; no story deps — MVP
- **US2 (P2)**: After Foundational; uses US1 render pipeline but independently testable via refresh
- **US4 (P2)**: After Foundational; relies on the server built there
- **US3 (P3)**: After Foundational; hardening layered on working fetch

### Within Each User Story

- Client render (`app.js`) before wiring (`index.html`), services (`normalize`) before endpoints
- Core implementation before integration

### Parallel Opportunities

- T003, T004, T005 parallel (different files)
- T008 parallel with T006/T007 (separate files)
- T012, T013, T014 parallel (distinct rendering functions in `app.js`)

---

## Parallel Example: User Story 1

```bash
# Launch the three independent render tasks together:
Task: "Render project-vector rows in life-map-dashboard/public/app.js"
Task: "Render Epic Gantt bars in life-map-dashboard/public/app.js"
Task: "Compute Epic progress % and render Story modal in life-map-dashboard/public/app.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational) — BLOCKS everything
3. Complete Phase 3 (User Story 1)
4. **STOP and VALIDATE**: load dashboard, confirm live Jira data (quickstart §A.3)
5. Demo/deploy-ready for Feature 2 (`013`)

### Incremental Delivery

1. Setup + Foundational → live Jira JSON via `/api/jira`
2. Add US1 → live dashboard (MVP) → validate
3. Add US2 → refresh → validate
4. Add US4 → local start/stop → validate
5. Add US3 → security sweep → validate
6. Polish → full quickstart pass → Feature 1 done

### Parallel Team Strategy

With multiple devs: Setup + Foundational together, then Developer A = US1, Developer B = US2/US4, Developer C = US3; stories integrate independently.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps to US1–US4 for traceability
- Commit after each logical task group
- Stop at any checkpoint to validate the story independently
- Feature 2 (`013-render-dashboard-hosting`) deploys this `life-map-dashboard/` app with `render.yaml` — do not create `render.yaml` here
