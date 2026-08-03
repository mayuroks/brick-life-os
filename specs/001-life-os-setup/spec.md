# Feature Specification: Life OS Setup

**Feature Branch**: `001-life-os-setup`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "look at the HANDOVER-FINAL.md those are the requirements. create specs for those. its a setup (or integration project), not necessarily a coding project."

## Clarifications

### Session 2026-08-03

- Q: Should the agent write today's/this week's agenda into the calendar event descriptions? → A: No — calendar scope is reminders only. The daily list (today's 1–3) is **derived from the Todo-Week list in Jira at read time** by the daily skill and surfaced in chat; it is **never written to any calendar event**. Calendar events stay static reminders (FR-010). This keeps the weekly list (Todo-Week, ≤7) as the single flexible agenda holder.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Jira Backbone + Visibility Dashboard (Priority: P1)

The user's whole ambit renders as visible, tracked commitments in Jira so
nothing ambitious hides in chat, notes, or memory. The user opens their
dashboard and instantly sees the pipeline, long-stuck items, this week's
picks, and their streak/plan-deliver slip — all sourced from Jira.

**Why this priority**: This is the anti-invisibility core ("every commitment
becomes a real Jira issue"). Without the Jira backbone and dashboard,
nothing else in the system can surface or track commitments. It is the
foundation the skills and motivation engine depend on.

**Independent Test**: Can be fully tested by opening the configured
dashboard and filters, adding a test backlog item, moving it through the
workflow, and confirming the Pipeline / Long-stuck / Todo-Week / streak-slip
views update within the refresh window — delivering a visible, tracked
commitment record.

**Acceptance Scenarios**:

1. **Given** the Jira workspace is configured, **When** the user opens the
   dashboard, **Then** they see Pipeline, Long-stuck, Todo-Week, and a
   streak/plan-deliver slip gadget.
2. **Given** a commitment is created as an issue, **When** it is moved
   through the workflow, **Then** it appears in the corresponding
   pipeline view and long-stuck auto-flags after 28 days unchanged.
3. **Given** an internal/self commitment, **When** it is captured, **Then**
   it is tagged `internal` and never re-hidden.

---

### User Story 2 - Capture to Assessed Issue (Priority: P1)

The user says or types "add to backlog: X" and the agent files an
assessed, labeled Jira issue — route, status, labels (constraint/week/
routine/internal) and a priority/routine-vs-once assessment.

**Why this priority**: Capture is the entry point for anti-invisibility —
the moment a commitment is spoken it must become a real Jira issue. This
is the daily interaction surface, second only to the Jira backbone itself.

**Independent Test**: Can be fully tested by issuing a voice/text capture,
then confirming a correctly routed, labeled, and assessed issue exists in
the backlog — delivering capture-to-visible-issue value on its own.

**Acceptance Scenarios**:

1. **Given** the agent is running, **When** the user says "add to backlog:
   plan a birthday gift", **Then** an issue is created in the correct
   project with a priority and routine-vs-one-off assessment.
2. **Given** a backlog issue exists, **When** the user marks it as internal,
   **Then** it receives the `internal` label and stays visible.
3. **Given** a task fits a known project (Career, Family, House, Finance,
   Network, Health/Diet, LifeOS, Docs, Ideas), **When** captured, **Then**
   it is routed to that project.

---

### User Story 3 - Weekly Groom Ceremony (Priority: P1)

The user runs "run weekly" and the agent performs an anti-visibility sweep,
grooms the backlog, proposes up to 7 picks for the week, surfaces
convictions, and posts a scoreboard with plan/delivery-perfection, streaks,
long-stuck list, and status tier. The user approves/swaps/drops and sets next
week's targets.

**Why this priority**: The weekly ceremony is where planning-perfection,
delivery-perfection and streak scoring come together — the motivation
engine's evaluation moment. It is a core habit loop of the system.

**Independent Test**: Can be fully tested by running the weekly command
against a populated Jira, then confirming a completed groom, a proposed pick
list, and a posted scoreboard with targets — delivering the full review
cycle standalone.

**Acceptance Scenarios**:

1. **Given** a populated backlog, **When** the user runs "run weekly",
   **Then** the agent files internal commitments, grooms Ready items, and
   proposes up to 7 Todo-Week picks.
2. **Given** this week's targets exist, **When** the scoreboard posts,
   **Then** it includes plan/delivery-perfection, current streaks, long-stuck
   list, status tier, and a trophy for each target hit.
3. **Given** the user replies with next week's targets, **When** confirmed,
   **Then** they are logged and scored against the following week.

---

### User Story 4 - Daily Assess-and-Execute Loop (Priority: P1)

Each morning the user interacts ("what next?", "today", "done KEY-42",
"practice X", friction reports) and the agent assesses meetings + Todo-Week,
grills/rates, suggests ONE thing now, surfaces internal tasks, and includes
one rage-fuel one-liner. Completing a task or practice updates streaks and
delivery.

**Why this priority**: This is the day-to-day engine that turns plans into
delivered, streak-tracking action. It is how fear-trigger + assess + execute
manifest daily.

**Independent Test**: Can be fully tested by running "what next" and "done
KEY-42"/"practice X" and confirming an assessed suggestion plus streak and
delivery updates — delivering the motivating daily loop standalone.

**Acceptance Scenarios**:

1. **Given** a new day, **When** the user asks "what next?", **Then** the
   agent assesses meetings + Todo-Week and suggests one thing, leading with
   a rage-fuel one-liner.
2. **Given** the user reports "done KEY-42", **When** confirmed, **Then**
   the issue is marked Done and delivery is ticked.
3. **Given** the user reports "practice gym", **When** confirmed, **Then**
   the practice streak increments.
4. **Given** the user reports friction "can't do KEY-42 because Y", **When**
   acknowledged, **Then** the issue is re-slotted or held visible and never
   re-hidden.

---

### User Story 5 - Fear-Trigger Calendar Events (Priority: P2)

Three static recurring calendar events (night-before mental prep, morning
task-pick, unplanned-week warning) fire reminders that inject the
consequence before execution, driving the user to de-risk early.

**Why this priority**: Fear-triggers are a stated core engine piece, but
they depend on the calendar being set up once and the daily/real usage flow
existing first. Valuable but lower urgency than Jira/capture/groom/daily.

**Independent Test**: Can be fully tested by creating the three static
recurring events with the fixed reminder text and confirming they appear at
the chosen times — delivering the proactive nudge standalone.

**Acceptance Scenarios**:

1. **Given** setup is complete, **When** the calendar is viewed, **Then**
   three static recurring fear-trigger events exist with their fixed
   consequence-injecting reminder text.
2. **Given** the events exist, **When** a reminder fires, **Then** it shows
   the consequence text (not a failure report) driving a de-risk action.
3. **Given** the events are created once, **When** time passes, **Then**
   the reminder text stays static (no calendar-write automation).
4. **Given** the weekly Todo-Week list exists in Jira, **When** the daily
   skill surfaces today's picks, **Then** it derives them from Todo-Week at
   read time and **never writes them to any calendar event** (calendar =
   reminders only).

---

### User Story 6 - Persona Consistency Across All Surfaces (Priority: P2)

Wherever the user meets the agent (today / what next / stats / grooms), it
speaks in one fixed persona — your difficult coach: blunt, anti-drift,
problem→solution→move-on. The persona is config and can be reshaped in
feedback.

**Why this priority**: Consistent voice across every surface is what makes
the system feel like one coach rather than disconnected tools. It is
cross-cutting and configurable, so moderate priority.

**Independent Test**: Can be fully tested by asking the same question through
multiple surfaces and confirming the blunt, anti-drift coach voice is
consistent everywhere — delivering a coherent interface persona standalone.

**Acceptance Scenarios**:

1. **Given** any surface, **When** the user interacts, **Then** the response
   holds the difficult-coach persona (blunt, anti-drift,
   problem→solution→move-on).
2. **Given** consistent persona behavior, **When** the user gives feedback
   that it grates, **Then** the persona is configurable and can be reshaped.

---

### Edge Cases

- What happens when a capture does not clearly map to any of the 9 projects?
  (default to a fallback/ideas project rather than erroring)
- How does the system handle a Jira issue that is long-stuck and also just
  picked for the week? (surface a conflict note, do not hide it)
- What happens when the calendar provider is Google vs Apple and times/
  timezone differ? (resolve during setup; reminder text identical)
- How is a friction report handled when no obvious next re-slot exists?
  (hold visible in Waiting with a note, never re-hide)
- What if the user sets no weekly targets? (scoreboard posts without target
  hits and reminds to set them)
- What if the user expects today's agenda inside a calendar event? (it is not
  there — today's list is derived from Todo-Week in chat; calendar stays
  static reminders, never written to)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a single source of truth (Jira) where every
  commitment is recorded as a visible issue.
- **FR-002**: System MUST support 9 projects: Career, Family, House, Finance,
  Network, Health/Diet, LifeOS, Docs, Ideas.
- **FR-003**: System MUST model the workflow: Backlog → Ready → Todo-Week →
  In Progress → Waiting → Follow-up → Done.
- **FR-004**: System MUST support labels: constraints (`loc/time/person`),
  `week:YYYY-Www`, `needs-research`/`research-done`, `routine:*`, `internal`,
  and auto-flagged `long-stuck` (unchanged ≥28 days).
- **FR-005**: System MUST provide a dashboard with Pipeline, Long-stuck,
  Todo-Week, and a streak/plan-deliver slip gadget (Filter Results, ~15-min
  refresh) plus saved filters: Pipeline, Backlog, Todo-Week, Long-stuck,
  Done-this-week.
- **FR-006**: Capture MUST file any "add to backlog: X" (voice or text) as a
  Jira issue with project routing, assessment (priority, routine-vs-one-off),
  and relevant labels.
- **FR-007**: Weekly groom MUST perform an anti-visibility sweep, groom
  Backlog → Ready, propose up to 7 Todo-Week picks + week labels, surface
  1–2 convictions, and post a scoreboard (plan/delivery-perfection, streaks,
  long-stuck, status tier, target trophies).
- **FR-008**: Daily loop MUST support: today/brief, what next (assess and
  suggest ONE thing), done KEY-42 (tick delivery), practice X (increment
  practice streak), friction handling (re-slot, keep visible), assess,
  set targets, stats, recap, stuck, research, rage.
- **FR-009**: Motivation tracking MUST compute plan-perfection,
  delivery-perfection, delivery streak, practice streak, clean-week streak,
  and a status tier (hopeless < average < good < elite < god-mode).
- **FR-010**: Calendar MUST expose three static recurring fear-trigger
  events (night-before prep, morning task-pick, weekly unplanned-week) with
  fixed consequence-injecting reminder text; no calendar-write automation.
- **FR-010a**: The daily list (today's 1–3) MUST be derived from the
  Todo-Week list (Jira) at read time and surfaced in chat — it MUST NOT be
  written to any calendar event or event description. Calendar holds static
  reminders only; the weekly Todo-Week list is the single flexible agenda.
- **FR-011**: The agent MUST hold one fixed persona (difficult coach: blunt,
  anti-drift, problem→solution→move-on) across all surfaces, and be
  configurable.
- **FR-012**: System MUST keep an internal/antivisible commitment visible and
  never delete or hide it; it may only be re-slotted or held in Waiting.
- **FR-013**: Setup MUST NOT build in v1: Telegram bot, cron/daemon,
  calendar-write automation, Dream/Goals Epics, "why" doc, animated
  dashboard.

### Key Entities

- **Jira Issue**: A single commitment; has project, status in the workflow,
  priority, size, description, and labels (constraint/week/routine/internal/
  research/long-stuck).
- **Project**: One of 9 life domains; groups related issues.
- **Streak/Perfection Record**: Tracks delivery-perfection, plan-perfection,
  delivery/practice/clean-week streaks, status tier, and weekly targets —
  derived from Todo-Week vs Done-this-week data.
- **Persona Prompt**: The fixed coach config applied to all surfaces.
- **Fear-Trigger Event**: A static recurring calendar event with fixed
  consequence-injecting reminder text.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The full setup completes (Jira config, dashboard, calendar
  events, but NOT yet the 4 skills which are v1 build) such that all 9
  projects, the workflow, and all labels exist and are usable.
- **SC-002**: A captured commitment becomes a visible, properly labeled,
  correctly routed Jira issue every time.
- **SC-003**: The weekly groom completes within one interactive session and
  produces up to 7 picks plus a scoreboard with all required metrics.
- **SC-004**: Daily loop fires "what next" assessment, delivery tick on
  "done", and streak increment on "practice" as defined.
- **SC-005**: Three fear-trigger calendar events exist with static,
  consequence-injecting reminder text; the daily agenda is derived from
  Todo-Week in chat and is never written to calendar events.
- **SC-006**: No v1 out-of-scope item (Telegram, cron, calendar-write, etc.)
  is introduced.

## Assumptions

- This is a setup/integration project; primary "build" output is Jira
  configuration, calendar events, a persona prompt, and (in v1 volume) the
  four skills rather than traditional application code.
- Agent→Jira communication uses a Jira MCP server; no token plumbing in the
  repo.
- Calendar provider assumed Google unless the user confirms Apple, with
  exact trigger times to be confirmed by the user (draft: night 9pm, morning
  8am, Sunday).
- Calendar events carry static reminder text only; the daily agenda is
  derived from the Todo-Week list in Jira at read time and is never written
  to calendar events (reminders-only scope).
- Status-tier thresholds assume defaults (god-mode ≥95% + all targets,
  elite ≥90%, good ≥75%, average ≥50%, else hopeless) pending user
  confirmation.
- Streak/plan-deliver metric data lives in Jira fields/labels, keeping Jira
  the single source of truth.
- Jira site URL and actual project keys differ from the illustrative
  examples and must be confirmed with the user during setup.
- Weekly pick cap defaults to ≤7; starting practice streaks left to the
  user (draft 1).
- Tests are optional and minimal per the prototype constitution; manual
  acceptance checks suffice.
