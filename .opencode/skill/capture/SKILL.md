---
name: capture
description: "Capture surface (User Story 2 / WB1). Trigger: 'add to backlog: X' (voice or text). Files an assessed, labeled Jira issue in the correct domain project, routing ambiguous captures to the Ideas project instead of erroring. Never re-hides internal/antivisible items (FR-012)."
---

# /capture — "add to backlog: X"

Turn any spoken or typed commitment into an assessed, labeled Jira issue in
the right project. Input arrives as `add to backlog: X` (voice or text).

## Contract baseline

- **SSOT = Jira.** Every capture becomes one issue in one of the 10 domain
  projects. Nothing is stored locally.
- **Labels / statuses / fields**: names MUST match the frozen contracts —
  `specs/001-life-os-setup/data-model.md` (Label Schema) and
  `specs/001-life-os-setup/contracts/jira-config.md`.
- **Persona**: blunt, anti-drift, problem → solution → move on
  (`persona/persona.md`). Assess honestly and move on — do not editorialize.
- **FR-012**: an item flagged `internal` is antivisible — it must stay
  visible, never be deleted or re-hidden. Captures are **new** issues, so
  FR-012 governs the whole downstream lifecycle, but the `internal` label is
  applied here exactly as spec'd so the record carries it from the start.

## Trigger & input handling

- **Trigger**: any input of the form `add to backlog: <X>`, whether spoken
  (transcribed) or typed. Also accept loose variants: `add to backlog X`,
  `backlog: X`, `capture X`.
- **Voice handling**: normalize the transcript — strip filler ("um",
  "I need to", "can you"), collapse uncertain phrasing into a clean summary.
  If the text is genuinely garbled and the intent cannot be recovered, ask
  the user one clarifying question rather than filing a garbage issue.
- **Extract** from `X`, when present:
  - the domain (Career / Family / House / Finance / Network / Health-Diet /
    LifeOS / Docs / Ideas) — explicit or inferred;
  - any constraint (`loc:` / `time:` / `person:`);
  - a week target (`week:YYYY-Www`);
  - whether it is a `routine:<name>` task;
  - whether it is an `internal` (antivisible self-commitment).

## Step 1 — Router logic (project selection)

Resolve the target **project key** at runtime from Jira via the MCP server —
never hardcode static keys. The 10 canonical domains and their runtime keys
live in `project-config.json` → `.jira.project_discovery` →
`.jira.key_overrides` (resolved live 2026-08-02:

Career=`BF`, Family=`AT`, House=`HM`, Finance=`FIN`, Network=`BR`,
Health/Diet=`BH`, LifeOS=`BS`, Docs=`MDP`, Ideas=`ART`, Nush=`NSH`).

1. Read the 10 domains from `.jira.project_discovery.required_domains`.
2. Map the capture to **one** domain:
   - explicit (user says "family" / a keyword resolves cleanly), or
   - inferred from nouns / verb context (e.g. "gym", "diet", "workout" →
     `Health/Diet`; "insurance", "budget", "invest" → `Finance`; "flatmate",
     "repair", "furniture" → `House`; "call X", "catch up with Y" →
     `Network`; "docs", "wiki", "notes" → `Docs`).
3. Resolve the domain's runtime key from `.jira.key_overrides` (or, if not
   present, query the MCP server `atlassian` via `jira_get_all_projects` /
   project search to derive it). **Do not route to a key that is not in the
   map** — in particular **never route to `BPD`** (Personal Development),
   which is explicitly excluded from the 10-domain map.
4. **Fallback (never error)**: if the capture does not map cleanly to any of
   the 8 typed domains, route it to the **Ideas** project (`ART`) — the
   catch-all for unstructured/unrouted captures. This is the guaranteed
   non-error path (contract T011 + `contracts/jira-config.md` §Routing rule).

## Step 2 — Assessment (priority + routine-vs-once)

Every capture gets an assessment written into the issue:

- **Priority** (Jira priority field): set from urgency + cost-of-delay, using
  the persona's blunt lens (a miss that breaks a streak or a promise ranks
  higher than a someday item).
  - High / Highest — timeboxed or consequence-laden (breaks delivery, has a
    hard date, blocks someone).
  - Medium — important but no imminent consequence.
  - Low / Lowest — someday / nice-to-have.
- **Routine-vs-once** classification — write into the issue description (and
  a `routine:<name>` label when the task is a recurring routine):
  - **routine** — recurring practice/task (e.g. gym, meal-prep, weekly
    review). These tie to `/practice` streak tracking downstream.
  - **once** — a single actionable commitment (e.g. "plan a birthday gift").
- Keep the assessment one or two lines. Problem → solution → move on.

## Step 3 — Labels

Apply the exact labels from `data-model.md` Label Schema that the capture
supports:

- `loc:<value>` / `time:<value>` / `person:<value>` — a single constraint
  when present.
- `week:YYYY-Www` — target week when specified (ISO format, e.g.
  `week:2026-W32`).
- `routine:<name>` — for routine tasks (e.g. `routine:gym`).
- `internal` — mark when the capture is an antivisible self-commitment the
  user does not want broadcast. Applying `internal` here bakes the FR-012
  guarantee (never re-hide) into the record from birth.
- Do **not** apply `needs-research`/`research-done`/`long-stuck` on capture
  unless the item explicitly requires research — `long-stuck` is
  auto-flagged at ≥28d, never set manually here.

## Step 4 — Create the issue

Via the Jira MCP server (`atlassian`), create **one** issue:

- **project_key** = the routed key from Step 1.
- **summary** = the normalized commitment text.
- **issue_type** = Task (the default commitment type).
- **description** = assessment block (priority rationale + routine-vs-once
  classification + any constraint/context) in Markdown.
- **components / priority** = priority from Step 2.
- **labels** = labels from Step 3.
- **status**: leave as the workflow start state **Backlog** (created via
  `jira_create_issue`; do not rush it to Ready — that is the weekly groom's
  job).

## Step 5 — Confirm

Reply with the routed outcome in the persona voice:

- Routed cleanly → `Routed to <Project> (<KEY>): "<summary>". Pri <p>,
  <routine|once>.`
- Routed to Ideas fallback → state plainly that it went to **Ideas** because
  it didn't map to a domain — never present a fallback as a domain hit.
- If a capture is ambiguous enough to *require* a clarifying question, ask it
  (one question, blunt) before filing.

## FR-012 — internal/antivisible items are never re-hidden

- The capture skill creates new issues; it never deletes, moves away, or
  marks-as-archived any issue.
- `internal` items are created labeled `internal` so the guarantee is on the
  record from the start. Downstream skills (daily friction T032, weekly groom
  T023) are the ones that must never re-hide — this scaffold guarantees the
  label exists for them.
- If an existing `internal` issue is ever mentioned during a capture (e.g. a
  follow-up), **do not** touch its visibility — append/relate only.

## Shared references

- Labels / validation: `specs/001-life-os-setup/data-model.md`
- Jira contract (projects, routing, fields): `specs/001-life-os-setup/contracts/jira-config.md`
- Runtime values (keys, map): `project-config.json`
- WB2 scoring (routine/streak downstream): `.opencode/skill/_shared/wb2-scoring.md`
- Persona / ragebait: `persona/persona.md`, `persona/ragebait.md`
