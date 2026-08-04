# Data Model: Brick Agent Run Logging

**Feature**: [spec.md](./spec.md) | **Date**: 2026-08-04

Logging is observational — no persistent data model on the app side. This document
defines the logical shapes the shared logger emits so implementations and validation
share one vocabulary. All entries are newline-delimited JSON objects with the same
envelope; fields are descriptive, not a storage schema.

## Log envelope

```text
{ "ts": <ISO-8601 string>, "level": "info"|"warn"|"error", "event": <string>, "ctx": { ... }, "msg": <string>, ...extra fields }
```

- `ts` — ISO-8601 UTC timestamp of the entry.
- `level` — severity; `error` for failures, `warn` for near-timeout, `info` otherwise.
- `event` — machine-stable event name (e.g. `run.start`, `run.timeout`, `health.flip`).
- `ctx` — stable correlation context (e.g. `{ service:'bridge', channelId, run }`).
- `msg` — human-readable summary line (matches what a user-facing reply might need).
- Additional fields vary by event (durations, byte counts, captured output).

## Entities

### Agent Run

One invocation of the headless agent via `runAgent`. Bijects to one user request.

| Field | Type | Notes / relations |
|-------|------|-------------------|
| id / context | ctx | correlation: `{ service:'agent', channelId, run:<seq> }` |
| startedAt | ts | from `run.start` event |
| durationMs | number | elapsed since run start, at emit time |
| outcome | enum | `success` / `timeout` / `exit-nonzero` / `spawn-error` / `empty` (FR-002/FR-003/FR-004) |
| exitCode | number\|null | from `close` when available |
| signal | string\|null | e.g. `SIGKILL` on timeout kill |
| outBytes / errBytes | number | sizes of captured streams |
| capturedOut / capturedErr | string | bounded output-so-far snapshot on timeout/failure (FR-003) |

**Events**: `run.start`, `run.chunk` (stdout/stderr, FR-005), `run.op` (per-operation
timing, FR-010), `run.done` (FR-002), `run.timeout` (FR-003), `run.failed` (FR-004).

### Operation

A discrete action performed inside an Agent Run (FR-010). Belongs to exactly one run.

| Field | Type | Notes / relations |
|-------|------|-------------------|
| name / type | string | e.g. `model_call`, `jira_api`, `tool` |
| durationMs | number | wall-clock time of the operation |
| status | enum | `ok` / `failed` / `timeout` |
| run (ref) | ctx | the Agent Run it belongs to |

**Events**: `run.op` emitted when an operation completes; counted/aggregated into the
run's terminal event as `ops: [...]` (FR-011).

### Runtime Event

A lifecycle occurrence outside any single agent run, in the same log stream (FR-006).

**Events**: `boot.config` (secrets/load ok), `boot.health-listening`, `bridge.ready`
(login), `health.flip` (agent/bridge up↔down), `msg.queued`, `bridge.login-failed`.

## Validation rules (from FR-001..FR-009)

- Every `run.*` event includes a run correlation id and elapsed time (FR-001/FR-005).
- Every run emits exactly one terminal event (`run.done` | `run.timeout` | `run.failed`)
  (FR-002/FR-003/FR-004).
- `run.timeout` and `run.failed` include reason + bounded output snapshot (FR-003/FR-004).
- Every run that performs operations emits `run.op` entries and its terminal event includes
  the aggregated `ops` list summing to the recorded duration (FR-010/FR-011).
- No field value is ever populated with secrets, tokens, or raw user PII (FR-007).
- Every entry conforms to the shared envelope (FR-009).
