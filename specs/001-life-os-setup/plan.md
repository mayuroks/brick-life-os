# Implementation Plan: Life OS Setup

**Branch**: `001-life-os-setup` | **Date**: 2026-08-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-life-os-setup/spec.md`

## Summary

Build the Life OS personal-productivity agent as a **setup/integration
project** (not application code). Deliver the v1 surface from
`HANDOVER-FINAL.md`: a Jira SSOT backbone + visibility dashboard, a capture
surface, a weekly groom ceremony, a daily assess-and-execute loop, three
static fear-trigger calendar events, and one fixed coach persona. The plan
is decomposed into **independent agent workstreams** that share a fixed
contract layer so they can run in parallel without cross-blocking.

## Technical Context

**Language/Version**: N/A — this is a configuration + integration project
(no application source code). Primary artifacts: Jira config, calendar
events, skill definitions (`.opencode/skill/`), a persona prompt.

**Primary Dependencies**: Jira (MCP server), Google Calendar (default),
agent skills runtime (OpenCode).

**Setup-time values (confirmed 2026-08-02)**: Jira site URL
`https://mayurzenith.atlassian.net`; Jira MCP server name `atlassian`.
Project keys are **derived at runtime** via the MCP server
(`.jira.project_discovery` in `project-config.json`) — the 9 canonical
domains (Career…Ideas) stay as the routing map, but real keys come from
Jira, not from manual entry. Calendar = Google, local tz, default times.
Scoring = draft defaults (tiers, cap ≤7, start 1 streak at average).

**Storage**: Jira (SSOT) — projects, issues, labels, and metric custom
fields/labels.

**Testing**: Optional/minimal per prototype constitution; manual acceptance
checks per `quickstart.md`.

**Target Platform**: Jira Cloud + Google Calendar; agent surfaces in OpenCode
chat.

**Project Type**: setup / integration project (config + skills + prompts).

**Performance Goals**: N/A (single-user; dashboard ~15-min refresh).

**Constraints**: v1 scope only — no Telegram bot, cron/daemon,
calendar-write automation, Dream/Goals Epics, "why" doc, animated dashboard
(FR-013). Internal items never hidden (FR-012).

**Scale/Scope**: 9 Jira projects, single user, 4 skills, 3 calendar events,
1 persona.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **SSOT (Jira)**: PASS — Jira is the single source of truth throughout.
- **Agent as Interface**: PASS — skills deliver assess/grill/judge; user
  executes.
- **Fear + Streaks + Metrics**: PASS — motivates delivery via fear-triggers,
  streaks, plan/delivery-perfection, tiers.
- **Prototype Pragmatism**: PASS — minimal ceremony, optional tests, ship v1
  scope, iterate on feedback.
- **Scope (v1)**: PASS — only Jira config, 3 calendar events, 4 skills,
  streak tracker, persona prompt; nothing out-of-scope added.

## Execution Strategy: Parallel Agent Workstreams

Design artifacts (`research.md`, `data-model.md`, `contracts/`, `quickstart.md`)
define the **shared, frozen contract layer**. The foundation workstream (Jira
config) is a prerequisite; all other workstreams depend ONLY on the contracts,
not on each other, so they can run in parallel once the foundation is done and
setup-time values are confirmed.

Workstream dependency graph (only truly blocking edges shown):

```text
[Foundation] JIRA CONFIG (projects, workflow, labels, filters, dashboard,
metrics fields)  ← user confirms URL/keys/MCP
        │
        ├──(contracts only)──▶ WB1 SKILLS (capture, weekly-groom, daily,
        │                                   research)
        ├──(contracts only)──▶ WB2 STREAK/PLAN-DELIVER TRACKER
        ├──(no dep)──────────▶ WB3 CALENDAR FEAR-TRIGGER EVENTS
        └──(no dep)──────────▶ WB4 PERSONA PROMPT + RAGEBAIT REGISTER
```

Setup-time values (user confirms once, unblocks all workstreams): Jira site
URL + project keys + MCP auth, calendar provider (Google/Apple) + times +
timezone, tier thresholds, weekly cap, start practice streak.

## Workstreams (agent task boundaries)

### Foundation — Jira Config (prerequisite; others reference its contracts)
**Owner agent**: jira-config
- Resolve the 9 project keys from Jira via the MCP server
  (discover/list projects, matching the `.jira.project_discovery` domain
  map in `project-config.json`), create any missing projects, then
  workflow + labels + 5 saved filters + dashboard gadgets + metric custom
  fields exactly per `contracts/jira-config.md` and `data-model.md`.
- **Deliverable**: verified Jira workspace matching the contract; project
  keys resolved from Jira (runtime discovery), not hardcoded.
- **Depends on**: user confirms Jira URL/MCP; MCP server live in agent.

