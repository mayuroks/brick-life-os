# Tasks: Discord Agent — Latency & Reuse

**Input**: Design documents from `/specs/010-agent-latency-reuse/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/latency-contract.md, quickstart.md

**Tests**: Manual + e2e validation per constitution (no unit test runner installed; tests only where they save rework).

**Organization**: Tasks grouped by user story to enable independent implementation AND parallel-agent execution.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story (US1, US2, US3, US4)
- Exact file paths included.

## Path Conventions

- Single Node project at `deploy/discord-agent/`
- Bridge: `deploy/discord-agent/src/bridge/` (`client.js`, `queue.js`)
- Agent: `deploy/discord-agent/src/agent/` (`client.js`, `ops.js`)
- Infra: repo-root `aws.sh` + AWS console/CLI
- Docs: `specs/010-agent-latency-reuse/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Branch, baseline, and shared seam so the user stories can run in parallel.

- [X] T001 Create/confirm feature branch `010-agent-latency-reuse` and verify working state (`node --check` passes on `deploy/discord-agent/src/**/*.js`)
- [ ] T002 Record deployment baseline: current send-to-reply time of a "today" command in the deployed logs (~40s) and note the journal timing breakdown into `specs/010-agent-latency-reuse/research.md` (Baseline row)
- [X] T003 [P] Add a documented, empty-arg `--title "<fixed=life-os-agent>"` decision note (no code) — record the R1 mechanism and local-vs-deployed scope into `specs/010-agent-latency-reuse/research.md` Notes so parallel agents share the finding
- [X] T004 [P] Confirm the shared runAgent seam: read `deploy/discord-agent/src/agent/client.js` runAgent signature + `deploy/discord-agent/src/bridge/client.js` call site; document the exact line numbers for the title addition (agent) and enqueue/worker swap (bridge) so US1/US2 don't collide

**Checkpoint**: Setup done — branch clean, baseline recorded, seams documented.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: A single verified decision that gates the warm-reuse story and de-risks all changes.

**⚠️ CRITICAL**: US4 cannot proceed until the canary result lands. US1/US2/US3 do NOT depend on this phase.

- [ ] T005 [P] Run the live canary through the real bridge path (cover `today` + `add to backlog: X` + one research/yammer command) per `research.md` R3; record whether the deployed `--attach http://127.0.0.1:4096` path returns correct non-empty replies for each — output into `specs/010-agent-latency-reuse/research.md` under "Canary result". DELEGATE to a sub-agent (Constitution V)
- [ ] T006 Decide attached-vs-fresh per the canary (research R3/R2): if all canary commands non-empty → US4 proceeds with `--attach`; else US4 falls back to fresh-run + title-off. Record the single-line verdict in `specs/010-agent-latency-reuse/adr.md` Decision section. DELEGATE to a sub-agent

**Checkpoint**: Warm-reuse gated on evidence; US1/US2/US3 may start immediately in parallel.

---

## Phase 3: User Story 1 - Get Fast Replies (Priority: P1) 🎯 MVP

**Goal**: Cut send-to-reply from ~40s to ~20s by disabling the throwaway auto-title call on the deployed opencode invocation (guaranteed win, independent of serve-reuse). Server-side only — local opencode unaffected.

**Independent Test**: Deploy, run a "today" command, read deployed logs: NO title-generation LLM call appears and send-to-reply drops by ~20s (quickstart §2).

### Implementation for User Story 1

- [X] T007 [US1] Add a fixed non-empty `--title "life-os-agent"` argument to the `spawn`ed `opencode run` command in `deploy/discord-agent/src/agent/client.js` (the spawn args array ~line 63-71), per research R1 (must be non-empty; empty string re-triggers the call)
- [X] T008 [US1] If the deployed DEBUG logs still show ~20s after T007, investigate whether a `summary` (not title) call dominates (research R1 caveat); record finding in `specs/010-agent-latency-reuse/research.md`

**Checkpoint**: US1 latency drop verified in deployed logs; still no convo carried (FR-003).

