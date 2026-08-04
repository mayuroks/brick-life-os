# Implementation Plan: Brick Agent Run Logging

**Branch**: `008-brick-agent-logging` | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-brick-agent-logging/spec.md`

## Summary

Instrument the Brick Discord agent (`deploy/discord-agent`) with a small structured
logging layer so every agent run and runtime event is observable. Today a cloud run
that fails or times out only produces the generic *"The agent took too long. It may be
offline or Jira is unreachable — try again."* — with no trail of what happened. This
feature adds run-level diagnostics (start/duration/exit outcome, streamed output on
timeout, spawn/exit failure details) and routes all lifecycle events through one
consistent, structured log. It also breaks each run down into per-operation timings
(FR-010/FR-011): model calls, Jira API calls, and other tool calls each log their own
duration, and those durations reconcile to the run total — so a slow run can be traced to
the specific slow operation. Logging is validated locally first, then deployed.

No behavior shown to Discord users and no timeout value change; purely additive
observability.

## Technical Context

**Language/Version**: Node.js ≥20 (ESM); existing `deploy/discord-agent` package.

**Primary Dependencies**: `discord.js` (gateway bridge), `express` (health), headless `opencode` agent (spawned subprocess). Logging uses Node's built-in `console`/`util` — no new runtime dependency. Per-operation timing (FR-010) is sourced from opencode's own per-tool / per-model-call events; Brick relays them as `run.op` entries and aggregates into the terminal event (no new dep).

**Storage**: None — logs are streamed to stdout (captured by the cloud host, e.g. CloudWatch on ECS Fargate). No persistent DB.

**Testing**: `node --check` for syntax; local end-to-end validation runs (see `quickstart.md`) prove the instrumented `runAgent` and bridge log correctly for success, fast-fail, timeout, and per-operation timing. No unit test framework added (prototype pragmatism).

**Target Platform**: Linux container (ECS Fargate) + local macOS/dev for validation.

**Project Type**: Node.js daemon (Discord bot bridge + headless agent subprocess).

**Performance Goals**: Logging overhead negligible — a few structured lines per run; must not materially extend run latency.

**Constraints**: No secret/PII in logs (FR-007); same structured format everywhere (FR-009); Discord-facing messages and timeout unchanged; must run identically locally and in the container.

**Scale/Scope**: Single-user, one bot instance; a few runs per day. Multi-instance/aggregation out of scope — logs are per-process stdout.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ **I. Jira SSOT** — Observability tooling, no new user commitment hidden; nothing to file.
- ✅ **II. Agent Is the Interface** — Persona, behavior, and user-facing replies unchanged; only adds diagnostics. No re-hiding/deletion introduced.
- ✅ **IV. Prototype Pragmatism** — Minimal logging layer, no new deps, shared structured logger across existing files, rely on host log capture. Aligns directly.
- ✅ **V. Sub-Agent Delegation** — Local run/verify of the instrumented agent is delegated to sub-agents (≤3) rather than run in the primary loop.

_GATE restriction note:_ this feature only *adds* logging; it does not change the existing timeout or any failure/reply behavior, so no config/behavior gate is affected.

No gate violations.

## Project Structure

### Documentation (this feature)

```text
specs/008-brick-agent-logging/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
deploy/discord-agent/        # existing single deployable; instrumentation added in place
├── src/
│   ├── config.js            # unchanged (adds optional LOG_LEVEL later if needed)
│   ├── index.js             # boot: health + bridge — route boot logs through logger
│   ├── health.js            # /health readiness — log state flips via logger
│   ├── log.js               # NEW: tiny structured logger (level, timestamp, ctx, msg)
│   ├── agent/client.js      # runAgent: start/duration/exit/timeout + streamed output logging
│   ├── agent/ops.js         # NEW: capture opencode per-op events → run.op + aggregate (FR-010/11)
│   ├── bridge/client.js     # route existing [discord] logs through logger; run ctx
│   └── bridge/queue.js      # unchanged (enqueue bookkeeping folded into bridge logs)
└── run.sh                   # unchanged — already captures stdout
```

**Structure Decision**: Reuse the existing single-package layout. Add a small
`src/log.js` shared logger, update the existing bridge, agent, health, and boot code to
use it, and add `src/agent/ops.js` to turn opencode's per-tool/per-model events into
`run.op` log entries and the aggregated `ops` list on the terminal event. No new
module/package structure, no new dependencies.

## Complexity Tracking

> Minimal — no constitution violations. The only added piece beyond a shared logger is
> `src/agent/ops.js` (opencode event → `run.op` relay + aggregate), kept to one small
> module rather than a tracing pipeline. No architectural complexity to justify.
