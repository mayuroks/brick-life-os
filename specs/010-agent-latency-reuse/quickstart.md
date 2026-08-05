# Quickstart: Discord Agent — Latency & Reuse (Validation Guide)

**Feature**: `010-agent-latency-reuse` | **Date**: 2026-08-05

Purpose: validate end-to-end that the changes (single-slot queue, title-off, optional
warm-serve reuse) meet the spec's latency, no-drop, and $0-cost outcomes without
modifying local opencode usage. Manual acceptance suffices per the constitution.

## Prerequisites

- Deployed `deploy/discord-agent` (ECS Fargate free-tier, per spec 007) with real
  Discord/Jira/OpenRouter secrets.
- Local `opencode` available for the R2/R3 canary (does not need to be the maintainer's
  regular config — verification uses the repo's `deploy/discord-agent/agent` dir).
- Baseline recorded: current send-to-reply time (expected ~40s) before applying changes.

## 1. Verify single-slot / no-crash on burst (FR-002, SC-002, SC-003)

Deploy the single-slot queue, then send ~10 text messages back-to-back (every 1-2s)
from Discord — same channel, then across two channels.

- Expect: replies arrive one at a time, in order, all answered (no drops), no OOM/crash.
- Confirm at most one agent turn is ever in flight (observe the process; latency tail +
  no concurrent duplicate "thinking" states).
- Expected outcome: host stays up; burst drains serially (≈ N × per-message latency).

## 2. Verify title-off (FR-004, SC-001)

Deploy with the fixed `--title` on the deployed `opencode run` invocation. Send a
"today" command and read the deployed logs (`--print-logs --log-level DEBUG`).

- Expect: NO title-generation LLM call appears; send-to-reply time drops by the ~20s
  that was previously spent on the throwaway title call.
- Confirm the title is a non-default fixed string (empty `--title ""` is a known no-op).
- If the 20s persists, check whether a **summary** call (not title-controllable) is the
  real dominant cost — see research R1; document the finding.

## 3. Verify no conversation leak (FR-003, SC-005)

Send two related messages in sequence, e.g. "remember the number 7" then "what number
was that?".

- Expect: the second reply does NOT recall the first — each turn is blank and rebuilds
  from Jira (green-but-blank holds). Consecutive messages never influence each other.

## 4. Verify warm-serve reuse only if it works (FR-005, FR-008)

**Gate**: run a live canary through the real bridge path first (research R3). Send a
real command (e.g. "add to backlog: X", "today") via the deployed `--attach` path.

- If the attached path returns a correct, non-empty reply on the real command → adopt it;
  confirm no empty replies and blank context per message.
- If it returns empty/misbehaves → keep the safe fresh-run + title-off path (this is the
  acceptable floor) and record the failure in research.md. Do NOT ship `--attach` unverified.

## 5. Verify $0 spend / reclaim (FR-007, SC-004)

Audit the live account (`./aws.sh ecs list-services`, `ec2 describe-instances`, billing
dashboard) and confirm:
- No billable service is running.
- Monthly spend reports $0.

## 6. Measure & confirm target (SC-001)

After steps 1-4, measure p50 send-to-reply of a common command.

- Expected: at most ~20s (target), down from ~40s baseline, answer still correct.
- Do NOT chase vertical/scale wins; horizontal coverage is in scope.

## Contract / data-model references

- Message-handling behavior and invariants: [contracts/latency-contract.md](./contracts/latency-contract.md)
- Queue/turn/entities: [data-model.md](./data-model.md)
- Serve-attach + title verification detail: [research.md](./research.md)
