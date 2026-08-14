# Research: Life OS Setup

**Feature**: Life OS Setup | **Date**: 2026-08-02

## 1. Agent→Jira Transport

- **Decision**: Use a Jira MCP server.
- **Rationale**: This is a setup/integration project, not a coding project.
  An MCP server keeps the agent's Jira interactions declarative (search,
  create, transition, add label) with no token plumbing in the repo, and is
  the lowest-effort path that still treats Jira as SSOT.
- **Alternatives considered**:
  - REST API + macOS Keychain token — more control but more setup/plumbing;
    rejected as overkill for a prototype.
- **Contract dependency**: Jira config must expose project keys, workflow
  statuses, and label names that all other workstreams reference.

## 2. Streak/Plan-Deliver Data Location

- **Decision**: Store metric data in Jira via fields/labels (Jira as SSOT).
- **Rationale**: Keeps a single source of truth; avoids a second local file
  that could drift from the visible record. Data source = Todo-Week vs
  Done-this-week filters; derived values (perfection %, streaks, tier)
  written into Jira custom fields / label scheme.
- **Alternatives considered**: Local agent-maintained file — simpler metrics
  but splits the source of truth; rejected on SSOT principle.
- **Contract dependency**: Define where perfection/streak/tier values live
  (Jira fields + `week:YYYY-Www` / `routine:*` labels).

## 3. Calendar Provider & Triggers

- **Decision**: Google Calendar, three static recurring events created once
  at setup:
  - Night-before mental prep — daily evening (draft 21:00)
  - Morning task-pick — daily (draft 08:00)
  - Unplanned-week warning — weekly Sunday
- **Rationale**: Static recurring events with fixed reminder text = no
  calendar-write automation (out of scope); reminders inject consequence.
- **Alternatives considered**: Apple Calendar — acceptable; confirm at setup.
- **Open**: exact times/timezone to be confirmed by user during setup.

## 4. Jira Site & Auth (setup-time values)

- **Decision**: Confirm real Jira site URL, user credentials, and project
  keys with the user at setup. Examples in HANDOVER-FINAL differ from real.
- **Rationale**: Cannot be assumed; blocked on user-provided values.

## §Setup-time Values (confirmed 2026-08-02)

> Runtime values live in `project-config.json` (repo root) — the single
> source that all workstreams read. The doctor
> (`scripts/lifeos-doctor.sh`) verifies completeness + connectivity.
> Do NOT hardcode values in docs when they belong in the config file.

### Jira (T001)
- **Site URL**: `https://mayurzenith.atlassian.net` (confirmed 2026-08-02).
- **Jira MCP server**: name = `atlassian`, **configured + VERIFIED 2026-08-02**.
  `sooperset/mcp-atlassian` (via `uvx`), wired in project `opencode.json`
  (local, env `JIRA_URL`/`JIRA_USERNAME`/`JIRA_API_TOKEN`). Probe OK: REST
  `/myself` HTTP 200 (Mayur Rokade, active); MCP handshake OK — 63 tools,
  live `jira_get_all_projects` succeeded.
- **Project keys — RUNTIME DISCOVERY (design decision)**: keys are NOT
  entered manually. `.jira.project_discovery` defines the 9 canonical
  **domains** (Career, Family, House, Finance, Network, Health/Diet, LifeOS,
  Docs, Ideas); the real key for each is DERIVED by querying Jira via the
  MCP server (discover/list projects, match on name/lead) at setup/run time.
  **Resolved live 2026-08-02** and recorded in `.jira.key_overrides`:
  Career=BF, Family=AT, House=HM, Finance=FIN, Network=BR,
  Health/Diet=BH, LifeOS=BS, Docs=MDP, Ideas=ART. (`BPD`=Personal
  Development exists but is unused by the 9-domain map.)
- **Workflow / labels / metric fields / filters**: exact names frozen in
  `contracts/jira-config.md` + `data-model.md`; real keys resolved from Jira.

### Calendar (T002)
- **Provider**: **Google** (default confirmed).
- **Timezone**: local.
- **Trigger times (default draft kept)**: night-before mental prep daily
  eve 21:00; morning task-pick daily 08:00; unplanned-week warning weekly
  Sunday (draft 09:00 in the config — confirm at setup).
- **Rule**: created once, static reminder text, NO calendar-write automation.

### Scoring (T003)
- **Tier thresholds (draft kept)**: god-mode ≥95% + all targets, elite ≥90%,
  good ≥75%, average ≥50%, else hopeless.
- **Weekly pick cap**: ≤7.
- **Starting practice streak**: 1; user starts at status **average**.

### How-To: verify connections (values provided + verified)

1. `project-config.json` has `.jira.site_url` = `https://mayurzenith.atlassian.net`,
   `.jira.mcp.server_name` = `atlassian`, `.jira.mcp.configured = true`.
   No `PLACEHOLDER` values remain. Project keys resolved from Jira and
   recorded in `.jira.key_overrides`.
2. Jira MCP server is wired in project `opencode.json` (local
   `uvx mcp-atlassian` with Jira env vars). **Restart opencode** to load the
   new MCP config (config is not hot-reloaded).
3. Run `./scripts/lifeos-doctor.sh` → all checks PASS (config + MCP ready).
4. **Discovery probe** (verified 2026-08-02): query Jira via the MCP client
   and confirm all `.jira.project_discovery.required_domains` resolve to a
   real key. Already confirmed: `jira_get_all_projects` returned the 10
   projects; domains mapped above.
