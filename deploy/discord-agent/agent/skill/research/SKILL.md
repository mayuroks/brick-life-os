---
name: research
description: "Research surface (WB1). Trigger: 'research KEY-42'. Runs background research on a Jira issue, writes cited findings back into the issue, and toggles its label from needs-research to research-done. Read-only on everything except the target issue's description + labels."
---

# /research — "research KEY-42"

Add background research to a Jira issue and mark it researched. Invoked from
the daily loop (`research KEY-42`) or directly.

## Contract baseline

- **SSOT = Jira.** Findings are written back into the target issue's
  description; its research label toggles `needs-research` → `research-done`.
- **Labels**: exact names from `specs/001-life-os-setup/data-model.md`
  Label Schema (`needs-research`, `research-done`).
- **Persona**: blunt, anti-drift, problem → solution → move on
  (`persona/persona.md`). Cite what you
  found, state what it changes, move on — no padding. Same single coach voice
  as every other surface (capture, weekly-groom, daily).
- **Scope**: research is read-side only. Do not change the issue's project,
  priority, status, or routing.

## Steps

1. Read the target issue (`KEY-42`) — its summary, description, current
   research labels, and any existing findings.
2. Run focused background research on the open question(s) in the description.
   Keep it bounded and answer-oriented: what is decided, what is uncertain,
   and what the issue's next concrete step should be.
3. **Write findings back** into the issue description:
   - Append a **`## Research`** section (or a dated bullet under an existing
     one) with the key findings and **citations/sources**.
   - Update the description's open question with the answer found.
4. **Toggle the research label**: remove `needs-research`, add `research-done`
   only when the open question actually got answered. If it did not, leave
   `needs-research` and say plainly what is still blocking.
5. Reply in persona voice: what you found, what it changes, next step. Do not
   re-hide or re-status the issue.

## FR-012 — never hide

- Research only edits the description and research labels; it never moves,
   re-hides, or deletes an issue (including `internal` ones).

## Shared references

- Labels / validation: `specs/001-life-os-setup/data-model.md`
- Jira contract (fields, labels, routing): `specs/001-life-os-setup/contracts/jira-config.md`
- WB2 scoring (routine/streak downstream): `.opencode/skill/_shared/wb2-scoring.md`
- Persona / ragebait: `persona/persona.md`, `persona/ragebait.md`
