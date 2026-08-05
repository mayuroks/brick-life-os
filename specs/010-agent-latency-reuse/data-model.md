# Data Model: Discord Agent — Latency & Reuse

**Feature**: `010-agent-latency-reuse` | **Date**: 2026-08-05

The feature is **stateless by design** (FR-003, ADR decision): no conversation or
history persists anywhere. All long-lived domain state lives in **Jira** (the external
single source of truth). The only new "data" introduced is an **ephemeral in-memory
wait queue** (FR-002), which exists for the lifetime of the process and is lost on
restart — it is not a storage system.

## Entity: Wait Queue (in-memory, ephemeral)

An ordered collection of pending messages awaiting an agent turn. Exactly **one** agent
turn is in flight at any moment (global, across all channels); all excess messages wait
here in arrival order and are drained one at a time.

| Field | Type | Meaning |
|-------|------|---------|
| jobs | array of queued work items | Each holds a message and its channel, in arrival order. |
| in-flight flag | boolean | True while exactly one agent turn is running. |
| capacity | unbounded | No drop policy; excess messages simply wait (users accept backpressure). |

### Validation rules
- **One-in-flight invariant (FR-002, SC-002)**: at most one agent turn runs at any time
  across ALL channels. No two turns may overlap.
- **FIFO ordering (FR-002)**: messages are answered in the order they arrived.
- **No dropping (FR-001, SC-003)**: no message is silently discarded; each is eventually
  answered.
- **Ephemeral (FR-003)**: the queue holds no cross-message state and must not be treated
  as durable storage.

## Entity: Agent Turn (unit of work)

A single unit of work that maps one message → one reply. Created from a queued job when
the slot is free.

| Field | Type | Meaning |
|-------|------|---------|
| message | string | The user's command/query text (FR-001). |
| channel | channel id | Source channel for routing the reply (passthrough, for reply posting). |
| context | empty | Always blank — no prior conversation (FR-003). |
| session title | fixed string | Non-default title => no throwaway title LLM call (FR-004, R1). |
| result | string | The agent's reply, posted back to the channel (FR-001). |

### Validation rules
- **Fresh context (FR-003, SC-005)**: each turn starts blank; no state from earlier turns.
- **Session title non-default (FR-004)**: the deployed invocation always carries a fixed
  title so no auto-title LLM call fires (R1).

## Entity: Jira (external source of truth — unchanged)

All persistent domain state the agent reads/writes (Todo-Week, backlog, streaks,
metrics). Untouched by this feature except that the agent continues to reconstruct
context from Jira on each blank turn (FR-003). See spec 001 data model for Jira fields.

## Entity: Runtime configuration (deployable service — unchanged)

The env-based config in `src/config.js` (Discord token, Jira creds, provider key,
`OPENCODE_SERVE_URL`, `PORT`). No new config fields are introduced by this feature.

## Relationship summary

```
message ──enqueue──▶ Wait Queue ──dequeue──▶ Agent Turn (1 in flight) ──▶ reply posted
                        │                         │
                        └── ephemeral ────────────┘  reads/writes Jira (external SSOT)
```

## Configuration scope (local vs deployed)
This feature's behavior (fixed `--title`, single-slot queue, optional `--attach`) lives
in the **deployed** `deploy/discord-agent` bridge only. Maintainer-local opencode on the
Macbook is unaffected (research R1 note).
