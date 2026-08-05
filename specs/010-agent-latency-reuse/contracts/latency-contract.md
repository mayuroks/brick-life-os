# Contract: Discord Agent — Message Handling & Latency

**Feature**: `010-agent-latency-reuse` | **Date**: 2026-08-05

The interface this feature provides: the **Discord bridge message-handling contract**
that guarantees stateless message processing, exactly-one-turn-in-flight, and correct
replies, while meeting latency/cost targets. This contract governs the bridge's behavior
observable from the outside (the Discord surface), not internal code structure.

## Contract: message intake & ordering

- **Input**: any non-empty text message posted by a human in any Discord channel the
  bot can see (ignores bot messages / empty text / voice-only messages per existing
  behavior).
- **Ordering (FR-002)**: messages are processed in arrival order, globally across all
  channels. Exactly one message is being turned into a reply at any moment.
- **No dropping (FR-001/SC-003)**: every accepted text message receives a reply; excess
  messages during a burst wait in memory and are answered in turn.

## Contract: stateless turns (FR-003)

- Each message is answered from a **fresh, empty context** — no conversation history is
  carried from prior messages. Consecutive messages never influence each other's replies.
- Domain state is rebuilt from Jira on each turn; the agent holds no local conversation
  memory.

## Contract: reply posting

- The agent's reply is posted back to the **same channel** the message came from.
- During a long turn, a rotating status indicator is shown; on completion it is replaced
  by the final reply (existing behavior preserved).

## Contract: warm-serve reuse (FR-005, FR-008) — gated

- The bridge MAY route a message through a kept-alive agent (bootstrap/config/Jira
  connection reused) **only if** that path is verified to return a correct, **non-empty**
  reply for a fresh blank prompt (R3 canary).
- A reused agent MUST still start each message with empty context (FR-003) — warm boot,
  empty context ("green-but-blank").
- If the warm path is unverified or fails, the bridge MUST fall back to a safe per-message
  path that still returns a correct reply (FR-008).

## Contract: no-billable cost (FR-007)

- The deployed solution runs on free-tier infra only; no billable service is introduced.
- Existing running billable resources are identified and stopped (reclaim) so monthly
  spend is $0.

## Contract: latency (FR-009, SC-001)

- The bridge records/exposes send-to-reply latency so the improvement is measurable
  (timing surfaced in logs; existing `/health` + log journal).

## Contract: success / failure rule

- **Success** = a text message produces a correct, non-empty reply posted to its channel,
  within the latency target, with exactly one turn in flight and no messages dropped.
- **Failure** = a reply missing, empty, or interleaved; or two turns running concurrently;
  or the process crashing/OOM during a burst.

## References

- Spec: [spec.md](../spec.md) (FR-001, FR-002, FR-003, FR-004, FR-005, FR-007, FR-008,
  FR-009)
- Data model: [data-model.md](../data-model.md)
- Research (serve-attach + title verification): [research.md](../research.md)
