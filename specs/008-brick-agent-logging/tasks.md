# Tasks: Brick Agent Run Logging

**Input**: Design documents from `/specs/008-brick-agent-logging/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Manual acceptance per the constitution (prototype pragmatism); validation via `quickstart.md` stub-driven runs. No automated test suite requested.

**Organization**: Tasks grouped by user story. Existing `deploy/discord-agent/src/{index,health,agent/client,bridge/client,bridge/queue}.js` are reused; a new shared logger `src/log.js` and a new per-op relay `src/agent/ops.js` are added.

## Format: `[ID] [P?] [Story] Description` — `[P]` parallel, `[Story]` = US1/US2/US3/US4, exact file paths.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm codebase state and add the one shared logging primitive all stories use.

- [X] T001 Confirm `deploy/discord-agent` boots locally as-is (`node --check` on all `src/**/*.js`; `npm run start` with a throwaway `.env`) — baseline before changes
- [X] T002 Create shared structured logger `deploy/discord-agent/src/log.js`: emits one NDJSON object per line `{ts (ISO-8601 UTC), level (info|warn|error), event, ctx, msg, ...fields}`; `info`→stdout, `error`→stderr — satisfies FR-009/FR-007 (single point to prevent secret/PII leak). See `contracts/log-format.md`

**Checkpoint**: A single `log.js` exists and emits NDJSON; no story work started yet.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire the logger into boot/bridge/health so every future run has a consistent context and pipeline. MUST complete before any story's acceptance is testable.

⚠️ **CRITICAL**: All user stories emit through `log.js`; foundational routing must exist first.

- [X] T003 Route boot logs through `log.js` in `deploy/discord-agent/src/index.js` (events `boot.config`, `boot.health-listening`) — FR-006
- [X] T004 Route health state flips through `log.js` in `deploy/discord-agent/src/health.js` (event `health.flip` on `agentUp`/`bridgeUp` change with which flag flipped) — FR-006
- [X] T005 Route bridge lifecycle through `log.js` in `deploy/discord-agent/src/bridge/client.js`: `bridge.ready`, `bridge.login-failed`, and `msg.queued` (with `channelId`) — FR-006

**Checkpoint**: Foundation ready — boot/health/bridge events all flow through one logger; user stories can begin.

---

## Phase 3: User Story 1 - Capture Why an Agent Run Fails or Times Out (Priority: P1) 🎯 MVP

**Goal**: Every agent run records start, duration, exit outcome; failures and timeouts carry the reason + bounded output.

**Independent Test**: Run `quickstart.md` Tests 1–3 with the stub `opencode`; confirm `run.start`, exactly one terminal event (`run.done`/`run.timeout`/`run.failed`), and reason/outcome fields on failure/timeout.

### Implementation for User Story 1

- [X] T006 [US1] Instrument `deploy/discord-agent/src/agent/client.js` `runAgent`: emit `run.start` (ctx incl. channelId, run id) with a start clock — FR-001
- [X] T007 [US1] In `runAgent`, emit `run.done` on clean exit: `durationMs`, `outcome:"success"` (`exitCode:0`) or `outcome:"empty"` (exit 0, no text), `outBytes`, `errBytes` — FR-002
- [X] T008 [US1] In `runAgent`, emit `run.timeout` before `SIGKILL`: `timeoutMs`, `durationMs`, bounded `capturedOut`/`capturedErr` — FR-003
- [X] T009 [US1] In `runAgent`, emit `run.failed` on `child.on('error')` (spawn failure) and on non-zero exit, carrying `reason` + bounded output — FR-004
- [X] T010 [US1] Add bounded rolling capture in `runAgent` (cap accumulated stdout/stderr text) so timeout/failure entries include "output so far" without unbounded memory — FR-003/FR-004

**Checkpoint**: User Story 1 fully functional; `quickstart.md` Tests 1–3 pass.

---

## Phase 4: User Story 4 - Break Down Run Time by Operation (Priority: P1)

**Goal**: Per-operation timing — the log breaks total run time into model/Jira/tool operation durations that reconcile to the total.

**Independent Test**: Run `quickstart.md` Test 1b with the `ops` stub; confirm `run.op` entries exist and the terminal event's aggregated `ops` list sums to the recorded total.

### Implementation for User Story 4

- [X] T011 [P] [US4] Create `deploy/discord-agent/src/agent/ops.js`: parse opencode's per-tool/per-model-call event stream into structured operations (name/type, durationMs, status), relayed under the run context — FR-010. See `research.md` §4, `data-model.md` Operation
- [X] T012 [US4] Wire `ops.js` into `runAgent` in `deploy/discord-agent/src/agent/client.js`: emit `run.op` entries as each operation completes (with `durationMs`), and aggregate an `ops` array onto the terminal run event (`run.done`/`run.timeout`/`run.failed`) — FR-010/FR-011
- [X] T013 [US4] Add `run.op` and the aggregated `ops` reconciliation to `quickstart.md` Test 1b stub expectations (per-op entries present; sum ≈ total) — supports SC-006/SC-007

**Checkpoint**: User Stories 1 & 4 both work and reconcile; per-op timing visible and attributable.

---

## Phase 5: User Story 2 - See Agent Progress While Running (Priority: P2)

**Goal**: Intermediate progress — streamed agent output and a stall signal are recorded between start and finish.

**Independent Test**: Run a long stub and confirm intermediate `run.chunk` entries with elapsed time, plus a "no output for a while" indicator — `quickstart.md` long-run check.

### Implementation for User Story 2

- [X] T014 [US2] In `runAgent` (`deploy/discord-agent/src/agent/client.js`), emit `run.chunk` on stdout and stderr `data` events, each with `durationMs` since run start — FR-005
- [X] T015 [US2] Add a stall/heartbeat: if no output arrives for a configurable idle window, emit a `warn`-level entry noting no output since last entry (and resume on next chunk) — FR-005 acceptance #2

**Checkpoint**: User Stories 1, 2, 4 all functional independently; progress visible during long runs.

---

## Phase 6: User Story 3 - Boot, Health and Runtime Visibility (Priority: P3)

**Goal**: Full runtime state observable in one place; all lifecycle events through the same logger with consistent structure.

**Independent Test**: Boot the service and confirm `boot.config`, `health` listening, `bridge.ready`, and per-message `msg.queued` all appear in the shared log — acceptance #1/#2.

### Implementation for User Story 3

- [X] T016 [US3] Confirm `deploy/discord-agent/src/index.js` emits `boot.config` (success) and `boot.health-listening` via `log.js` — FR-006
- [X] T017 [US3] Confirm `deploy/discord-agent/src/health.js` emits `health.flip` on every agent/bridge up↔down change — FR-006
- [X] T018 [US3] Confirm `deploy/discord-agent/src/bridge/client.js` emits `bridge.ready`, `bridge.login-failed`, and `msg.queued` (with `channelId`) via `log.js` — FR-006

**Checkpoint**: All four user stories functional; whole process observable via one log stream.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Consistency pass + FR-007 secret hygiene across all changed files.

- [X] T019 [P] Grep all changed files for leaked secrets/PII patterns (token env names, provider keys) — confirm none reach log `msg`/fields — FR-007/SC-005
- [X] T020 [P] Confirm every log line is single-line NDJSON (newlines escaped in values) — `contracts/log-format.md` invariant
- [X] T021 Run `node --check` on all changed `deploy/discord-agent/src/**/*.js`
- [X] T022 Run the full `quickstart.md` local validation loop (Tests 1, 1b, 2, 3) and confirm SC-001–SC-007 outcomes; record results before cloud deploy — FR-008/SC-004

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No deps — start immediately.
- **Foundational (Phase 2)**: Depends on T002 (log.js). Blocks all stories.
- **User Stories (Phases 3–6)**: All depend on Phases 1–2. US1 (P1) and US4 (P1) lead; US2 and US3 follow, all independently testable.
- **Polish (Phase 7)**: Depends on all desired stories complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational — independently testable.
- **US4 (P1)**: After Foundational; uses `ops.js` (T011) wired into `runAgent` (T012) — no hard dependency on US1 but shares `runAgent`.
- **US2 (P2)**: After Foundational; edits `runAgent` — small overlap with US1/US4 in the same file, sequence within the phase.
- **US3 (P3)**: After Foundational; touches `index.js`/`health.js`/`bridge/client.js` (also touched in Phase 2) — complete after Phase 2 to avoid same-file conflicts.

### Within Each User Story

- Establish log emission before richer/aggregated variants (US1 core events first, then US4 ops, then US2 streaming).

### Parallel Opportunities

- T001/T002 (Setup) can run together.
- T003/T004/T005 (Foundational) are different files — parallel.
- T011 ([P]) can run parallel to US1 tasks.
- T019/T020 ([P]) parallel.

---

## Parallel Example: User Story 1 + User Story 4

```bash
# US1 run-event logging:
Task: "Instrument runAgent start/done/timeout/failed + bounded capture in deploy/discord-agent/src/agent/client.js (T006-T010)"

