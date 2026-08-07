---
name: weekly-groom
description: "Weekly groom surface (User Story 3 / WB1). Trigger: 'run weekly'. Runs an anti-visibility sweep, grooms Backlog → Ready, proposes ≤7 Todo-Week picks with `week:` labels, surfaces 1–2 convictions, posts a scoreboard (reads WB2 metric fields: plan/delivery-perfection, streaks, long-stuck list, status tier, 🏆 trophies), and logs next-week targets."
---

# /weekly-groom — "run weekly"

The weekly ceremony: sweep invisible commitments into the record, groom the
backlog, pick a bounded week, and post an honest scoreboard. Input arrives as
`run weekly` (or `weekly`, `groom`).

## Contract baseline

- **SSOT = Jira.** Every sweep, groom, pick, and scoreboard read/write lands in
  Jira. Nothing is stored locally.
- **Statuses / labels / fields**: names MUST match the frozen contracts —
  `specs/001-life-os-setup/data-model.md` (Label Schema + workflow) and
  `specs/001-life-os-setup/contracts/jira-config.md`.
- **WB2 scoring**: the scoreboard READS the metric fields defined in
  `.opencode/skill/_shared/wb2-scoring.md` (T012–T015). Do NOT re-derive your
  own scoring — reference the shared module and its saved filters
  (Todo-Week, Done-this-week, Long-stuck).
- **Persona**: blunt, anti-drift, problem → solution → move on
  (`persona/persona.md`). Say the hard thing plainly; do not editorialize.
- **FR-012**: an item flagged `internal` is antivisible — it must stay visible,
  never be deleted or re-hidden. The groom only re-slots or holds in Waiting.

## Trigger & input handling

- **Trigger**: `run weekly`. Accept loose variants: `weekly`, `groom`,
  `plan the week`.
- Run once per week (typically Sunday). Ask, bluntly, if it is clearly a
  re-run and the week is already planned — but never refuse to run.

## Step 1 — Anti-visibility sweep (T023)

Pull invisible/interstitial commitments into the visible record:

1. Review recent chat/notes/interactions of the past week (any long-form
   messages, spoken asides, "I'll get to it", deferred promises).
2. For each commitment that is not already a Jira issue, file it as an issue
   using the same router/assessment discipline as the capture skill
   (`add to backlog: X`) — correct domain project, priority, routine-vs-once,
   labels. Reuse `.opencode/skill/capture/SKILL.md` conventions; do not create
   a second routing implementation.
3. Prefer writing them to their domain project with `Ready` (they are already
   spoken commitments, not raw captures) unless the domain is ambiguous — then
   route to `Ideas` and leave in `Backlog`.
4. Apply `internal` exactly when the commitment is antivisible (the user
   wants it tracked but not broadcast). **Never** hide, archive, or delete an
   `internal` item — it is on the record from here and must stay visible.

**Sweep output**: the invisible commitments are now issues; report how many
were swept in and where they landed.

## Step 2 — Groom Backlog → Ready (T024)

Groom the backlog so the week starts clean and prioritized:

1. Pull the **Backlog** + **Pipeline** saved filters (all open issues not yet
   picked).
2. For each issue, run a fast assess:
   - **urgency** — does it lapse, rot, or cost more if left?
   - **cost-benefit** — effort vs payoff now.
   - **elevation** — would doing it now prevent a future fire (de-risk)?
   - **routine-vs-once** — recurring practice (`routine:<name>`) vs single
     commitment.
3. Classify each → **Ready** (should be pickable this week or soon) or stay in
   **Backlog** (someday / blocked / low priority). Justify tersely in persona
   voice — do not dump a wall of rationale.
4. Flag anything unchanged ≥28 days with `long-stuck` (auto-flag rule; use the
   Long-stuck saved filter and its JQL — `status in (Ready, Todo-Week, Waiting)
   AND updated <= -28d`). Long-stuck items surface in the scoreboard; they are
   **not** hidden.

