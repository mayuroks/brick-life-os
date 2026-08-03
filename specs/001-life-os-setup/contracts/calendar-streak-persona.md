# Calendar / Streak & Persona Contracts

**Purpose**: Independent workstream contracts that do not depend on code,
only on the shared Jira config contract and user-confirmed values.

## Calendar Fear-Trigger Events (static, recurring, created once)

| Event | Recurrence | Reminder text (fixed) |
|-------|-----------|------------------------|
| Night-before mental prep | Daily eve (draft 21:00) | "Tomorrow: X, Y. If you don't de-risk now (pack, message, phone call), you'll be scrambling — and it breaks delivery. 10 min." |
| Morning task-pick | Daily (draft 08:00) | "Pick today's 1–3 from the week. Drift = carry-over + a broken delivery streak. Choose on purpose." |
| Unplanned-week warning | Weekly Sunday | "The week is empty and unplanned — that's the dangerous state. Groom now or you'll improvise reactively all week. Run weekly." |

**Rules**:
- Created once at setup; reminder text is static (NO calendar-write
  automation).
- Ragebait rotation happens in agent chat surfaces, NOT in reminder text.

**Requires user confirmation**: provider (Google default vs Apple), timezone,
exact times.

**Confirmed 2026-08-02**: provider = **Google**, timezone = **local**,
times = default draft (night 21:00, morning 08:00, Sunday — exact Sunday
time in `project-config.json`). Static, created once.

## Streak / Plan-Deliver Scoring Contract

- Data lives in Jira custom fields/labels (see `jira-config.md`).
- Deliverables: delivery-perfection, plan-perfection, delivery streak,
  practice streak, clean-week streak, status tier, target trophies.
- Tier defaults (draft): god-mode ≥95% + all targets, elite ≥90%, good ≥75%,
  average ≥50%, else hopeless. User starts at **average**.
- Ramp rule: start with 1 practice streak + light workload; add only as
  delivery-perfection stays green.
- Weekly targets set each Sunday; scored the following Sunday.

## Persona Prompt (the difficult coach)

- One fixed persona across ALL skills and surfaces: **blunt, anti-drift,
  problem → solution → move on**; never soften a hard truth.
- Config-driven so the user can reshape it in feedback.
- Ragebait register: pinned one-liners; agent rotates one per day,
  context-aware (`[gym]`/`[diet]` tagged when a matching task is up).
