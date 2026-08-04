# Quickstart: Validate Brick Agent Logging Locally

**Feature**: [spec.md](./spec.md) | **Date**: 2026-08-04

Prove, on a local machine, that the instrumented Brick daemon logs diagnostics for
success, fast-fail, and timeout — **before** any cloud deploy (FR-008 / SC-004).
No real LLM or Jira call is required; a stub `opencode` command exercises each path
deterministically.

## Prerequisites

- Node.js ≥20 and the repo checked out.
- `deploy/discord-agent/` has `npm install` run (deps: discord.js, express, dotenv).
- A throwaway `.env` with valid-shaped values (a bot token and provider key do **not**
  need to be live for this test; the stub bypasses the real agent) — see `.env.example`.

## Setup

```bash
cd deploy/discord-agent
node --check src/log.js src/agent/client.js src/bridge/client.js src/index.js src/health.js
```

## Local validation loop (sub-agent runs this per constitution V)

Create a stub `opencode` binary and put it on `PATH` ahead of the real one. The stub
reads args from `$@` and branches on an env var to simulate each outcome:

```bash
# stub: deploy/discord-agent/test/stub/opencode
#!/bin/sh
case "$BRICK_STUB" in
  ok)      sleep 1; echo "Sure, here is the plan.";;
  slow)    sleep 30 ;;                       # exceeds our short test timeout
  fail)    echo "provider error" >&2; exit 1 ;;
  spawn)   exit 127 ;;                       # fast, non-zero
esac
```

For these tests set `OPENCODE_SERVE_URL` to a dummy value and `PATH` so the stub shadows
the real binary. Clear Discord tokens so the test drives `runAgent` directly (see below).

### Test 1 — Success path (`BRICK_STUB=ok`)

Drive `runAgent(fakeServeUrl, 'hello')` (a tiny harness importing `src/agent/client.js`)
**or** temporarily set a short timeout. Expect log lines:

- `run.start` with ctx
- one or more `run.chunk` (the echoed reply)
- `run.done` with `outcome:"success"`, `exitCode:0`, `durationMs>0`

**Pass**: exactly one `run.start` and one `run.done`; a real `durationMs`.

### Test 1b — Per-operation timing (`BRICK_STUB=ops`)

A stub variant that emits structured per-op timing (or, in the live opencode path,
real `run.op` entries). Expect:

- `run.op` entries for each operation with `op`, `durationMs`, `status`
- the terminal `run.done` event carries an aggregated `ops` list whose durations sum to
  the total `durationMs` (FR-011)

**Pass**: at least two `run.op` entries present and their aggregate reconciles to the
recorded total (SC-006/SC-007).

### Test 2 — Timeout path (`BRICK_STUB=slow`, short timeout)

Set the run timeout low (override `TIMEOUT_MS` via a test hook/env) so 30s sleep trips
it. Expect:

- `run.start`
- `run.timeout` with `durationMs < 2000`, `timeoutMs` set, `capturedOut`/`capturedErr`
  present (possibly empty)
- process killed (signal recorded) and **no** later `run.done`/`run.failed`

**Pass**: `run.timeout` appears and is the terminal event; no contradiction later.

### Test 3 — Fast-fail path (`BRICK_STUB=fail`)

Expect `run.failed` with `reason` mentioning the stderr text ("provider error") and the
non-zero exit captured.

**Pass**: `run.failed` is the terminal event and carries the stderr reason (FR-004).

## Verify no PII/secrets leak (FR-007 / SC-005)

Grep the captured logs for any configured token/provider values and any real user text
outside an `msg` summary:

```bash
grep -iE 'DISCORD_BOT_TOKEN|ANTHROPIC_API_KEY|JIRA_API_TOKEN' <logfile>  # must be empty
```

## Expected log format

Each of the above emits the NDJSON envelope defined in
[contracts/log-format.md](./contracts/log-format.md). At minimum assert each line parses
as JSON with `ts`, `level`, `event`, `ctx`, `msg` present.

## After local pass

- Fix any failing case, then move to deploy (feature 007 path reuses the container image,
  which already captures stdout to CloudWatch). Mark SC-002..SC-005 achieved.

## Out of scope for quickstart

Live real-LLM/Jira end-to-end is optional and not required to prove the logger works;
run manually only as a final smoke check on deploy.
