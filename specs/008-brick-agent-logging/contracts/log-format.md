# Contracts: Brick Agent Log Output

**Feature**: [spec.md](../spec.md) | **Date**: 2026-08-04

This project has no external API surface — it is a daemon. Its only observable
"interface" is the **log output** written to stdout/stderr and captured by the host.
That log line format is the contract operators rely on, so it is specified here.

## NDJSON log format

Each entry is one JSON object per line. Envelope:

```json
{"ts":"2026-08-04T09:39:00.000Z","level":"info","event":"run.done","ctx":{"service":"agent","channelId":"123","run":"1"},"msg":"Agent run finished","durationMs":8123,"outcome":"success","exitCode":0,"signal":null,"outBytes":2048,"errBytes":0}
```

### Fields

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `ts` | string (ISO-8601 UTC) | yes | entry timestamp |
| `level` | `info`\|`warn`\|`error` | yes | severity |
| `event` | string | yes | stable machine name |
| `ctx` | object | yes | correlation context |
| `msg` | string | yes | human-readable summary |
| *others* | varies | per event | event-specific fields (see data-model) |

## Event contract (guaranteed per run)

- Exactly **one** start event: `run.start` (includes ctx + start clock).
- Zero or more `run.chunk` events during execution (each with `durationMs`).
- Zero or more `run.op` events (per-operation timing) during execution, each with
  `op` (name/type), `durationMs`, `status`.
- Exactly **one** terminal event:
  - `run.done` — `outcome:"success"` (+ `exitCode:0`, `durationMs`, `outBytes`, `errBytes`); or `outcome:"empty"` when exit 0 but no text.
  - `run.timeout` — includes `timeoutMs`, `durationMs`, bounded `capturedOut`/`capturedErr`.
  - `run.failed` — includes `reason` (spawn error / non-zero exit) and bounded output.
- No terminal event before the process actually ended (no log-then-unexpected-success).

## Runtime event names

`boot.config`, `boot.health-listening`, `bridge.ready`, `bridge.login-failed`,
`health.flip`, `msg.queued`, `run.op` (per-operation timing within a run).

## Constraints

- `level:"error"` must accompany `event:"run.failed"` and `bridge.login-failed`.
- `log`/`stderr` are reserved — a message body can never go to a field named `msg`; the
  user-facing reply text is logged as a `msg`-level summary only, never full payload, to
  protect PII (FR-007).
- Newline characters in any value are escaped (single-line NDJSON invariant).
