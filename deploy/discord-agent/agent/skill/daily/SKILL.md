---
name: daily
description: "Daily assess-and-execute loop (User Story 4 / WB1). Triggers: 'today'/'brief', 'what next'. Assesses meetings + Todo-Week and suggests ONE thing; 'done KEY-42' marks Done + ticks delivery; 'practice X' increments the practice streak; friction 'can't do KEY-42 because Y' re-slots or holds in Waiting, never re-hides; auxiliary commands (assess, set targets, stats, recap, stuck, rage). Reads/writes WB2 metric fields and rotates the ragebait register."
---

# /daily — today / brief / what next / done / practice / friction

The daily assess-and-execute loop. Every morning the agent assesses meetings +
Todo-Week, suggests ONE thing, and updates streaks/delivery as the user
executes. Friction never hides items.

## Contract baseline

- **SSOT = Jira.** All reads (Todo-Week, meetings, stats) and writes (Done,
  delivery ticks, practice streaks, friction re-slot) land in Jira.
- **Statuses / labels / fields**: names MUST match the frozen contracts —
  `specs/001-life-os-setup/data-model.md` and
  `specs/001-life-os-setup/contracts/jira-config.md`.
- **WB2 scoring**: `done` ticks delivery and `practice` increments streaks via
  the shared module `.opencode/skill/_shared/wb2-scoring.md` (T013). Do NOT
  re-derive your own counters — reference the shared implementation.
- **Persona**: blunt, anti-drift, problem → solution → move on
  (`persona/persona.md`) + one ragebait line per surface
  (`persona/ragebait.md` from T016).
- **FR-012**: an item flagged `internal` is antivisible — it must stay visible,
  never be deleted or re-hidden. Friction only re-slots or holds in Waiting.

## Trigger & input handling

- **Triggers**: `today` / `brief` → day dashboard; `what next` → one
  suggestion. Accept the natural forms above. Every response carries the
  persona + a ragebait line (one per surface per day, T034).

## Step 0 — Rotate ragebait (T034)

Before any surface reply, pick **one** ragebait line from
`persona/ragebait.md`:

- Tagged `[gym]` when today's pick/weak-stat is a gym/fitness task.
- Tagged `[diet]` when today's pick/weak-stat is a diet/health task.
- Untagged (general) otherwise.
- Strictly one line per surface, per day — never stack. The register is owned
  in `persona/ragebait.md`; read it, never duplicate it. `rage <line>` (T033)
  adds a new line (optionally `[gym]`/`[diet]` tagged).

## `today` / `brief` — day dashboard (T028)

Compose the morning brief. **Today's list is derived from the Todo-Week list
in Jira at read time — it is never written to any calendar event** (calendar
= reminders only, FR-010a):

1. **Rage-fuel line** — one rotated ragebait line (Step 0).
2. **Header** — read WB2 metric fields: `statustier` + `deliverystreak` +
   `cleanweekstreak` (T013/T014) from the metric record.
3. **Today's tasks** — the Todo-Week issues due/next; the single
   highest-leverage one is called out.
4. **Meetings** — pull today's calendar/meetings (as available in the agent
   context); name the ones with stakes.
5. **Weak-stat callout** — the stat most at risk today (delivery, a practice
   streak, plan adherence) — say it plainly.

## `what next` — assess + ONE suggestion (T029)

Suggest **exactly one** thing to do now:

1. Read meetings → which have stakes/fear attached (a deliverable due, a
   person waiting, a consequence if missed).
2. Read Todo-Week → what is planned and un-done.
3. Find the **weak stat** (delivery slipping? a practice streak in danger?).
4. Weigh priority: consequence-laden meeting prep > planned deliverable >
   routine practice > everything else.
5. Recommend **ONE** action, bluntly, with the ragebait line. Why this one,
   and the cost of skipping it (problem → solution → move on).

## `done KEY-42` — mark Done + tick delivery (T030)

1. Verify the issue exists and is yours to close.
2. Transition it to **Done** via the Jira MCP server.
3. Tick delivery: invoke the WB2 delivery-tracking rules (T013) — since a
   delivery happened today, `deliverystreak` increments; contributing to
   `deliveryperfection` / `cleanweekstreak` per the shared module.
4. Confirm in persona voice with the updated delivery streak.

## `practice X` — increment practice streak (T031)

1. Resolve `X` to its practice name (e.g. `gym`, `meditation`, `diet`).
2. Increment `practicestreak:<name>` via the WB2 shared module (T013).
3. Confirm the new count in persona voice; call out if a tagged
   `[gym]`/`[diet]` ragebait line applies.

## Friction — `can't do KEY-42 because Y` (T032)

1. **Never re-hide, archive, or delete** — the item stays visible (FR-012).
2. Understand `Y` (the blocker):
   - **Time-slot issue** → re-slot: offer alternate times or move to `Waiting`
     with a follow-up date, keeping it visible.
   - **Blocked on someone/something** → move to **Waiting**, record what it
     waits on, set a follow-up check.
   - **Wrong priority** → re-assess and re-slot (never bury it).
3. If the item is `internal`, keep the same guarantee — re-slot or Waiting,
   never hide.
4. Reply bluntly: the plan changed, here is where it stands, and it is still
   on the record.

## Auxiliary commands (T033)

- `assess KEY-42` → grill/rate: urgency / value / routine-or-once; verdict in
  persona voice.
- `set targets ...` → record next week's targets + tiers (`targetsweek`, T015 /
  T027); scored the following Sunday.
- `stats` → read WB2 metric fields (planperfection, deliveryperfection,
  deliverystreak, practicestreak:<name>, cleanweekstreak, statustier,
  maxdelivery, 🏆 trophies) and render with a ragebait line.
- `recap` → where the week stands vs plan (Todo-Week vs Done-this-week);
  call out drift.
- `stuck` → show the Long-stuck list (saved filter: `status in (Ready,
  Todo-Week, Waiting) AND updated <= -28d`). Surface, never hide.
- `research KEY-42` → hand off to the research skill (toggle
  `needs-research` → `research-done`).
- `rage <line>` → append a one-liner to `persona/ragebait.md`, optionally
  `[gym]`/`[diet]` tagged.

For filter scans (stats/recap/stuck), cap to the most recent 10 results per query.

## FR-012 — internal items are never re-hidden

- Friction re-slots or holds `internal` items in Waiting; it never deletes or
  re-hides them. They stay visible on the record from capture
  (`.opencode/skill/capture/SKILL.md` applies the `internal` label) through
  the weekly groom (`.opencode/skill/weekly-groom/SKILL.md`) and here.

## Shared references

- Labels / validation / workflow: `specs/001-life-os-setup/data-model.md`
- Jira contract (projects, fields, filters): `specs/001-life-os-setup/contracts/jira-config.md`
- WB2 scoring (T012–T015, delivery/practice streak writes):
  `.opencode/skill/_shared/wb2-scoring.md`
- Ragebait register (T016, one line per day): `persona/ragebait.md`
- Persona: `persona/persona.md`
- Runtime values (keys, pick cap, tiers, thresholds): `project-config.json`