**Groom output**: a Ready list — the pool from which the week is picked.

## Step 3 — Pick the week (≤7) + `week:` labels (T025)

Choose what the next week will actually deliver:

1. From the Ready pool, select **at most `7`** issues (`scoring.weekly_pick_cap`
   in `project-config.json`). Respect the ramp rule — start light; add load
   only as delivery stays green.

Work budget: groom at most the top 10 issues across Backlog+Pipeline in this run. Keep total
model steps for the whole weekly run under 15; if the backlog is larger, do the highest-impact
10 and note the remainder for next week.
2. Transition each pick to **Todo-Week**.
3. Apply the target-week label `week:YYYY-Www` (ISO, e.g. `week:2026-W33`) to
   each pick so Done-this-week can be compared against the plan (planperfection
   / deliveryperfection, T012).
4. Balance the picks across domains so the week is not lopsided (a single
   domain drowning is a sign of drift — name it).
5. **Surface 1–2 convictions**: the non-negotiable deliver(s) of the week that
   the user is committing to, stated bluntly. These anchor the scoreboard.

**Pick output**: the week's Todo-Week list with labels, plus the convictions.

## Step 4 — Assemble & post the scoreboard (T026)

Read the WB2 metric fields (do NOT recompute) and post the scoreboard:

- Read from the metric record (LifeOS `BS` issue / per-week reference) the
  values written by `wb2-scoring.md`:
  - `planperfection` (T012) — how much of what got done was planned.
  - `deliveryperfection` (T012) — how much of the plan got delivered.
  - `deliverystreak` (T013) — consecutive delivery days.
  - `practicestreak:<name>` (T013) — each practice's day counter.
  - `cleanweekstreak` (T013) — consecutive clean weeks.
  - `statustier` + `maxdelivery` (T014) — current status tier and peak.
  - `targetsweek` (T015) — 🏆 trophies per target hit.
- Draw the **long-stuck list** from the Long-stuck saved filter.
- Render the scoreboard in persona voice:
  - **Header**: `statustier` + `deliverystreak` + a rage-fuel/coach line.
  - **Perfection**: plan% vs delivery% (call out slip honestly — this is the
    plan-deliver dashboard gadget's source).
  - **Streaks**: delivery + each practice streak.
  - **Long-stuck**: the months-forgotten list (count + worst offenders).
  - **Trophies**: 🏆 for this week's targets hit.
- If the metric fields are absent (WB2 not yet run), say so plainly and
  reference `wb2-scoring.md` — do not fabricate scores.

## Step 5 — Log next-week targets (T027)

Weekly targets are set each Sunday and scored the following Sunday (T015):

1. Ask the user (or read an explicit `set targets ...` input) for the next
   week's 2–3 targets.
2. Record them against next week's `week:YYYY-Www` label and write to
   `targetsweek` on the metric record.
3. Confirm the scoring date (following Sunday) in persona voice so the
   expectation is set: "These get 🏆-checked next Sunday. No gift points."

## FR-012 — internal items are never re-hidden

- During the sweep, groom, and pick, `internal` items may be re-slotted,
  moved to Waiting, or kept in place — but never deleted or re-hidden.
- If an `internal` item is deep in the backlog or long-stuck, surface it in
  the review rather than sweeping it away; visibility is the guarantee.

## Shared references

- Labels / validation / workflow: `specs/001-life-os-setup/data-model.md`
- Jira contract (projects, fields, filters): `specs/001-life-os-setup/contracts/jira-config.md`
- WB2 scoring (T012–T015, metric fields the scoreboard reads):
  `.opencode/skill/_shared/wb2-scoring.md`
- Capture conventions (routing/assessment for the sweep): `.opencode/skill/capture/SKILL.md`
- Runtime values (keys, pick cap, tiers): `project-config.json`
- Persona / ragebait: `persona/persona.md`, `persona/ragebait.md`