# US4 per-op relay (different file):
Task: "Create deploy/discord-agent/src/agent/ops.js to parse opencode op events (T011)"
```

---

## Implementation Strategy

### MVP First (Programmatic — rely on existing scaffolding: US1 → US4)

Headless `opencode` is already run via `runAgent`; the fix is observational. No fresh
project scaffolding needed — a stub `opencode` under `deploy/discord-agent/test/stub/`
(already described in `quickstart.md`) makes each path deterministic.

1. Complete Phase 1 (T001–T002).
2. Complete Phase 2 (T003–T005).
3. Complete US1 (T006–T010) → validate `quickstart.md` Tests 1–3.
4. Validate locally; then deploy to cloud (feature 007 path) before iterating further.

### Incremental Delivery

1. Setup + Foundational → logger live for boot/bridge/health.
2. US1 → run diagnostics (MVP core value).
3. US4 → per-op timing (SC-006/SC-007).
4. US2 → progress/stall visibility.
5. US3 → full runtime observability.
6. Polish (T019–T022) → secret hygiene + final local validation, then cloud deploy.

---

## Notes

- `[P]` tasks = different files, no dependencies.
- Manual validation per `quickstart.md`; no automated test suite (constitution IV).
- Avoid same-file conflicts: sequence edits to `deploy/discord-agent/src/agent/client.js` (US1 → US4 → US2) and to bridge/index/health (Phase 2 before US3).
- Commit after each task or logical group.
- Stop at each checkpoint to validate the story independently.
