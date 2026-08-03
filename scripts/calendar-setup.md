# Calendar Fear-Trigger Setup Runbook (Phase 6, US5)

**Owned by**: WB3 — calendar workstream. **Contract baseline**: FROZEN v1.0.0 —
event names, recurrence, times, and reminder text MUST match
`contracts/calendar-streak-persona.md` §Calendar and the `calendar` block of
`project-config.json` exactly.

**How to run**: These are **three static, recurring events created once** at
setup. There is deliberately **no calendar-write automation** (FR-010 / FR-013
— not in scope): the agent never writes to the calendar and the reminder text
is **fixed**, so it cannot drift. Create each event **once** in Google Calendar
(provider confirmed 2026-08-02; timezone = local) with the exact details
below — either via the Google Calendar UI, or headless via `gcalcli` / the
Google Calendar REST API if you prefer to script it (the reminder text and
recurrence must match exactly; do not paraphrase).

This is the single executable spec for that one-time setup and is what the
quickstart §5 check verifies against.

## Event 1 — Night-before mental prep (T035)

| Property | Value |
|----------|-------|
| Title | `Night-before mental prep` |
| Recurrence | Daily, every evening |
| Time | `21:00` (draft — confirm at setup) |
| Reminder text (fixed) | `Tomorrow: X, Y. If you don't de-risk now (pack, message, phone call), you'll be scrambling — and it breaks delivery. 10 min.` |

> Purpose: inject the consequence of an un-de-risked tomorrow the night before
> so the user pre-empts scrambling.

## Event 2 — Morning task-pick (T036)

| Property | Value |
|----------|-------|
| Title | `Morning task-pick` |
| Recurrence | Daily |
| Time | `08:00` (draft — confirm at setup) |
| Reminder text (fixed) | `Pick today's 1–3 from the week. Drift = carry-over + a broken delivery streak. Choose on purpose.` |

> Purpose: force an on-purpose pick from the week; frames drift as a
> delivery-streak cost.

## Event 3 — Unplanned-week warning (T037)

| Property | Value |
|----------|-------|
| Title | `Unplanned-week warning` |
| Recurrence | Weekly, Sunday |
| Time | `09:00` (confirmed at setup — see `project-config.json`) |
| Reminder text (fixed) | `The week is empty and unplanned — that's the dangerous state. Groom now or you'll improvise reactively all week. Run weekly.` |

> Purpose: warn against the dangerous empty-and-unplanned state and prompt the
> weekly groom (`run weekly`).

## Rules (T038 / FR-010)

- **Created once** at setup; each event created **once**, not re-created on
  every agent run.
- **Reminder text is static**: never edited by the agent; ragebait rotates only
  in agent chat surfaces, never in reminder text.
- **No calendar-write automation**: nothing in this repo writes to the
  calendar. The agent surfaces (`daily`, `weekly-groom`) read the *concepts*
  (meetings, Todo-Week) from context/Jira; they do not touch calendar events.
- **Reminders only — agenda lives in Jira (FR-010a)**: the daily list
  (today's 1–3) is **derived from the Todo-Week list in Jira at read time**
  by the `daily` skill and surfaced in **chat**. It is **never written to any
  calendar event or event description**. Calendar = static consequence
  reminders; the weekly Todo-Week list (≤7) is the single flexible agenda.

## Verification (matches quickstart §5)

- [ ] All 3 events exist in Google Calendar at the confirmed times.
- [ ] Each has the exact fixed reminder text above (no paraphrasing).
- [ ] Events are static recurring (Daily / Daily / Weekly Sunday).
- [ ] No calendar-write automation exists in any skill (grep the skills for
      calendar API calls — should be none).
