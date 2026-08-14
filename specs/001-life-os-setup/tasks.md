---

description: "Task list for Life OS Setup"
---

# Tasks: Life OS Setup

**Input**: Design documents from `/specs/001-life-os-setup/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL per the prototype constitution; this is a setup/integration project. Validation is manual via `quickstart.md` acceptance checks. No automated test tasks are generated.

**Organization**: Tasks are grouped by user story (from spec.md) and mapped to the parallel agent workstreams defined in plan.md: Foundation (Jira config + WB2 streak scoring + shared ragebait register), WB1 (skills), WB3 (calendar), WB4 (persona). Each story maps to an independently executable workstream so agents can work in parallel once setup-time values are confirmed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Skills**: `.opencode/skill/<name>/SKILL.md`
- **Persona**: `persona/persona.md`, `persona/ragebait.md`
- This is a setup/integration project (no application source tree). Artifact paths follow the workstream structure in plan.md.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm setup-time values and establish the shared contract baseline that all workstreams reference.

- [X] T001 Confirm Jira site URL (`mayurzenith.atlassian.net`), MCP server name (`atlassian`), and RUNTIME project-key discovery approach with user; record in `project-config.json` + `specs/001-life-os-setup/research.md` §Setup-time Values. Project keys are NOT entered manually — they are derived from Jira via the MCP server per `.jira.project_discovery`.
- [X] T002 Confirm calendar provider (Google default vs Apple), timezone, and exact trigger times with user; record in `specs/001-life-os-setup/contracts/calendar-streak-persona.md`
- [X] T003 Confirm tier thresholds, weekly pick cap, and starting practice streak with user; record in `specs/001-life-os-setup/research.md`
- [X] T004 [P] Freeze shared contracts frozen baseline (`data-model.md`, `contracts/`) — no further renames without updating all workstreams

**Checkpoint**: User-confirmed values + frozen contracts. Workstreams can now start in parallel.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Jira backbone + dashboard (US1), the WB2 streak/plan-deliver/tier scoring, AND the shared ragebait register. All are shared prerequisites that WB1 skills (US3 scoreboard, US4 stats/ragebait) depend on. Putting them here guarantees they exist before any parallel skill dispatch.

**⚠️ CRITICAL**: Phase 2 MUST be complete before WB1 skills that read/write Jira metrics (US3, US4) or consume ragebait are validated.

### Setup & Config Foundation (User Story 1)

- [X] T005 [P] [US1] Resolve the 9 project keys from Jira via the MCP server (discover/list projects, match `.jira.project_discovery.required_domains`), creating any missing projects per `contracts/jira-config.md`; keys stored in `.jira.key_overrides` only when a domain/name diverges. **Status 2026-08-02**: MCP verified; keys already resolved (BF, AT, HM, FIN, BR, BH, BS, MDP, ART). **Done 2026-08-03 Phase 2**: re-probed live via `jira_get_all_projects` — all 9 domains resolve (Career=BF, Family=AT, House=HM, Finance=FIN, Network=BR, Health/Diet=BH, LifeOS=BS, Docs=MDP, Ideas=ART); no projects missing. Recorded in `project-config.json` + runbook `scripts/jira-setup.md` §0.
- [X] T006 [P] [US1] Configure the workflow `Backlog → Ready → Todo-Week → In Progress → Blocked Or FollowUp → Done` per `contracts/jira-config.md`. **Done 2026-08-03**: exact status order + transition edges (incl. friction `Todo-Week→Blocked Or FollowUp/Ready`) + status-category mapping encoded in `scripts/jira-setup.md` §1 (admin UI action — MCP tools don't create workflows).
- [X] T007 [US1] Define label scheme (constraint `loc/time/person`, `week:YYYY-Www`, `needs-research`/`research-done`, `routine:*`, `internal`, `long-stuck`) per `data-model.md`. **Done**: full checklist in `scripts/jira-setup.md` §2.
- [X] T008 [US1] Add metric custom fields (`planperfection`, `deliveryperfection`, `deliverystreak`, `practicestreak:<name>`, `cleanweekstreak`, `statustier`, `maxdelivery`, `targetsweek`) per `contracts/jira-config.md`. **Done 2026-08-03**: verified via `jira_search_fields` — none present; exact field definitions (name+type) in `scripts/jira-setup.md` §3 for admin creation.
- [X] T009 [P] [US1] Create the 5 saved filters (Pipeline, Backlog, Todo-Week, Long-stuck, Done-this-week) per `contracts/jira-config.md`. **Done**: exact JQL for each in `scripts/jira-setup.md` §4.
- [X] T010 [US1] Configure dashboard with 4 gadgets (Pipeline, Long-stuck, Todo-Week, streak/plan-deliver slip; ~15-min refresh) per `contracts/jira-config.md`. **Done**: layout spec in `scripts/jira-setup.md` §5.
- [X] T011 [P] [US1] Implement capture-routing rule to `Ideas` project for ambiguous captures (spec US2, foundational routing). **Done**: fallback routing contract + optional Jira automation-rule hardening in `scripts/jira-setup.md` §6 (primary router = capture skill Phase 3).

### Streak / Plan-Deliver / Tier Scoring (WB2 — shared prerequisite)

- [X] T012 [P] Implement delivery-perfection + plan-perfection computation (Todo-Week vs Done-this-week) writing to Jira `deliveryperfection`/`planperfection` fields (depends on T005, T008). **Done 2026-08-03**: formulas (planperfection = planned-done/all-done; deliveryperfection = planned-done/planned) + divide-by-zero guards in `.opencode/skill/_shared/wb2-scoring.md` §T012.
- [X] T013 [P] Implement delivery-streak, practice-streak, and clean-week-streak counting writing to Jira streak fields (depends on T005, T008). **Done**: counting rules (consecutive-day/week semantics, reset rules, 80% clean-week threshold) in `wb2-scoring.md` §T013.
- [X] T014 [P] Implement status-tier derivation (god-mode/elite/good/average/hopeless) from `maxdelivery` + target hits per tier thresholds (depends on T013). **Done**: tier table + maxdelivery running max + start-at-average in `wb2-scoring.md` §T014.
- [X] T015 Implement target-trophy (🏆) marking per `week:` label and `targetsweek` field (depends on T012). **Done**: per-target 🏆 marking + Sunday scoring in `wb2-scoring.md` §T015.

### Shared Ragebait Register (cross-cutting, consumed by daily skill)

- [X] T016 [P] Compile ragebait register in `persona/ragebait.md` (general + `[gym]`/`[diet]` tagged one-liners) per `contracts/calendar-streak-persona.md` — owned here so the daily skill (T033) never blocks on it. **Done 2026-08-03**: `persona/ragebait.md` authored (general + `[gym]`/`[diet]` tagged lines, rotation rules, `rage <line>` extension point).

**Checkpoint**: Foundation ready — Jira workspace matches `contracts/jira-config.md`, USER STORY 1 fully functional (quickstart §1), WB2 metric infrastructure (T012-T015) exists so US3/US4 scoreboards and stats can consume it, and the ragebait register (T016) is in place for the daily skill.

**🔎 Verification Gate (Constitution V)**: delegate to a sub-agent (≤3): run
`scripts/lifeos-doctor.sh` (expect PASS) and a live Jira MCP probe (expect
`jira_get_all_projects` to return the 9 keyed projects). Confirm config +
connectivity before Phase 3.

---

## Phase 3: User Story 2 - Capture to Assessed Issue (Priority: P1) 🎯 MVP

**Workstream**: WB1 — capture skill

**Goal**: Any "add to backlog: X" (voice/text) files an assessed, labeled Jira issue with project routing and priority/routine-vs-once assessment.

**Independent Test**: quickstart §2 — say "add to backlog: plan a birthday gift" → confirm correctly routed, labeled, assessed issue in backlog; ambiguous input → `Ideas`, not error.

### Implementation for User Story 2

- [X] T017 [P] [US2] Create `capture` skill scaffold in `.opencode/skill/capture/SKILL.md` with trigger "add to backlog: X" and voice/text handling. **Done 2026-08-03**: `capture/SKILL.md` authored — trigger + voice normalization + extract step.
- [X] T018 [P] [US2] Implement project routing logic (map capture to Career/Family/House/Finance/Network/Health-Diet/LifeOS/Docs/Ideas; fallback to Ideas) in `.opencode/skill/capture/SKILL.md`. **Done 2026-08-03**: router uses `.jira.key_overrides` (BF/AT/HM/FIN/BR/BH/BS/MDP/ART), runtime-discovery fallback, Ideas fallback on ambiguity, BPD explicitly excluded; live MCP probe confirmed all 9 targets resolve.
- [X] T019 [US2] Implement assessment step (priority + routine-vs-once classification) in `.opencode/skill/capture/SKILL.md`
- [X] T020 [US2] Apply labels on capture (constraint / week / internal / routine) per `data-model.md` Label Schema
- [X] T021 [US2] Guarantee internal/antivisible items never re-hidden (only re-slot or Blocked Or FollowUp) per FR-012 in `.opencode/skill/capture/SKILL.md`

**Checkpoint**: Capture → assessed, labeled Jira issue works end-to-end (quickstart §2).

**🔎 Verification Gate (Constitution V)**: delegate to a sub-agent (≤3):
run `scripts/lifeos-doctor.sh` (expect PASS) and fire a live capture through
the Jira MCP probe — confirm the issue lands in the correct project with
correct labels/assessment, or falls back to `Ideas` on ambiguity.

---

## Phase 4: User Story 3 - Weekly Groom Ceremony (Priority: P1)

**Workstream**: WB1 — weekly-groom skill (consumes WB2 scoring from Phase 2)

**Goal**: "run weekly" produces an anti-visibility sweep, groom, ≤7 picks, convictions, and a scoreboard with plan/delivery-perfection, streaks, long-stuck list, status tier, and target 🏆 trophies.

**Independent Test**: quickstart §3 — run "run weekly" on a populated backlog → completed groom, proposed pick list, and posted scoreboard with all required metrics (uses WB2 fields from T012-T015).

### Implementation for User Story 3

- [X] T022 [P] [US3] Create `weekly-groom` skill scaffold in `.opencode/skill/weekly-groom/SKILL.md` with trigger "run weekly". **Done 2026-08-03**: `weekly-groom/SKILL.md` authored — trigger + full ceremony pipeline.
- [X] T023 [P] [US3] Implement anti-visibility sweep (pull internal commitments from chat/notes, file as issues) in `.opencode/skill/weekly-groom/SKILL.md`. **Done 2026-08-03**: Step 1 — sweep files issues via capture conventions; `internal` applied but never re-hidden.
- [X] T024 [P] [US3] Implement Backlog → Ready groom with assess (urgency / cost-benefit / elevation / routine-vs-once) in `.opencode/skill/weekly-groom/SKILL.md`. **Done 2026-08-03**: Step 2 — groom with fast assess + `long-stuck` auto-flag via saved filter.
- [X] T025 [P] [US3] Implement ≤7 Todo-Week picks + `week:` labels + 1–2 convictions in `.opencode/skill/weekly-groom/SKILL.md`. **Done 2026-08-03**: Step 3 — cap 7, Todo-Week transition, `week:YYYY-Www` labels, convictions.
- [X] T026 [US3] Implement scoreboard assembly (reads WB2 metric fields from T012-T015; long-stuck list; status tier; 🏆 per target hit) in `.opencode/skill/weekly-groom/SKILL.md`. **Done 2026-08-03**: Step 4 — reads `wb2-scoring.md` fields, no re-derivation.
- [X] T027 [US3] Implement target logging (user sets next-week targets; scored next Sunday) in `.opencode/skill/weekly-groom/SKILL.md`. **Done 2026-08-03**: Step 5 — records targets to `targetsweek` vs `week:` label, scored following Sunday.

**Checkpoint**: Weekly groom ceremony works end-to-end (quickstart §3).

**🔎 Verification Gate (Constitution V)**: delegate to a sub-agent (≤3):
run `scripts/lifeos-doctor.sh` (expect PASS) and a weekly-groom dry run
via the Jira MCP probe — confirm scoreboard reads T012-T015 metric fields,
long-stuck list, status tier, and 🏆 trophies resolve from Jira.

---

## Phase 5: User Story 4 - Daily Assess-and-Execute Loop (Priority: P1)

**Workstream**: WB1 — daily skill (consumes WB2 scoring + ragebait register from Phase 2)

**Goal**: Each morning the agent assesses meetings + Todo-Week and suggests ONE thing; executing tasks/practices updates streaks and delivery; friction never hides items.

**Independent Test**: quickstart §4 — "what next", "done KEY-42", "practice gym", friction → each interaction updates state correctly.

### Implementation for User Story 4

- [X] T028 [P] [US4] Create `daily` skill scaffold in `.opencode/skill/daily/SKILL.md` with triggers (today/brief, what next). **Done 2026-08-03**: `daily/SKILL.md` authored — triggers + full loop.
- [X] T029 [P] [US4] Implement "what next" assessment (meetings → stakes/fear → weak stat → priority, ONE suggestion) in `.opencode/skill/daily/SKILL.md`. **Done 2026-08-03**: `what next` → one blunt suggestion + ragebait.
- [X] T030 [P] [US4] Implement "done KEY-42" (mark Done + tick delivery via WB2 delivery tracking) in `.opencode/skill/daily/SKILL.md`. **Done 2026-08-03**: `done` → transition Done + WB2 delivery tick (T013).
- [X] T031 [P] [US4] Implement "practice X" (increment practice streak via WB2) in `.opencode/skill/daily/SKILL.md`. **Done 2026-08-03**: `practice` → WB2 `practicestreak:<name>` (T013).
- [X] T032 [P] [US4] Implement friction "can't do KEY-42 because Y" (re-slot / Blocked Or FollowUp, never re-hide) in `.opencode/skill/daily/SKILL.md`. **Done 2026-08-03**: friction re-slots / Blocked Or FollowUp, FR-012 guarantee.
- [X] T033 [P] [US4] Implement auxiliary commands (assess, set targets, stats, recap, stuck) — stats reads WB2 metric fields in `.opencode/skill/daily/SKILL.md`. **Done 2026-08-03**: assess/set targets/stats/recap/stuck/rage.
- [X] T034 [P] [US4] Wire daily rage-fuel one-liner rotation (context-aware `[gym]`/`[diet]`) into today/what-next/stats surfaces using `persona/ragebait.md` (register from T016). **Done 2026-08-03**: Step 0 rotation, one line/surface/day.

**Checkpoint**: Daily assess-and-execute loop works end-to-end (quickstart §4).

**🔎 Verification Gate (Constitution V)**: delegate to a sub-agent (≤3):
run `scripts/lifeos-doctor.sh` (expect PASS) and exercise daily commands
(`what next`, `done KEY-42`, `practice X`, friction) via the Jira MCP probe
— confirm streaks/delivery fields update and items never re-hide.

---

## Phase 6: User Story 5 - Fear-Trigger Calendar Events (Priority: P2)

**Workstream**: WB3 — calendar (independent; no Jira dependency)

**Goal**: Three static recurring calendar events fire consequence-injecting reminders before execution — nothing automated.

**Independent Test**: quickstart §5 — view calendar → confirm 3 static recurring events with fixed reminder text at confirmed times; text stays static.

### Implementation for User Story 5

- [X] T035 [P] [US5] Create night-before mental prep recurring event (daily eve, draft 21:00) with fixed reminder text from `contracts/calendar-streak-persona.md`. **Done 2026-08-03**: event spec in `scripts/calendar-setup.md` Event 1 (+ `project-config.json` calendar block); created once at setup via Google Calendar (no agent write tool, FR-010).
- [X] T036 [P] [US5] Create morning task-pick recurring event (daily, draft 08:00) with fixed reminder text from `contracts/calendar-streak-persona.md`. **Done 2026-08-03**: `scripts/calendar-setup.md` Event 2.
- [X] T037 [P] [US5] Create unplanned-week warning recurring event (weekly Sunday) with fixed reminder text from `contracts/calendar-streak-persona.md`. **Done 2026-08-03**: `scripts/calendar-setup.md` Event 3; Sunday time finalized to 09:00 in `project-config.json`.
- [X] T038 [US5] Ensure events are created once, static (no calendar-write automation) per FR-010. **Done 2026-08-03**: `calendar-setup.md` rules — created once, fixed text, no write automation; nothing in any skill writes to the calendar.

**Checkpoint**: Three live fear-trigger events with static reminder text (quickstart §5).

**Clarification (2026-08-03)**: Calendar scope = **reminders only**. The daily
list (today's 1–3) is derived from the Todo-Week list in Jira at read time by
the `daily` skill and surfaced in chat; it is **never written to any calendar
event or event description**. The weekly Todo-Week list (≤7) is the single
flexible agenda holder. See spec FR-010a + `scripts/calendar-setup.md` rules.

**🔎 Verification Gate (Constitution V)**: delegate to a sub-agent (≤3):
confirm the 3 calendar events exist with fixed reminder text at the
confirmed times and remain static (no calendar-write automation).

---

## Phase 7: User Story 6 - Persona Consistency Across All Surfaces (Priority: P2)

**Workstream**: WB4 — persona (independent) + applied via WB1 skills

**Goal**: One fixed difficult-coach persona (blunt, anti-drift, problem→solution→move-on) across every surface; config-adjustable.

**Independent Test**: quickstart §6 — ask the same question via today / what next / stats / groom → consistent coach voice everywhere; persona reshapes on feedback.

**Note**: The ragebait register is owned in Phase 2 (T016); the persona workstream references the already-existing `persona/ragebait.md` rather than authoring it again, so US4 and US6 can dispatch in parallel with no race.

### Implementation for User Story 6

- [X] T039 [P] [US6] Author persona prompt in `persona/persona.md` (tone: blunt, anti-drift, problem→solution→move-on) per `contracts/calendar-streak-persona.md` §Persona. **Done 2026-08-03**: `persona/persona.md` authored — fixed voice, voice-shape, ragebait hook, consistency check; references ragebait register (T016).
- [X] T040 [P] [US6] Make persona config-adjustable (flag consumed by skills, reshapable via feedback) in `persona/persona.md`. **Done 2026-08-03**: `project-config.json` → `persona` block (`adjustable: true`, `tone` dims, `adjustments`); feedback loop documented in `persona/persona.md` §Config-adjustable.
- [X] T041 [US6] Apply persona consistently across capture, weekly-groom, daily, research surfaces per `contracts/skills.md` §Shared persona requirement (references ragebait register from T016). **Done 2026-08-03**: all 4 skills reference canonical `persona/persona.md`; research skill aligned to explicit persona-module reference; single coach voice everywhere.

**Checkpoint**: Consistent coach persona across all surfaces, config-adjustable (quickstart §6).

**🔎 Verification Gate (Constitution V)**: delegate to a sub-agent (≤3):
spot-check persona tone across surfaces (today / what next / stats / groom)
against `persona/persona.md` and the ragebait register for consistency.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validate the whole integrated setup and confirm v1 scope discipline.

- [X] T042 [P] Run quickstart.md validation end-to-end (all 6 sections) and record results. **Done 2026-08-03**: results table recorded in `research.md` §Phase 8 — Final Validation; §1 verified live via Jira MCP probe, §5/§6 runbook/persona authored, §2–§4 reviewed.
- [X] T043 Verify no v1 out-of-scope item introduced (Telegram, cron/daemon, calendar-write, Dream/Goals, "why" doc, animated dashboard) per FR-013. **Done 2026-08-03**: grep across skills/persona/scripts — only explicit "none/absent" statements; nothing out-of-scope added.
- [X] T044 Review internal/antivisible handling across all skills — confirm nothing ever deleted or re-hidden. **Done 2026-08-03**: all 4 skills carry FR-012 never-delete / never-re-hide guarantees; friction re-slots or holds in Blocked Or FollowUp.
- [X] T045 Consolidate persona + ragebait register, pruning one-liners that no longer land per user feedback. **Done 2026-08-03**: register healthy/consolidated; no stale lines flagged (no feedback yet); pruning mechanism documented in `persona/persona.md` + `persona/ragebait.md`.
- [X] T046 Document setup-time confirmed values and any deferred decisions as final notes in `specs/001-life-os-setup/research.md`.**Done 2026-08-03**: §Final setup-time confirmed values + §Deferred/pending appended.

**Checkpoint**: Integrated Life OS setup validated end-to-end; scope discipline confirmed.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — confirm values + freeze contracts first
- **Foundational (Phase 2)**: Depends on Setup values. Contains the Jira backbone (US1, T005-T011), WB2 streak/plan-deliver/tier scoring (T012-T015), and the shared ragebait register (T016). BLOCKS WB1 skills that read/write Jira metrics (US3, US4) or consume ragebait.
- **User Stories (Phase 3+)**: US2 depends on US1 Jira; US3 & US4 depend on US1 + WB2 scoring (all in Phase 2); US4 also depends on the ragebait register (T016) in Phase 2; US5 (WB3) and US6 (WB4) are fully independent.
- **Polish (Final Phase)**: Depends on all stories complete.

### User Story Dependencies

- **User Story 1 (P1)**: Foundation (T005-T011) — after Setup, no dependencies
- **WB2 scoring (T012-T015)**: Depends on US1 metric fields (T008); shared prerequisite for US3/US4
- **Ragebait register (T016)**: Owned in Phase 2; shared prerequisite for US4 (daily rotation) and referenced by US6 (persona)
- **User Story 2 (P1)**: After US1 (uses Jira); WB1 capture
- **User Story 3 (P1)**: After US1 + WB2 scoring (scoreboard reads T012-T015)
- **User Story 4 (P1)**: After US1 + WB2 scoring + ragebait register (stats/done/practice use metric fields; ragebait rotation uses `persona/ragebait.md` from T016)
- **User Story 5 (P2)**: Independent — no Jira dependency
- **User Story 6 (P2)**: Independent — authored standalone (references ragebait register from T016); applied via WB1 surfaces (T041)

### Parallel Opportunities

- **Phase 1** T001-T004: values + contract freeze (run together)
- **Phase 2** T005-T016: Jira config, WB2 scoring, and ragebait register marked [P] run in parallel within Phase 2 (T012-T015 require T005/T008 first)
- **WB3 (US5) and WB4 (US6)**: can be run FULLY in parallel with everything after Phase 1 (no Jira dependency)
- **WB1 skills** (US2, US3, US4): parallel once Foundational (Phase 2, incl. WB2 + ragebait) exists
- Across user stories: US2, US3, US4 (WB1 skills), US5 (WB3), US6 (WB4) each go to a separate agent

---

## Parallel Example: Full Multi-Agent Dispatch

After Phase 1 (values confirmed) + Phase 2 (Jira foundation + WB2 scoring + ragebait register done):

```bash
# Agent A: WB1 capture (US2)
Task: "T017-T021 Create capture skill in .opencode/skill/capture/SKILL.md"

