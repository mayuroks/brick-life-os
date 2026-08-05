# ADR-010: Discord Agent — Stateless Per-Message, Single-Slot Queue, Warm-Boot

**Date**: 2026-08-05 | **Status**: Accepted | **Spec**: [spec.md](./spec.md)

## Context

The Discord bridge (`deploy/discord-agent`) currently spawns a **fresh `opencode run`
per message** (`src/agent/client.js:63`), on the same 0.5 vCPU / 1GB Fargate task that
also keeps a warm `opencode serve` on :4096 that it **never attaches to**. The AI
analysis found every message re-does cold boot + config/persona + throwaway auto-title
~20s + Jira MCP reconnect + full teardown ≈ 40s per message.

User goals from the grilling session:
- **Truly stateless** per message is acceptable.
- Reuse the warm serve to cut boot, but as a **green-but-blank** session (no convo state).
- **Bounded/global serial** processing — 1 agent run at a time.
- **Hard $0/mo** on AWS; reclaim existing spend.
- Prefer **horizontal** coverage over vertical depth / high-complexity wins.

## Decision

1. **Stateless per message.** No conversation or context carried between messages.
   All domain state lives in Jira; each blank turn rebuilds from Jira MCP. This is
   the *current* behavior and is accepted as the model.

2. **Global single-slot in-memory queue.** Replace the per-channel chained FIFO
   (`queue.js`) with one process-wide FIFO that runs **exactly one agent run in
   flight**. Messages beyond the in-flight one wait in memory (an array). This
   serializes across all channels, guaranteeing no more than 1 `opencode run` process
   exists at once → no OOM on the 1GB task by construction.

3. **Kill the throwaway auto-title call.** The auto-title LLM round-trip (~20s) is
   pure waste for a Discord bot (titles are never seen). Disable it regardless of the
   serve-reuse outcome.

4. **Reuse warm serve (green-but-blank) — gated on verification.** Reuse the warm
   `opencode serve` :4096 so boot/config/Jira-MCP-init are done once, not per message.
   **Grill the serve API first**: the code comment claims `--attach` returns empty
   replies for this model/build. This must be verified as real before designing the
   reuse path. The blank-session requirement (fresh prompt, reset context) is
   non-negotiable and must be confirmed possible against the serve API.

5. **Hard $0/mo, reclaim.** Fargate 1024MB is not free-tier-forever. Goal: no billable
   spend. Reclaim = verify what's actually running (EC2 + ECS) and flatten/stop it,
   keeping only the minimal free-tier host. Do not architect vertical new infra.

## Consequences

- Latency becomes ~15-20s (answer model ~9s network + minimal overhead) instead of ~40s.
- A 10-message burst (1/2s, same or across channels) drains **serially ≈ message ×
  full-latency**, backpressure grows in-memory. No drop policy (user: not a hard req).
- Risk: single in-flight slot means slow perspective — any stuck run blocks the queue
  for its timeout. Acceptable for a single-user personal bot.
- Risk: serve-reuse path may be infeasible (empty-reply bug). If so, fall back to
  fresh-per-message + auto-title-off (still kills ~20s). This is the floor.

## Implementation Status (2026-08-05)

- **DONE — title-off (FR-004)**: fixed `--title "life-os-agent"` added to the deployed
  `opencode run` spawn in `src/agent/client.js`.
- **DONE — single-slot queue (FR-002)**: `queue.js` rewritten to a global single-slot
  FIFO (max 1 in-flight across all channels, FIFO order, no drops); verified 10-job burst
  → maxInflight=1, order 0-9. `bridge/client.js` signhature unchanged (channelId
  passthrough).
- **PENDING (deployment-gated)** — warm-serve reuse (US4): attach path verified
  non-empty locally (research R2) but gated on a live canary through the real deployed
  bridge (FR-008) before `--attach` replaces the fresh-run path.
- **PENDING (deployment-gated)** — $0 reclaim (US3): audit + stop of running billable
  ECS/EC2 requires live destructive actions; not executed in this session.
- **Note**: no hard latency target (user clarified 2026-08-05) — capture whatever the
  quick wins save, no percentile/ceiling.

## Alternatives Considered

- **Carry conversation / compaction**: rejected — user wants stateless; Jira is memory.
- **Per-channel serial (status quo)**: rejected — different channels already run in
  parallel, risking OOM on bursts; user wants global single-slot.
- **Bounded parallelism (cap 3-4)**: rejected — arithmetically impossible on 1GB with
  ~500MB runs; user moved to single-slot queue instead.
