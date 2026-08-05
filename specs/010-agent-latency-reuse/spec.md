# Feature Specification: Discord Agent — Latency & Reuse

**Feature Branch**: `010-agent-latency-reuse`

**Created**: 2026-08-05

**Status**: Draft

**Input**: User description: "check the docs in specs/010 agent latency directory. convert to specs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get Fast Replies (Priority: P1)

A Discord user sends a command (e.g. "today", "add to backlog: X", "research KEY-42")
and gets a useful reply in a reasonable time. Today each message takes ~40s because
every turn cold-starts the agent and makes a throwaway naming call the user never
sees. The user wants replies that feel responsive so the bot remains practically
useful rather than a novelty.

**Why this priority**: A bot that answers fast is the core value. Removing per-message
overhead (the ~20s throwaway naming call) is the single highest-value quick win, and
nothing else (bursts, cost) matters if the primary path is sluggish.

**Independent Test**: Deploy and send a mix of real commands from Discord; measure the
wall-clock time from send to reply across several commands and confirm it improves (is
faster than the ~40s baseline) without breaking answer quality.

**Acceptance Scenarios**:

1. **Given** the agent is deployed, **When** a user sends a "today" command, **Then** a
   substantive reply is posted and the send-to-reply time is faster than the pre-change
   baseline (~40s).
2. **Given** a message is being processed, **When** a second unrelated message arrives,
   **Then** the second reply does not corrupt or interleave with the first and both are
   eventually answered.

---

### User Story 2 - Handle a Burst Without Crashing (Priority: P2)

A user dumps several messages quickly (e.g. ~10 messages, one every second or two).
The bot must not crash from running too many agent turns at once on a small free-tier
host. Messages are processed one at a time in arrival order; whichever back up simply
wait in memory and are answered in turn.

**Why this priority**: The host is memory-constrained. Without a strict one-at-a-time
rule, a burst could spawn multiple heavy agent runs at once and run out of memory. A
single-slot process is the structurally simple way to guarantee stability.

**Independent Test**: Send ~10 messages back-to-back from Discord and observe that the
host never runs more than one agent turn at a time, stays up, and answers every
message in order.

**Acceptance Scenarios**:

1. **Given** a host running the free-tier config, **When** 10 messages are sent quickly
   in any channel(s), **Then** messages are processed strictly one at a time and none
   cause an out-of-memory failure.
2. **Given** a burst is in progress, **When** a new message arrives, **Then** it is
   queued in memory and answered after earlier messages, with no replies dropped.

---

### User Story 3 - Stay at $0 Cost (Priority: P2)

The bot runs on AWS at a hard $0/month — no billable services. Any currently-running
billable resources are identified and stopped, and the solution does not introduce
new paid infrastructure.

**Why this priority**: The project rule is "no billable services, ever." Keeping spend
at $0 is a standing constraint that shapes the host choice and forbids vertical
scaling as a fix.

**Independent Test**: Inspect the live account (running services/tasks and billing) and
confirm $0 spend, then confirm the deployed host remains within free-tier limits.

**Acceptance Scenarios**:

1. **Given** the deployment, **When** the account's running resources are audited,
   **Then** no billable service is running and monthly spend reports $0.
2. **Given** the feature is shipped, **When** new infrastructure is considered, **Then**
   it stays within free-tier limits and never introduces billable spend.

---

### User Story 4 - Reuse Warm Startup Where Proven (Priority: P3)

Where a warmed-up agent is shown to work reliably, the bot reuses it across messages so
startup cost (loading config, persona, and connecting to Jira) is paid once instead of
every message — while each message still starts a fresh, empty context (no conversation
memory is carried). This re-use is only adopted after it is verified to actually work
for the current setup; if verification fails, the safe fallback is used instead.

**Why this priority**: This is the largest lever on latency but carries real risk — the
current build reportedly returns empty replies on the attach path. It must be proven
before it is trusted, so it is a priority-3, verification-gated slice.

**Independent Test**: Reproduce the reported empty-reply condition locally, confirm a
warmed session can serve a fresh blank prompt, then measure whether startup overhead
disappears while answers stay correct.

**Acceptance Scenarios**:

1. **Given** a warmed agent is available, **When** it is used for a new message, **Then**
   the message starts with empty context (no prior conversation) and returns a correct,
   non-empty reply.