---

## Phase 4: User Story 2 - Handle a Burst Without Crashing (Priority: P2)

**Goal**: Global single-slot in-memory queue — exactly one agent turn in flight across all channels, no OOM on ~1GB host, no messages dropped.

**Independent Test**: Send ~10 messages back-to-back (same channel, then across channels); all answered in order, at most one turn in flight, no crash/OOM (quickstart §1).

### Implementation for User Story 2

- [X] T009 [P] [US2] Replace `deploy/discord-agent/src/bridge/queue.js` `ChannelQueue` with a global single-slot FIFO: an array of pending jobs + one boolean in-flight + a `enqueue(channelId, fn)` that chains on a single process-wide promise (no per-channel keying); preserve FIFO ordering and no-drop semantics per `data-model.md` Wait Queue
- [X] T010 [US2] Update `deploy/discord-agent/src/bridge/client.js` to use the new global queue (drop `channelId` chain keying; keep `channelId` only for reply routing/logging per `contracts/latency-contract.md`)

**Checkpoint**: Burst of 10 answered serially, at most one turn in flight, process stable.

---

## Phase 5: User Story 3 - Stay at $0 Cost (Priority: P2)

**Goal**: Reclaim running billable AWS resources so monthly spend is $0; no new billable infra.

**Independent Test**: Audit account (`aws.sh` + billing dashboard) → $0 spend, no billable service running (quickstart §5).

### Implementation for User Story 3

