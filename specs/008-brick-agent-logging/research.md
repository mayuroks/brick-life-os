# Research: Brick Agent Run Logging

**Feature**: [spec.md](./spec.md) | **Date**: 2026-08-04

## Scope of research

Instrument the existing Brick Node.js daemon (`deploy/discord-agent`) so every agent run
and runtime event is observable, validated locally before cloud deploy. No new external
dependencies, no behavior change to Discord users, no timeout change.

## 1. Structured logging approach for a small Node daemon

**Decision**: A tiny ~20-line shared logger module (`src/log.js`) that emits one
newline-delimited JSON object per entry: `{ ts, level, ctx, msg, ...fields }`. Context
object carries stable identifiers (e.g. run/request id, channelId). Logger routes to
stdout for `info`/`warn` and stderr for `error`.

**Rationale**: The daemon is single-process and already relies on host log capture
(CloudWatch on ECS Fargate per feature 007). A dedicated dependency (pino/winston)
adds surface for zero benefit at this scale. NDJSON-structured lines are trivially
searchable/filterable in CloudWatch Logs Insights and in local `jq`. One shared module
guarantees FR-009 (consistent format) and FR-007 (single place to prevent secret/PII
leak).

**Alternatives considered**:
- `pino`/`winston` — overkill; adds deps to a minimal prototype (constitution IV).
- Plain string `console.log` (current) — used today; loses fields/context, harder to
  filter and correlate concurrent runs. Rejected for FR-002/FR-009.

## 2. Capturing opencode subprocess lifecycle & streamed output

**Decision**: In `src/agent/client.js`, wrap the existing `spawn('opencode', ...)`
`child_process` to log: on spawn — start marker + elapsed clock; on each `stdout`
and `stderr` `data` event — a chunk entry with elapsed ms since start (FR-005);
on `close` — exit outcome `{code, signal, durationMs, outBytes, errBytes}` (FR-002);
on the timeout timer — `{event:'timeout', timeoutMs, capturedOut, capturedErr}`
before `SIGKILL` (FR-003); on `child.on('error')` (spawn failure) — the `err.message`
(FR-004). Keep a bounded rolling capture of stdout/stderr text so a timeout entry can
include "output so far" without unbounded memory. `data` event buffering already
appends to `out`/`err` variables; the logger reuses those plus elapsed time. The
existing timeout constant (`TIMEOUT_MS = 180000`) is unchanged.

**Rationale**: `child.on('error')` only fires for spawn failures (binary missing,
permissions), which today is silently swallowed into the generic catch → FR-004
requires explicit capture. Streaming `data` listeners already exist; adding an elapsed
timestamp and forwarding to the shared logger is the minimal change that satisfies
FR-005 without a new logging transport.

**Alternatives considered**:
- Attach to `opencode serve` HTTP instead of `run --attach` — larger rewrite, changes
  invocation; not needed to satisfy the spec. Rejected.

## 3. Runtime lifecycle logging (bridge/boot/health)

**Decision**: Replace the scattered bare `console.log`/`console.error` calls in
`src/index.js`, `src/bridge/client.js`, and `src/health.js` with the shared logger,
keeping equivalent message content but adding context (service, event, channelId). Add
health state-change logging (`agentUp`/`bridgeUp` flips) and per-message queue begin/
end markers. FR-008 means this runs unchanged on a local machine (just `node start`) and
in the container.

**Rationale**: FR-006 requires all lifecycle events to flow through the same path; this
is a mechanical refactor of existing log statements plus two small additions (health
flips, run context). No new files beyond `log.js`.

**Alternatives considered**: Introduce a metrics/event bus — over-engineered for a
single-process prototype. Rejected.

## 4. Per-sub-operation timing (FR-010/FR-011, SC-006/SC-007)

**Decision**: The bridge alone observes only the whole opencode subprocess, so per-operation
timing cannot come from the outer `spawn` layer. Instead the headless agent is instrumented
internally: opencode emits structured per-tool / per-model-call events with durations. Brick
captures those (from the opencode session/event stream or from opencode's own logs) and
forwards them as `run.op` log entries tied to the run context, and aggregates them into the
terminal run event (`ops: [{name, durationMs}, ...]`) so they reconcile to the total
(FR-011).

**Rationale**: This is the only way to see "which operation is slow" (SC-006/SC-007). It keeps
the shared logger/NDJSON format; opencode is the source of per-op durations, Brick is the
relay + aggregator.

**Alternatives considered**:
- Inferring op timing by parsing free-text stdout — fragile, regex-coupled. Rejected.
- Timing only the outer spawn (status quo) — already covered by FR-002; cannot split by op. Rejected.

## 5. Local-first validation (FR-008)

**Decision**: `quickstart.md` defines a local loop: (a) `node --check` on changed files,
(b) boot the daemon locally with a throwaway config and a stubbed agent command so a real
LLM/Jira call is not required, (c) exercise success, fast-fail, and timeout paths and
assert the expected log lines appear. A sub-agent runs this loop (constitution V).

**Rationale**: The spec mandates local validation before deploy (FR-008, SC-004).
Because spawning the real `opencode`/LLM is heavy and flaky to script, validation uses a
fake `opencode` binary (a tiny shell script sleeping or exiting non-zero) swapped in via
`PATH`/command override, letting each path be exercised deterministically.

**Alternatives considered**: Full live end-to-end with real opencode + Jira — correct
but slow/flaky for a CI-less prototype and unnecessary to prove the logger works.
Rejected for `quickstart`; noted as an optional manual smoke test.

## Consolidated decisions

- Use a shared NDJSON structured logger (`src/log.js`), no new deps.
- Instrument `runAgent` for start/duration/exit/timeout/spawn-failure + streamed output.
- Instrument opencode internally to emit per-op durations; Brick relays them as `run.op`
  entries and aggregates into the terminal event (FR-010/FR-011).
- Route bridge/boot/health logs through the logger with context; add health-flip and
  queue markers.
- Keep all existing behavior and timeout unchanged; log capture stays host-side.
- Validate locally with a stub `opencode` override across success/fail/timeout, then
  deploy.