5. Pinning a key when Jira names diverge from a domain = add it to
   `.jira.key_overrides`.

### Deferred / pending
- Release Phase 1 task notes (verify MCP config loads after opencode restart).
- Exact Sunday trigger time (draft 09:00 in config).
- **SECURITY**: the Jira API token is stored in project `opencode.json` in
  plaintext. The repo is NOT currently a git repo, so nothing to commit, but
  if this is ever version-controlled, keep `opencode.json` (or the token)
  out of source control / use an env-var pattern.
- (Older handover §13 items resolved here: transport = MCP server; streak
  data = Jira fields/labels; ragebait tone = hard default; routines as
  recurring events = defer to setup.)

## 5. Status Tier Thresholds

- **Decision**: Defaults pending user confirmation:
  god-mode ≥95% + all targets, elite ≥90%, good ≥75%, average ≥50%,
  else hopeless. User starts at average.
- **Rationale**: Draft from handover; configurable.

## 6. Weekly Pick Cap & Start Streaks

- **Decision**: Weekly pick cap default ≤7; start with 1 practice streak.
- **Rationale**: Ramp rule — start light to avoid over-committing.

## Consolidated: Decisions Driving Parallelization

The contracts below (Jira schema, metadata conventions, streak data
locations) are the **shared interface** every workstream references. Once
these are fixed, workstreams are independently executable.

---

## Phase 8 — Final Validation (T042) & Setup Notes (T046)

**Date**: 2026-08-03. Recorded after implementing Phases 6–8 (US5 calendar,
US6 persona, polish).

### Quickstart validation results (quickstart §1–6)

| § | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Jira backbone | **PASS (live)** | `jira_get_all_projects` returns all 9 domains (BF/AT/HM/FIN/BR/BH/BS/MDP/ART) + `BPD` (excluded). Workflow/labels per `scripts/jira-setup.md` §1–2. Metric custom fields NOT present live (verified `jira_search_fields` — no `*perfection`/`*streak`/`*tier` fields), as documented → admin must create per `jira-setup.md` §3 before WB2 scoring writes. |
| 2 | Capture → issue | Reviewed | `capture/SKILL.md` implements router (9 domains + Ideas fallback), assessment, labels; never routes to `BPD`. Live fire-test = run "add to backlog: X". |
| 3 | Weekly groom | Reviewed | `weekly-groom/SKILL.md` sweep/groom/≤7 picks/scoreboard reads WB2 fields (not present until T008 admin step). |
| 4 | Daily loop | Reviewed | `daily/SKILL.md` today/what-next/done/practice/friction — FR-012 guarantees no re-hide. |
| 5 | Calendar | **PASS (runbook)** | 3 static recurring events defined once in `scripts/calendar-setup.md` + `project-config.json` (night-before 21:00, morning 08:00, unplanned-week Sun 09:00). Manual: create once in Google Calendar; NO calendar-write automation (FR-010). |
| 6 | Persona consistency | **PASS (authored)** | `persona/persona.md` one fixed blunt/anti-drift/problem→solution→move-on voice; config-adjustable via `project-config.json` → `persona`; referenced by all 4 skills (capture, weekly-groom, daily, research). Manual: ask same question across surfaces. |

**Out of scope (T043)**: verified via grep — no Telegram, cron/daemon,
calendar-write automation, Dream/Goals Epics, "why" doc, or animated
dashboard introduced. (Only mentions are explicit "none/absent" statements.)
**FR-012 (T044)**: all four skills carry the never-delete / never-re-hide
guarantee for `internal`/antivisible items; friction re-slots or holds in
Blocked Or FollowUp only.

### §Final setup-time confirmed values (2026-08-03)

- **Jira**: site `https://mayurzenith.atlassian.net`; MCP `atlassian`
  (verified); 9 domain keys live-discovered (BF/AT/HM/FIN/BR/BH/BS/MDP/ART);
  `BPD` excluded. Metric custom fields still need admin creation
  (`jira-setup.md` §3).
- **Calendar (T035–T038)**: Google, local tz; night-before 21:00, morning
  08:00, unplanned-week Sunday **09:00** (draft finalized). Static, created
  once, no write automation. Runbook: `scripts/calendar-setup.md`.
- **Persona (T039–T041)**: one fixed difficult-coach voice; config-adjustable
  via `project-config.json` → `persona.adjustments`; ragebait register
  `persona/ragebait.md` (T016). Runbook/voice: `persona/persona.md`.
- **Scoring (unchanged)**: tiers god-mode ≥95 + all targets / elite ≥90 /
  good ≥75 / average ≥50 / else hopeless; start at average; pick cap ≤7;
  start 1 practice streak; clean-week ≥80%.

### Deferred / pending (carried from before)

- Metric custom fields (T008) must be created by a Jira admin before WB2
  scoring (T012–T015) can write — the skills are built against the frozen
  names, so this is the one blocking admin action left.
- Jira API token in `opencode.json` plaintext — keep out of source control if
  the repo is ever version-controlled.
- Calendar events themselves: created once by the user in Google Calendar per
  `scripts/calendar-setup.md` (agent has no calendar-write tool, by design).
- Ragebait pruning (T045): register is consolidated and healthy; prune lines
  that stop landing as feedback arrives (mechanism documented in
  `persona/ragebait.md`).
