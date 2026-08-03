# WB2 — Streak / Plan-Deliver / Tier Scoring (shared implementation)

**Owned by**: Foundation workstream (Phase 2), the shared prerequisite that
WB1 skills consume. **Contract**: `contracts/calendar-streak-persona.md`
§Streak Scoring + `contracts/jira-config.md` metric fields + `data-model.md`.
All metric values are written to Jira custom fields/labels (Jira = SSOT).

The `weekly-groom` skill (Phase 4) assembles these into the scoreboard; the
`daily` skill (Phase 5) reads/writes streak fields on `done` / `practice`;
`stats` reads them. Every skill MUST reference THIS module, not re-derive its
own copy, so there is one implementation.

## Inputs: the two saved filters

- **Todo-Week** = issues picked for the current week (status `Todo-Week`).
- **Done-this-week** = issues resolved to Done during the current week.

## T012 — Perfection (weekly %)

Let `P` = # Done this week that carried this week's `week:YYYY-Www` label
(i.e. they were actually planned). Let `D` = # Done this week (Done-this-week).
Let `W` = # planned this week (Todo-Week).

- **planperfection** = `P / D * 100` — how much of what got done was planned.
  (100% = every done item was on the plan; no reactive churn.)
- **deliveryperfection** = `P / W * 100` — how much of the plan was delivered.
  (100% = every planned item got done.)

Write both to `planperfection` / `deliveryperfection` on a single metric issue
(the LifeOS `BS` project) or as a per-week reference. Guard divide-by-zero:
if `D == 0` planperfection = 0; if `W == 0` deliveryperfection = 0 unless
`D == W == 0` → 100 (a truly empty, intentional week).

## T013 — Streaks

- **deliverystreak** = consecutive days with ≥1 issue in Done-this-week.
  Increment each day delivery happens; reset to 0 on a no-delivery day.
- **practicestreak:<name>** = consecutive-days counter, one per practice
  (`practicestreak:gym`, `practicestreak:meditation`, …). Incremented by the
  `daily` command `practice X`; reset when a day is missed.
- **cleanweekstreak** = consecutive weeks with `deliveryperfection >= 80`
  (`scoring.clean_week_threshold_pct`). +1 per qualifying week; reset on a
  week below threshold.

Write each to its respective Jira metric field.

## T014 — Status tier

Derived from `maxdelivery` (peak delivery-perfection) + target hits, per
`scoring.status_tiers` (from `project-config.json`):

| Tier | Rule |
|------|------|
| god-mode | delivery_perfection ≥ 95 AND all targets hit this week |
| elite | delivery_perfection ≥ 90 |
| good | delivery_perfection ≥ 75 |
| average | delivery_perfection ≥ 50 |
| hopeless | else |

`maxdelivery` = the highest deliveryperfection ever recorded (keep running
max). User **starts at `average`** with 1 practice streak (ramp rule: add load
only as delivery stays green). Write `statustier` + `maxdelivery` to the metric
record.

## T015 — Target trophies (🏆)

Weekly targets are set each Sunday (see weekly-groom target logging). Targets
are attached via the `week:YYYY-Www` label and recorded in `targetsweek`.
Scored the following Sunday:

- For each target met → append one `🏆` to `targetsweek`.
- Reference the target week by its `week:YYYY-Www` label.
- `god-mode` requires ALL targets hit (see T014).

## Consistency rules

- Never delete or re-hide `internal` items (FR-012) — scoring only.
- Long-stuck is auto-flagged at ≥28d unchanged in a non-terminal status
  (label `long-stuck`); it appears in the long-stuck lists, never removed
  from visibility.
