# Feature Specification: Brick Agent Run Logging

**Feature Branch**: `008-brick-agent-logging`

**Created**: 2026-08-04

**Status**: Draft

**Input**: User description: "We need to add some logging to understand what's going wrong on cloud. The Brick agent sometimes replies with a vague 'The agent took too long. It may be offline or Jira is unreachable — try again.' We want to test logging locally first, then deploy it."

## Clarifications

### Session 2026-08-04

- Q: Based on the logs, would we know how much time which operations take to complete? → A: Yes, and additionally per-sub-operation timing is in scope — the run log must break total agent-run time into its constituent operations (LLM model call, Jira API calls, other tool calls) so we can see which operation is slow.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture Why an Agent Run Fails or Times Out (Priority: P1)

When Brick is unresponsive, the user currently only gets a single generic line: *"The agent took too long. It may be offline or Jira is unreachable — try again."* There is no way to tell whether the headless agent process crashed, hung, could not reach Jira, or was just slow. This story makes every agent run produce a complete, inspectable log trail so the user (or an operator) can diagnose the root cause instead of guessing.

**Why this priority**: This is the whole point of the feature — without a diagnostic trail, every cloud failure is a mystery and re-deploys are blind. It delivers immediate value on its own.

**Independent Test**: Send a request to Brick while the cloud agent is offline or slow (or simulate a run that exceeds the timeout), then confirm the produced log contains enough detail (timing, process outcome, streamed output) to identify why the run stopped.

**Acceptance Scenarios**:

1. **Given** the agent runs and succeeds, **When** the run completes, **Then** the log records the start, the duration, the process exit outcome, and the reply length.
2. **Given** a run fails fast (provider/Jira error, non-zero exit), **When** the run ends abnormally, **Then** the log records the process stderr and the failure reason, not just a generic message.
3. **Given** a run exceeds the configured timeout, **When** the timeout fires, **Then** the log records that the timeout was hit, how long it waited, and any output captured up to that point.

---

### User Story 2 - See Agent Progress While Running (Priority: P2)

During a long run, there is currently nothing recorded between "start" and "finish". The user cannot tell whether the agent made progress, got stuck, or was waiting on an external service. This story logs lifecycle events and streamed agent output as they happen so the trail reflects what the agent was doing.

**Why this priority**: Useful for diagnosing slow-but-progressing runs, but not required to answer the most common "is it broken or just slow" question, which story 1 already covers.

**Independent Test**: Run a request that takes a while and confirm the log shows intermediate lifecycle entries (output received over time), not just two timestamp bookends.

**Acceptance Scenarios**:

1. **Given** an agent run is in progress, **When** the agent emits stdout/stderr, **Then** each chunk is appended to the log with the elapsed time since the run started.
2. **Given** a run is long, **When** it has not emitted output for a while, **Then** the log indicates that no output has arrived since the last entry.
3. **Given** the agent makes a series of operations (e.g. calling the model, calling Jira, running a tool), **When** each operation completes, **Then** the log records the operation type and how long it took, so the total run time breaks down into those operation durations.

---

### User Story 4 - Break Down Run Time by Operation (Priority: P1)

When a run is slow, knowing only the total duration ("it took 90s") still doesn't say *why*. This story records the duration of each sub-operation the agent performs inside a run — model calls, Jira API calls, and other tool calls — so the operator can see which single operation dominates the total and whether a specific external service is the bottleneck.

**Why this priority**: The user explicitly wants per-operation timing; it's the difference between "Jira is slow" and "the whole run is slow." Required to answer which operation is slow.

**Independent Test**: Run a request and confirm the log shows the total run duration plus a list of operation entries (`operation`, `durationMs`) whose durations sum to ~the total.

**Acceptance Scenarios**:

1. **Given** a run performs multiple operations, **When** each completes, **Then** a log entry records the operation name/type and its duration.
2. **Given** a run is slow, **When** it ends, **Then** the operator can identify the single operation with the largest duration from the log.
3. **Given** an operation fails or times out internally, **When** it ends, **Then** the log records which operation failed and how long it ran before failing.

---

### User Story 3 - Boot, Health and Runtime Visibility (Priority: P3)

The bridge, health endpoint, and config are currently logged with bare `console.log` lines and little structure. This story makes runtime state (boot, health flips, queue actions, config load) flow through the same logging pipeline so the whole Brick process is observable in one place.

**Why this priority**: Improves overall operability and cross-references diagnostics, but the run-diagnosis value is already delivered by stories 1–2.

**Independent Test**: Boot the service and confirm boot events, health state changes, and per-message queue actions appear in the shared log with consistent structure.

