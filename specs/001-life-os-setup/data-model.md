# Data Model: Life OS Setup

**Feature**: Life OS Setup | **Date**: 2026-08-02

**Contract baseline: FROZEN v1.0.0 (2026-08-02).** Entity names, workflow
statuses, label names, and metric field names below are the frozen shared
contract. No renames without updating all dependent workstreams (Jira
config, skills, streak tracker, calendar, persona). Runtime values (real
project keys, site URL, times) live in `project-config.json`, not here.

This is the **shared contract backbone**. Every workstream (Jira config,
skills, streak tracker, calendar, persona) references these exact entities,
statuses, labels, and field names. Do not rename these without updating all
dependent workstreams.

## Entities

### Project
- **Purpose**: One of 9 life domains; groups related commitments.
- **Keys** (confirmed real keys at setup; illustrative here):
  Career, Family, House, Finance, Network, Health/Diet, LifeOS, Docs, Ideas.
- **Relationship**: Contains many Issues.

### Issue (a commitment)
- **Representation**: Jira issue; the atomic unit of tracked work.
- **Attributes**:
  - `key` (unique, e.g. `CAREER-42`)
  - `summary` (the commitment text)
  - `project` → Project
  - `status` (workflow state, below)
  - `priority`
  - `description`
  - `labels` (constraint / week / routine / internal / research / long-stuck)
  - `size` (effort)
  - `constraint` (`loc` / `time` / `person`)
  - `week` (`week:YYYY-Www`)
- **Identity/Uniqueness**: unique `key` assigned by Jira; one commitment =
  one issue.
- **Workflow / lifecycle states**:
  `Backlog → Ready → Todo-Week → In Progress → Blocked Or FollowUp → Done`
  - Any status may sit "long-stuck" if unchanged ≥28 days.

### Metric Record (streak / plan-deliver / tier)
- **Purpose**: The motivation engine's quantified state.
- **Attributes** (stored as Jira custom fields + labels; names match
  `contracts/jira-config.md` canonical metrics):
  - `planperfection` (weekly %)
  - `deliveryperfection` (weekly %)
  - `deliverystreak` (consecutive days)
  - `practicestreak:<name>` (day counter)
  - `cleanweekstreak` (consecutive weeks ≥80% delivery)
  - `statustier` (hopeless < average < good < elite < god-mode)
  - `targetsweek` (`week:YYYY-Www` label + per-target trophies 🏆)
  - `maxdelivery` (peak delivery-perfection used for tier)
- **Derivation**: from Todo-Week vs Done-this-week filters.
- **Relationships**: references Issues via `week:` labels and Done status.

### Fear-Trigger Event
- **Purpose**: static recurring calendar event injecting consequence.
- **Attributes**: name, recurrence rule, reminder text (fixed), time.
- **Variants**: night-before-prep, morning-task-pick, unplanned-week.

### Persona Prompt
- **Purpose**: fixed coaching voice applied to all surfaces.
- **Attributes**: tone (blunt, anti-drift, problem→solution→move-on), config
  flag, ragebait register.

## Label Schema (exact names)

| Label | Meaning |
|-------|---------|
| `loc:<value>` / `time:<value>` / `person:<value>` | constraint |
| `week:YYYY-Www` | target week (e.g. `week:2026-W32`) |
| `needs-research` / `research-done` | research state |
| `routine:<name>` | routine task type |
| `internal` | antivisible self-commitment |
| `long-stuck` | auto-flagged (unchanged ≥28 days) |

## Validation Rules (from spec FR-004, FR-009, FR-012)

- An issue flagged `internal` MUST remain visible and never be deleted or
  re-hidden; it may only be re-slotted or held in Blocked Or FollowUp.
- `long-stuck` MUST auto-flag when `updated <= +28d` in a non-terminal
  status.
- Status tier MUST be derive-able from `maxdelivery` + target hits.