2. **Given** reuse cannot be verified to work, **When** the bot is asked a message, **Then**
   it falls back to the safe path and still returns a correct reply, keeping whatever
   latency savings the quick wins already achieved.

---

### Edge Cases

- What happens when the queue is full of backed-up messages and a new one arrives?
  (It waits in memory; no messages are dropped, but replies can lag during a burst.)
- What happens when a single message takes too long or hangs? (It consumes the single
  slot; later messages wait until it finishes or times out.)
- What happens if the warmed-up agent path is unavailable or misbehaves? (Fall back to
  the safe per-message path so the user still gets an answer.)
- What happens to replies when many channels send at once? (Serialized globally — one
  run in flight across all channels.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST answer every text message with a substantive reply (no
  messages silently dropped).
- **FR-002**: System MUST process messages one at a time globally (across all channels),
  running at most one agent turn at any moment, with any excess messages queued in
  memory and answered in arrival order.
- **FR-003**: System MUST NOT carry conversation/history between messages; each message
  is answered from a fresh, empty context and rebuilds state from Jira as needed.
- **FR-004**: System MUST avoid the per-message overhead that is invisible to the user
  (e.g. the throwaway session-naming call) wherever it does not affect answer quality.
- **FR-005**: System MUST keep Jira connectivity and configuration hot so they are not
  fully re-established from scratch on every message, without leaking state between
  messages.
- **FR-006**: System MUST remain running and stable during a burst of ~10 messages sent
  at ~1 message per 1-2 seconds, without running out of memory or crashing.
- **FR-007**: System MUST NOT introduce any billable AWS service or paid plan; the
  deployment MUST remain within free-tier limits.
- **FR-008**: System MUST reuse a warmed startup path only if verified to return correct,
  non-empty replies for a fresh blank prompt; otherwise it MUST use the safe fallback.
- **FR-009**: System MUST report/observe the send-to-reply latency so the improvement can
  be measured, without exposing sensitive data.

### Key Entities *(include if feature involves data)*

- **Message**: A command or query a user sends on Discord; it carries text and the
  channel it came from, and is answered independently of all other messages.
- **Wait Queue**: An in-memory ordered collection of messages awaiting processing; it
  holds excess messages during a burst and drains them one at a time.
- **Agent Turn**: A single unit of work that turns one message into one reply; exactly
  one is in flight at any time.
- **Warm Session**: A kept-alive agent environment (configuration, persona, and a live
  Jira connection) that can be reused across messages while each message gets a fresh,
  empty context.

## Clarifications

### Session 2026-08-05

- Q: What percentile should the ~20s latency target in SC-001 be measured at? → A: No
  hard latency limit. The ~20s figure was a rough estimate, not a requirement. Goal is
  to capture whatever latency the quick wins (title-off, warm reuse if proven) save —
  no percentile, no fixed ceiling, no acceptance threshold to chase.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Send-to-reply time for a common command (e.g. "today") improves from the
  ~40s baseline by whatever the quick wins save (notably disabling the throwaway
  session-naming call), without degrading answer quality. No fixed target or percentile:
  capture and report the measured improvement.
- **SC-002**: A burst of 10 messages sent at ~1 per 1-2 seconds all receive replies, the
  host never runs more than one agent turn concurrently, and the process does not crash
  or run out of memory.
- **SC-003**: 100% of text messages are answered (no silent drops) under normal and burst
  conditions.
- **SC-004**: Monthly AWS spend remains at $0 (no billable service running), confirmed by
  auditing the live account.
- **SC-005**: No conversation is carried between messages: consecutive messages never
  influence each other's answers.

## Assumptions

- Users have a stable connection to Discord (the bot responds within a session).
- The bot is a single-user personal assistant; worst-case backpressure during a burst is
  acceptable and no drop policy is required.
- State lives in Jira (the single source of truth); the agent rebuilds context from it
  each turn rather than keeping local conversation memory.
- The host is a small free-tier configuration (approx. 512MB-1GB memory / ~0.5 vCPU);
  the solution must fit within that without scaling the infrastructure.
- "Horizontal" scope is preferred: the goal is to cover the existing surfaces well, not
  to engineer high-complexity/vertical performance wins.
- Verification (the "empty replies on attach" condition) is a prerequisite gate for the
  warm-reuse path; the safe per-message path remains the guaranteed fallback.