**Acceptance Scenarios**:

1. **Given** the service boots, **When** it starts, **Then** it logs boot events (config loaded, health listening, bridge logged in) through the shared logging path.
2. **Given** the service is running, **When** a health state changes (agent up/down), **Then** that change is logged with context.

---

### Edge Cases

- A run that succeeds only after near-timeout (slow but completes) — the log must show it succeeded and how long it took.
- A run killed mid-flight by SIGKILL after timeout — the log must show the kill and the timeout reason.
- The headless agent process fails to spawn (binary missing) — the log must capture the spawn error, not silently reject.
- Multiple concurrent runs in different channels — log entries must distinguish channel/request context.
- Empty reply from the agent (e.g., an earlier "timeout" event was actually a silent run) — the log must show the process exited 0 but produced no text.
- Sensitive content (Jira tokens, user PII) — must not be written to logs.
- A run whose operations are recorded but which never reaches a terminal run event (e.g. killed mid-operation) — the log must still show the last known operation and its in-progress duration.

## Expected Log Detail (Diagnostic Reference)

For a given agent run, the operator expects enough captured data to answer: Did the process start? How long did it take? Did it time out, exit abnormally, or complete? What output did it emit and when? What did stderr say on failure? Which sub-operation took the longest? These drive the acceptance scenarios above. Exact storage/format is an implementation concern, out of scope for this spec.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST record the start of every agent run, including the timestamp and the channel/request context.
- **FR-002**: System MUST record, on completion, the total run duration and the process exit outcome (success/signal/timeout).
- **FR-003**: System MUST, on a timed-out run, record that the timeout fired, the configured timeout duration, and all output captured up to that point.
- **FR-004**: System MUST, on an abnormal exit or spawn failure, record the stderr text and the failure reason.
- **FR-005**: System MUST stream and record agent stdout/stderr chunks as they arrive during a run, each with the elapsed time since run start.
- **FR-006**: System MUST log runtime lifecycle events (boot, config load, health state changes, bridge login, per-message queue actions) through the same logging path as run events.
- **FR-007**: System MUST keep sensitive data (secrets, tokens, user PII) out of log output.
- **FR-008**: System MUST allow logging to be validated locally (developer machine) before it is deployed to cloud.
- **FR-009**: System MUST log via a single consistent, structured format so entries are filterable/searchable.
- **FR-010**: System MUST record the duration of each sub-operation (model call, Jira API call, tool call) performed inside an agent run, associated with that run's context.
- **FR-011**: System MUST, at run end, allow the per-operation durations to be reconciled with the total run duration (i.e., operations are attributable to a run and bounded by it).

### Key Entities *(include if feature involves data)*

- **Agent Run**: One invocation of the headless agent; has start/end time, duration, exit outcome, and accumulated output. Bijects to one user request.
- **Runtime Event**: A lifecycle occurrence (boot, health change, queue action) independent of any single run but recorded in the same log.
- **Channel Context**: The Discord channel (and requesting user) that a run belongs to, used to disambiguate concurrent runs.
- **Operation**: A discrete action performed inside an agent run (an LLM model call, a Jira API call, another tool call); has a name/type, start time, and duration, and belongs to exactly one Agent Run.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of failed or timed-out agent runs produce a log entry that identifies the failure driver (timeout, non-zero exit, spawn error, Jira/provider outage) without guesswork.
- **SC-002**: 100% of successful agent runs record start, duration, and completion outcome.
- **SC-003**: Operators can, from the log of a single failed run, state the run duration and the reason it stopped within 1 minute of reading it.
- **SC-004**: Logging is verified working end-to-end on a local machine before any cloud deployment, using a real (or simulated) failing/slow run.
- **SC-005**: Zero secrets or user PII appear in produced logs across all test scenarios.
- **SC-006**: Operators can, from a single slow run's log, state which sub-operation took the longest and its duration within 1 minute of reading it.
- **SC-007**: 100% of runs that perform multiple operations log a duration per operation, and those durations reconcile to the recorded total run duration.

## Assumptions

- The existing Brick agent (`deploy/discord-agent`) is the target surface to instrument.
- Logging is additive observability; existing behavior, error messages shown to Discord users, and timeouts stay unchanged in v1.
- Cloud log storage/retrieval mechanism is out of scope; the deliverable is the local instrumented agent (log output that can be captured where the process runs), verified locally first.
- A human or operator reads the logs to diagnose; structured formatting (FR-009) is a means to that end, not a data-pipeline requirement.
- Deployment to cloud happens only after local validation (FR-008).
- Dependencies: the existing `deploy/discord-agent` runtime and its deployment path from the prior deploy features are reused.