### WB1 — Skills (capture, weekly-groom, daily, research)
**Owner agent**: skills
- Author the four skills under `.opencode/skill/` per
  `contracts/skills.md`, sharing persona + data-model conventions.
- **Depends on**: Foundation contracts (frozen); no dependency on WB2-4.
- **Deliverable**: four runnable skill definitions.

### WB2 — Streak / Plan-Deliver / Tier Tracker
**Owner agent**: streaks
- Implement scoring (delivery/plan-perfection, delivery/practice/clean-week
  streaks, status tier, target trophies) writing to Jira metric fields per
  `contracts/calendar-streak-persona.md` §Streak Scoring + `jira-config.md`.
- **Depends on**: Foundation contracts; collaborates with WB1 on where
  scores surface in `stats`.
- **Deliverable**: scoring + scoreboard logic.

### WB3 — Calendar Fear-Trigger Events
**Owner agent**: calendar
- Create 3 static recurring events per
  `contracts/calendar-streak-persona.md` §Calendar.
- **Scope (FR-010)**: reminders ONLY. The daily list (today's 1–3) is
  derived from the Todo-Week list in Jira at read time by the daily skill
  and surfaced in chat — it is NEVER written to any calendar event or event
  description. The weekly Todo-Week list is the single flexible agenda.
- **Depends on**: user confirms provider/times/timezone; NO dependency on
  Jira/other workstreams (independent).
- **Deliverable**: 3 live recurring events with fixed reminder text.

### WB4 — Persona Prompt + Ragebait Register
**Owner agent**: persona
- Author the difficulty-coach persona prompt + ragebait one-liner register
  per `contracts/calendar-streak-persona.md` §Persona.
- **Depends on**: none. Configuration consumed by WB1 skills.
- **Deliverable**: persona + register, config-adjustable.

## Project Structure

### Documentation (this feature)

```text
specs/001-life-os-setup/
├── plan.md              # this file
├── research.md          # Phase 0 decisions
├── data-model.md        # shared entities/labels/validation
├── quickstart.md        # end-to-end validation guide
├── contracts/
│   ├── jira-config.md            # foundation contract
│   ├── skills.md                 # WB1 contract
│   └── calendar-streak-persona.md # WB3/WB2/WB4 contract
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source / Artifacts (repository root)

```text
project-config.json      # runtime config: Jira URL, MCP server, project keys,
                         # calendar, scoring. Single source all workstreams read.
opencode.json            # agent MCP config: 'atlassian' (uvx mcp-atlassian)
scripts/lifeos-doctor.sh # connectivity/config doctor (all checks PASS)
.opencode/skill/          # WB1 — capture, weekly-groom, daily, research
  ├── capture/SKILL.md
  ├── weekly-groom/SKILL.md
  ├── daily/SKILL.md
  └── research/SKILL.md
persona/                 # WB4 — coach persona + ragebait register
  ├── persona.md
  └── ragebait.md
```

**Structure Decision**: Artifacts are configuration/skills/prompts organized
by the four workstreams (WB1-4) plus the Jira config contract. No application
source tree is needed; fully parallelizable per agent.

## Verification Across Phases (per Constitution Principle V)

Every phase ends with a **verification checkpoint** that confirms its
external dependencies and outputs are live before the next phase starts.
Verification, install, and connection-test work is **delegated to sub-agents**
(≤3 per task, per Constitution Principle V) so the primary agent stays
responsive instead of blocking on long-running probes.

- **`scripts/lifeos-doctor.sh`** is the recurring gate for config +
  connectivity. It validates `project-config.json` (placeholders, static
  values, MCP `configured`) and reports PASS/FAIL per check. Run it at each
  phase checkpoint via a sub-agent.
- **Jira MCP probe** (confirmed 2026-08-02): REST `/myself` → 200; MCP
  handshake OK (63 `jira_*` tools); live `jira_get_all_projects` succeeded.
  Re-run a sub-agent probe whenever Jira auth/scope changes.
- **Project keys** are resolved at runtime from Jira (`.jira.key_overrides`,
  populated 2026-08-02: Career=BF, Family=AT, House=HM, Finance=FIN,
  Network=BR, Health/Diet=BH, LifeOS=BS, Docs=MDP, Ideas=ART). Re-run
  discovery when domains/projects change.

## Complexity Tracking

None — Constitution Check passes with no unjustified violations. Single-user
setup project; no added complexity beyond the four documented workstreams.

## Phase Outputs (already generated by this plan)

- `research.md` — all unknown decisions resolved (MCP transport, streak data
  in Jira, calendar defaults, tier thresholds).
- `data-model.md` — shared entities, label schema, validation rules.
- `contracts/` — frozen interfaces for Jira config, skills, calendar/streak/
  persona.
- `quickstart.md` — manual acceptance validation guide.
