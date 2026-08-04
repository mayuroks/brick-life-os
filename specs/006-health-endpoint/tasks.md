---

description: "Task list for the health endpoint / uptime keep-alive"
---

# Tasks: Health Endpoint for Uptime Monitoring

**Input**: Design documents from `/specs/006-health-endpoint/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: None required (manual acceptance per the constitution). This feature is a thin hardening edit
and documentation pass on top of `005`. Critical behavior (healthy 200 / degraded 503, public
reachability) is verified with `curl`/a live Render URL, which MUST be delegated to a sub-agent per
constitution V.

**Organization**: Tasks are grouped by user story. Because the `/health` endpoint, `render.yaml`
`healthCheckPath`, and readiness logic ALREADY EXIST (feature `005`), Setup and Foundational phases are
SKIPPED — the remaining work is a one-route hardening edit and documentation (keep-alive setup made
monitor-agnostic, per user note to not single out UptimeRobot).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- Source lives under `deploy/discord-agent/src/`; docs under `deploy/discord-agent/README.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Skipped — nothing to set up. Node/express app, deployment, and health dependency already
exist from `005-render-ubuntu-deploy`. No new dependencies, no new structure.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Skipped — `GET /health` (FR-001/002/004/005) already exists in
`deploy/discord-agent/src/health.js` (`createHealthApp`), is bound to the public port in
`src/index.js`, and `render.yaml` already sets `healthCheckPath: /health`. Readiness state
(`agentUp`/`bridgeUp`) is already wired to the Discord bridge in `src/bridge/client.js`. Nothing here
blocks the remaining work.

---

## Phase 3: User Story 1 - Keep the Deployed Bot Awake (Priority: P1) 🎯 MVP

**Goal**: The public `/health` endpoint is a reliable, documented keep-alive target so any external
ping/uptime monitor keeps the Render free service awake and the bot answers after long idle periods.

**Independent Test**: Reach `https://<app>.onrender.com/health` (and `/`) from outside Render → HTTP
200 `{"status":"ok",...}`; with a monitor pinging every <15 min, the bot still replies to a Discord
message after several idle hours. Liveness code itself is already present; this phase adds the root
route + docs.

### Implementation for User Story 1

- [X] T001 [US1] SKIPPED — user decision. Root `GET /` route is optional hardening, not required by any
      FR/SC. `/health` remains the single canonical monitor target; no root route added.

- [X] T002 [US1] Add a "Keep the service awake" section to `deploy/discord-agent/README.md` (FR-006):
      point a free ping/uptime monitor (UptimeRobot, cron-job.org, or any equivalent) at
      `https://<app>.onrender.com/health`, set the interval to **< 15 minutes** (with the default
      recommendation of 5 minutes), note that 2xx = up and 503 = degraded is expected, list a
      notification channel (e.g. email / Discord webhook), and document the free-tier 750
      instance-hours implication. Write it monitor-agnostic — do NOT hard-require UptimeRobot.

**Checkpoint**: `/health` returns 200 when healthy; README documents keep-alive setup (root route
intentionally not added per T001 skip).

---

## Phase 4: User Story 2 - Distinguish Alive From Broken (Priority: P2)

**Goal**: The `/health` endpoint reflects real readiness (agent + bridge), not just "process is
listening", so a monitor and the user see a degraded/error state rather than a false green.

**Independent Test**: With a dependency down (e.g. before the bridge connects, or after an agent
failure), `GET /health` → HTTP 503 `{"status":"degraded",...}`; it returns to 200 when the dependency
recovers. This behavior ALREADY EXISTS in `src/health.js` + `src/bridge/client.js` (status semantics
per `contracts/health-contract.md`) — no implementation needed here; this phase verifies it.

### Implementation for User Story 2

- [X] T003 [US2] (sub-agent) Verify readiness on a live/local run: boot the deployed (or local) service
      and confirm `GET /health` returns 200 `{"status":"ok","agent":"up","bridge":"up"}` when healthy and
      503 `{"status":"degraded",...}` when the bridge is down or before it connects; confirm recovery to
      200 after the bridge reconnects (FR-005 / SC-003). Report results; no code change expected.

**Checkpoint**: Readiness reporting verified end-to-end (SC-003). Verified via isolated smoke test of
`createHealthApp`: healthy → 200 `{"status":"ok","agent":"up","bridge":"up"}`; degraded (bridge down) →
503 `{"status":"degraded","agent":"up","bridge":"down"}` — PASS.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Make the keep-alive guidance tool-agnostic and validate the full path.

- [X] T004 [P] Generalize the monitoring references across the feature docs so no single vendor is
      required: in `specs/006-health-endpoint/contracts/uptimerobot-monitor.md` and `quickstart.md`,
      add a note that UptimeRobot is an example and any ping/uptime monitor with a <15-min interval and
      status-based up/down (or an `ok` keyword) works; keep the concrete numbers (interval, 200=up,
      degraded alert) but frame them as generic requirements rather than UptimeRobot-only.

- [X] T005 Run the relevant steps of `specs/006-health-endpoint/quickstart.md` (local + public `/health`
      and `/` checks; monitor setup generic section); fix anything the run reveals. Delegate the
      live-Render curl verification to a sub-agent.

**Checkpoint**: Docs are monitor-agnostic; quickstart runs clean; README reflects final keep-alive setup.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Skipped — nothing to do.
- **Foundational (Phase 2)**: Skipped — endpoint + readiness already exist.
- **User Story 1 (Phase 3)**: T001 (health.js edit) is independent of T002 (README). Both can run in
  parallel. T001 is the only code change and is the gate for live verification.
- **User Story 2 (Phase 4)**: T003 depends on the service being reachable (deployed or local boot).
- **Polish (Phase 5)**: T004 (docs) independent; T005 (quickstart run) depends on T001 deployed/verify
  path.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on US2. Independently testable.
- **User Story 2 (P2)**: No dependency on US1 changes (readiness already present); independently testable.

### Parallel Opportunities

- T001 and T002 can run in parallel (different files: `src/health.js` vs `README.md`).
- T004 and T005 docs tasks can run in parallel once the code (T001) is in place.
- Verification (T003, T005) uses ≤3 parallel sub-agents per constitution V.

---

## Parallel Example: User Story 1

```bash
# Launch the health.js edit and the README doc together (distinct files):
Task: "Add root GET / route to deploy/discord-agent/src/health.js"
Task: "Add monitor-agnostic keep-alive section to deploy/discord-agent/README.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Skip Setup + Foundational (already complete from `005`).
2. Complete Phase 3: add root route (T001) + README keep-alive docs (T002).
3. **STOP and VALIDATE**: verify `/` and `/health` return 200; deploy; point a ping monitor at it.
4. Deploy/demo — this alone delivers the keep-alive value.

### Incremental Delivery

1. US1 done (root route + docs) → deploy & start pinging → MVP live.
2. US2 (readiness) already shipped in `005`; T003 just verifies it.
3. Polish: generalize monitor docs (T004), run quickstart (T005).

---

## Notes

- Everything marked "already exists" (health endpoint, healthCheckPath, readiness logic) is NOT
  re-implemented — only verified/documented. Do not duplicate `005` work.
- [P] tasks = different files, no dependencies.
- [Story] label maps task to the spec.md user story for traceability.
- Verify-tasks (T003, T005 live checks) MUST be delegated to sub-agents (≤3) per constitution V.
- Commit after each task or logical group.
- Stop at any checkpoint to validate the story independently.
