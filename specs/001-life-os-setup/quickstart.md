# Quickstart: Life OS Setup — Validation Guide

**Feature**: Life OS Setup | **Date**: 2026-08-02

Purpose: prove the setup works end-to-end. Since this is a
setup/integration project, "validation" means verifying configuration and
interfaces resolve correctly, not running app unit tests.

## Prerequisites

- Jira site access + MCP server connection configured.
- Google (or Apple) calendar access.
- The shared contracts fixed (see `contracts/` and `data-model.md`) —
  these are the source of truth all agents build against.

## 1. Validate Jira Backbone (Jira agent)

```text
1. Confirm all 9 projects exist.
2. Confirm workflow order: Backlog → Ready → Todo-Week → In Progress →
   Waiting → Done.
3. Confirm all labels and metric custom fields exist (data-model).
4. Create a test issue, move it through the workflow, apply labels.
5. Open dashboard → confirm Pipeline, Long-stuck, Todo-Week, streak-slip
   gadgets render; Long-stuck only after 28d unchanged (can be checked by
   inspecting the filter JQL rather than waiting).
```
**Expected**: all 5 saved filters searchable; dashboard shows live data.

## 2. Validate Capture → Issue

```text
Say "add to backlog: plan a birthday gift"
```
**Expected**: an issue appears in the right project (Family) with a
priority + routine-vs-once assessment and a routed label. An intentionally
ambiguous capture routes to `Ideas`, not an error.

## 3. Validate Weekly Groom

```text
Run "run weekly" against a populated backlog
```
**Expected**: anti-visibility sweep files internal items; ≤7 Todo-Week picks
proposed; scoreboard posts with plan/delivery-perfection, streaks,
long-stuck list, status tier, and 🏆 per target hit.

## 4. Validate Daily Loop

```text
"what next?" → assessed suggestion + rage-fuel line
"done <KEY>" → marked Done + delivery ticked
"practice gym" → practice streak increments
"can't do <KEY> because <Y>" → re-slotted / held visible, never hidden
```
**Expected**: each interaction updates the corresponding state.

## 5. Validate Calendar Fear-Triggers

```text
View calendar → confirm 3 static recurring events with the fixed reminder
text (contracts/calendar-streak-persona.md).
```
**Expected**: events exist at confirmed times; reminder text is static; no
calendar-write automation.

## 6. Validate Persona Consistency

```text
Ask the same question across today / what next / stats / groom surfaces.
```
**Expected**: the same blunt, anti-drift, problem→solution→move-on voice in
every surface; persona is config-adjustable in feedback.

## Notes

- Setup-time user inputs (Jira URL/keys, calendar provider, times, tier
  thresholds, weekly cap, start practice streak) MUST be confirmed before
  the corresponding workstream completes.
- Tests are optional/minimal per the prototype constitution; the checks
  above are manual acceptance validations.