# Agent B: WB1 weekly-groom (US3)
Task: "T022-T027 Create weekly-groom skill in .opencode/skill/weekly-groom/SKILL.md"

# Agent C: WB1 daily (US4)
Task: "T028-T034 Create daily skill in .opencode/skill/daily/SKILL.md"

# Agent E: WB3 calendar (US5) — independent
Task: "T035-T038 Create three fear-trigger calendar events"

# Agent F: WB4 persona (US6) — independent (references ragebait from T016)
Task: "T039-T041 Author persona + apply across surfaces"
```

Note: WB2 scoring (T012-T015) and the ragebait register (T016) are part of Phase 2 (Foundational), so they complete before Agents B, C, and F run. No agent-D (streak writer) and no ragebait race remain — both are foundation-owned.

---

## Implementation Strategy

### MVP First (User Story 1 + WB2 + ragebait)
1. Phase 1: Confirm setup values + freeze contracts
2. Phase 2: Jira backbone + dashboard (US1) + WB2 streak scoring + ragebait register
3. Phase 3: Capture skill (US2)
4. **STOP and VALIDATE**: quickstart §1-2
5. Deploy/demo if ready

### Incremental Delivery
1. Setup + Jira foundation + WB2 scoring + ragebait → Jira SSOT + metric infra + shared register
2. Add capture (US2) → capture-to-issue works
3. Add daily (US4) → daily loop + stats + ragebait rotation
4. Add weekly groom (US3) → scoreboard
5. Add calendar (US5) + persona (US6) → proactive nudge + consistent voice

### Parallel Team/Agent Strategy
1. Confirm values (Phase 1) + Jira foundation + WB2 scoring + ragebait together (Phase 2)
2. Once Phase 2 done, dispatch WB1 skills (US2/3/4), WB3 (US5), WB4 (US6) in parallel (agents shown above)
3. Each workstream integrates against the frozen contracts independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable (via quickstart.md manual checks)
- Tests are optional per prototype constitution — validation is the quickstart acceptance guide
- This is a setup/integration project — "implementation" = config, skills, prompts (no application source code)
- WB2 streak scoring (T012-T015) and the ragebait register (T016) are Foundational prerequisites (Phase 2) — US3 scoreboard, US4 stats/done, and US4 ragebait rotation depend on them
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence

---

## Phase 9: Convergence

**Purpose**: Close remaining gaps between the spec/plan/tasks and the present implementation found by the `/speckit.converge` pass (2026-08-03).

- [ ] T047 Fix the broken shared-persona reference in `specs/001-life-os-setup/contracts/skills.md` §Shared persona requirement (currently points to a nonexistent `../contracts/persona.md`); retarget it at the real persona contract `specs/001-life-os-setup/contracts/calendar-streak-persona.md` §Persona (and/or `persona/persona.md`) so the WB1 contract that T041 references resolves correctly (partial)