- [ ] T011 [P] [US3] Audit current running AWS resources via `./aws.sh ecs list-services` + `./aws.sh ec2 describe-instances` + billing dashboard; list all billable resources into `specs/010-agent-latency-reuse/research.md` (Reclaim audit section)
- [ ] T012 [P] [US3] Stop/remove identified billable ECS services / EC2 instances outside the minimal free-tier host (confirm each resource's non-essential-ness before removal per plan Step 1); keep `desiredCount=1` discord-agent free-tier task
- [ ] T013 [P] [US3] Verify $0: re-run audit + billing check, record final $0 confirmation in `research.md` Reclaim result

**Checkpoint**: $0 confirmed; no billable resources running.

---

## Phase 6: User Story 4 - Reuse Warm Startup Where Proven (Priority: P3)

**Goal**: Where the canary (T005/T006) proved `--attach` reliable, reuse the warm :4096 serve so boot/config/Jira-MCP init run once per process, not per message — while each message still starts a fresh, empty context (green-but-blank, FR-003).

**Independent Test**: With serve hot, run commands; each returns correct non-empty reply with no prior-conversation recall; boot/title/Jira re-init NOT redone per message (quickstart §4).

### Implementation for User Story 4 (depends on T005/T006 verdict)

- [ ] T014 [US4] Switch `deploy/discord-agent/src/agent/client.js` `runAgent` to route through the warm serve: `opencode run --dir <AGENT_DIR> --attach <serveUrl> --title "life-os-agent" --thinking <message>` (per research R2/R3), keeping the spawn/heartbeat/timeout structure intact
- [ ] T015 [US4] Verify green-but-blank: send "remember the number 7" then "what number was that?" → no recall (FR-003, quickstart §3); Jira connection stays hot across messages (FR-005)
- [ ] T016 [US4] If the canary verdict was FALLBACK (T006 rejected attach): do NOT implement T014/T015; instead keep fresh-run + title-off and mark US4 complete via the fallback rationale recorded in T006

**Checkpoint**: US4 either adopted (reuse, hot Jira, blank context) or safely fell back.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Lock in evidence; no vertical/scale engineering (horizontal scope).

- [ ] T017 [P] Update `specs/010-agent-latency-reuse/research.md` with final measured p50 send-to-reply (from logs) after US1-US4; confirm ≤20s or record the blocker
- [X] T018 [P] Update `deploy/discord-agent/README.md` with the fixed-`--title`, single-slot queue, and (if adopted) warm-reuse behavior notes
- [ ] T019 Run `deploy/discord-agent/quickstart.md` validation end-to-end (burst, title-off, no-leak, gated reuse, $0 audit, latency)
- [X] T020 Confirm FR coverage in `specs/010-agent-latency-reuse/checklists/requirements.md` and finalize the ADR consequences

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: no deps — start immediately.
- **Foundational (P2)**: after Setup; **only gates US4**, not US1/US2/US3.
- **US1 (P1)**: after Setup — parallelizable with US2, US3, and T005/T006.
- **US2 (P2)**: after Setup — parallelizable with US1 & US3 (different files).
- **US3 (P2)**: after Setup — pure infra, parallel with US1/US2.
- **US4 (P3)**: depends on Foundational canary (T005/T006) AND US1 (both touch `agent/client.js`) → SEQUENTIAL after US1.
- **Polish (P7)**: after all desired stories.

### User Story Dependencies

- **US1 (P1)**: independent (touch `agent/client.js` title only).
- **US2 (P2)**: independent (touch `queue.js` + `bridge/client.js`).
- **US3 (P2)**: independent (AWS infra).
- **US4 (P3)**: depends on US1 (same `agent/client.js`) + Foundational canary verdict.

### File-Conflicts (why some are NOT parallel)

- `deploy/discord-agent/src/agent/client.js` — touched by US1 (T007) and US4 (T014) → US4 sequential after US1.
- `deploy/discord-agent/src/bridge/client.js` — touched only by US2 (T010) → no conflict.
- `queue.js` — only US2 → no conflict.
- AWS infra — only US3 → no conflict.

### Parallel Opportunities (safe, different files)

- T002/T003/T004 (Setup) can run together.
- T005/T006 (canary) + US1 + US2 + US3 can all start in parallel after Setup.
- T011/T012/T013 (US3 audit/remove/verify) sequential within story.

---

## Parallel Example: Agent Dispatch (per Constitution V — max 2-3 sub-agents)

```bash
# After Phase 1-2:
Agent A (US1 - fast replies):   "T007 add fixed --title in deploy/discord-agent/src/agent/client.js; T008 investigate if summary dominates"
Agent B (US2 - single-slot):    "T009 rewrite deploy/discord-agent/src/bridge/queue.js to global single-slot; T010 rewire bridge/client.js"
Agent C (US3 - $0 reclaim):     "T011 audit, T012 stop billable resources, T013 verify $0 via ./aws.sh"
# Pending canary (T005/T006) completes:
Agent D (US4 - warm reuse, after US1): "T014 switch runAgent to --attach; T015 verify green-but-blank; else T016 fallback"
```

> T005/T006 (canary + verdict) and US2 can run in parallel — they touch separate concerns.
> US4 MUST wait for US1 (same file `agent/client.js`) and the canary verdict.

---

## Implementation Strategy

### MVP First (US1 only — guaranteed ~20s win, lowest risk)

1. Phase 1 Setup → 2. Phase 3 US1 (title-off) → 3. **STOP & VALIDATE** latency drop → deploy.

### Incremental Delivery

1. Setup → US1 → validate → deploy (MVP).
2. Add US2 (burst safety) → validate → deploy.
3. Add US3 ($0 reclaim) → validate.
4. Add US4 (warm reuse) only if canary passed → validate → deploy.

### Parallel Strategy

- Run US1 + US2 + US3 + canary(T005/6) in parallel after Setup (Constitution V max 3 sub-agents — run US1, US2, canary first; US3 infra second wave).
- US4 sequential after US1 + canary verdict.
- Each story independently testable before the next begins.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps to user story for traceability.
- Verify each story independently before starting the next (checkpoints).
- Commit after each task or logical group (git).
- Warm-reuse (US4) is strictly gated on the canary evidence — never ship unverified `--attach` (FR-008).
- Local opencode on the maintainer Macbook is never modified; all changes are in deployed `deploy/discord-agent`.
- Avoid: touching `agent/client.js` from US1 and US4 at the same time (conflict).
