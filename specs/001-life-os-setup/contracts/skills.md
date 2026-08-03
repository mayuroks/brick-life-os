# Skills Command Contract

**Purpose**: Defines the exact surface of the four skills so a skill agent
can build each one independently against the Jira config contract.

Every entry uses the form:

```
<command trigger> → <behavior>
```

## capture
- `add to backlog: X` (voice or text) → file a Jira issue in the correct
  project; assess priority + routine-vs-once; apply labels
  (constraint / week / internal / routine); never re-hide internal items.
- Fallback routing to `Ideas` project when the domain is ambiguous.

## weekly-groom
- `run weekly` → anti-visibility sweep (file internal commitments), groom
  Backlog → Ready, propose ≤7 Todo-Week picks + `week:` labels, surface
  1–2 convictions, post scoreboard (plan/delivery-perfection, streaks,
  long-stuck list, status tier, target 🏆 trophies), log next-week targets.

## daily
- `today` / `brief` → day dashboard: rage-fuel line + streak/status header +
  today's tasks + meetings + weak-stat callout.
- `what next` → assess + suggest ONE thing now.
- `done KEY-42` → mark Done + tick delivery.
- `practice X` → increment practice streak.
- `can't do KEY-42 because Y` → friction; re-slot or hold in Waiting,
  never re-hide.
- `assess KEY-42` → grill/rate (urgency / value / routine-or-once).
- `set targets ...` → record next week's targets + tiers.
- `stats` → plan/delivery-perfection, streaks, status tier.
- `recap` → where the week stands.
- `stuck` → show long-stuck list.
- `research KEY-42` → research + write findings back (see research).
- `rage <line>` → add a rage-fuel register one-liner (optionally tagged
  `[gym]`/`[diet]`); rotate one into daily pin.

## research
- `research KEY-42` → background research → cited findings written back into
  the Jira issue; toggle `needs-research` → `research-done`.

## Shared persona requirement (applies to ALL skills)
Every surface holds one fixed persona (blunt, anti-drift,
problem→solution→move-on). See `../contracts/persona.md`.
