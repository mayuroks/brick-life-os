<!-- SYNC IMPACT REPORT
  Version: 1.0.0 → 1.1.0
  Modified principles: none (no renaming)
  Added: Workflow rule "Sub-Agent Delegation for Install/Test/Verify" (V)
  Removed: none
  TODOs: none
-->

# Life OS Constitution

Minimal governing rules for a **prototype** personal productivity agent.
Source of truth for decisions: `HANDOVER-FINAL.md`. Where the constitution
is silent, the handover wins; where they conflict, the constitution wins.

## Core Principles

### I. Jira is the Single Source of Truth (SSOT)
Every commitment — including internal/self goals — becomes a real Jira
issue. Nothing ambitious lives only in chat, notes, or memory. This is the
anti-invisibility core; it is non-negotiable.

### II. Agent Is the Interface
The agent assesses, grills, and judges ("what next?"); the user executes.
The agent holds one fixed persona (difficult coach) across all surfaces.
It never deletes or hides a commitment — it keeps it visible.

### III. Motivation = Fear + Streaks + Metrics
Fear-triggers fire before execution; streaks and plan/delivery-perfection
keep delivery honest. Consequence comes first, as a reminder — not after
as a failure report.

### IV. Prototype Pragmatism (MUST)
This is a fast-moving prototype. Prefer the smallest working thing. Tests
are optional — write them only where they save real rework. Do not gold
plate; ship the v1 scope and iterate with the user on feedback.

### V. Sub-Agent Delegation for Install/Test/Verify (MUST)
Installing/troubleshooting a dependency, testing a connection, or
verifying anything is a sub-agent's job, not the primary agent's. Delegate
this work to sub-agents and split it across them in parallel. Use **at
most 3 sub-agents** for any single task. The primary agent stays
responsive and reports results; it does not block on long-running
install/verify loops itself.

## Scope (v1)

Build ONLY: Jira config (9 projects, workflow, labels, filters,
dashboard), 3 static calendar fear-trigger events, four skills (capture,
weekly-groom, daily, research), a streak/plan-deliver tracker, and the
persona prompt. Explicitly DO NOT build in v1: Telegram bot, cron/daemon,
calendar-write automation, Dream/Goals Epics, "why" doc, animated
dashboard.

## Workflow

Run the spec flow minimally: `specify → plan → tasks → implement`.
Treat `clarify`/`analyze` as ceremony — skip when it slows progress.
Confirm the pending items in `HANDOVER-FINAL.md` §13 before/during build.
Deferred items stay deferred unless the user re-scopes them.

## Governance

This constitution supersedes all other practices. Amendments MUST be
documented, bump the version semver, and note what changed. All builds
MUST stay within ratified scope and cite the handover for any divergence.
Use `HANDOVER-FINAL.md` for runtime guidance on decisions, Jira mechanics,
and the rage-fuel/streak specifics.

**Version**: 1.1.0 | **Ratified**: 2026-08-02 | **Last Amended**: 2026-08-03
