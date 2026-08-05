# Implementation Plan: Discord Agent — Latency & Reuse

**Branch**: `010-agent-latency-reuse` | **Date**: 2026-08-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-agent-latency-reuse/spec.md`

## Summary

The Discord agent currently spawns a **fresh `opencode run` per message**
(`deploy/discord-agent/src/agent/client.js`), re-doing cold boot + the throwaway
session-naming call (~20s) + Jira MCP reconnect + teardown each turn ≈ **40s per
message**, on a warm `opencode serve` that is never used. The plan moves the bot
from ~40s to ~15-20s via:

1. A **global single-slot in-memory queue** — one agent turn in flight across all
   channels, structurally preventing OOM on the ~1GB free-tier host (FR-002, SC-002).
2. **Disabling the throwaway session-naming call** — a guaranteed ~20s win, independent
   of everything else (FR-004, SC-001).
3. **Warm-serve reuse (green-but-blank)** — reusing the :4096 serve so boot/config/Jira
   stay hot while each message still gets a fresh, empty context (FR-005), **gated on
   verifying** the reported "empty replies with `--attach`" condition (FR-008).
4. **Reclaim AWS spend to $0** — audit and stop running billable ECS/EC2 resources,
   keep only the minimal free-tier host (FR-007, SC-004).

Locked design decisions from the grilling ADR: truly stateless per message; one-at-a-time
global processing; kill auto-title regardless; serve-reuse only if verified; hard $0/mo;
horizontal (not vertical) scope.

## Technical Context

**Language/Version**: Node.js 24 (ESM), on `node:24-slim` glibc container (existing
`deploy/discord-agent` package).

**Primary Dependencies**: `discord.js` (gateway bridge), `express` (health endpoint),
headless `opencode` CLI (subprocess), `uvx mcp-atlassian` (Jira MCP — uv tool cache
pre-warmed in the image).

**Storage**: None new. The wait queue is an **in-memory array** (ephemeral, lost on
process restart). Jira remains the persistent single source of truth (external).

**Testing**: Constitution permits tests only where they save rework. Existing:
`node --check` for syntax; manual/e2e acceptance (per 007 quickstart). No test runner
is installed. Queue behavior is verifiable via a small Node assertion or manual burst
test — decide in Phase 0.

**Target Platform**: Linux (amd64) — Amazon ECS Fargate (see task-def.json); GitHub
Actions deploy pipeline from spec 007.

**Project Type**: Deployable web-service/daemon (Discord bot bridge + headless agent).

**Performance Goals**: Send-to-reply of a common command drops from ~40s to at most
~20s (SC-001). p50 measured after Steps 2-4; no vertical/scale engineering.

**Constraints**: Free-tier host (~512MB-1GB memory / ~0.5 vCPU); hard $0/mo (no billable
services — AGENTS.md); exactly one agent turn in flight (FR-002); no conversation
carried between messages (FR-003); host keeps `desiredCount=1` so the Discord websocket
is never stopped; text-only.

**Scale/Scope**: Single-user personal bot; horizontal coverage of the 4 existing
surfaces (capture, daily, weekly-groom, research). Worst-case burst = ~10 messages.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Rationale |
|-----------|--------|-----------|
| I. Jira is SSOT | PASS | No local persistence added; Jira remains the only keeper of commitments. Stateless turns rebuild from Jira. |
| II. Agent is the interface | PASS | Persona and surface command set unchanged; only transport latency is optimized. |
| III. Fear + streaks + metrics | PASS | No deliverable metrics changed; latency is an infra concern. |
| IV. Prototype pragmatism (MUST) | PASS | Smallest working thing: queue refactor + title-off are low-risk; serve-reuse is gated, not gold-plated. |
| V. Sub-agent delegation (MUST) | PASS | Verification/install/test work (serve-API spike, repro, e2e) is delegated to sub-agents; primary agent doesn't block on long loops. |
| AGENTS.md no-billable | PASS | Feature explicitly routes to free-tier and reclaims existing spend; no new paid infra. |

**No gate violations.** Horizontal scope, no vertical depth.

## Project Structure

### Documentation (this feature)

```text
specs/010-agent-latency-reuse/
├── spec.md              # Feature spec (/speckit.specify)
├── plan.md              # This file (/speckit.plan)
├── adr.md               # Grilling decision record
├── glossary.md          # Domain terms
├── research.md          # Phase 0 output — incl. serve-API verification & title-off mechanism
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output — validation guide
├── contracts/           # Phase 1 output
│   └── latency-contract.md
└── tasks.md             # Phase 2 output (/speckit.tasks - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
deploy/discord-agent/
├── src/
│   ├── index.js        # boot + health + bridge (unchanged entry)
│   ├── bridge/
│   │   ├── client.js   # message handler — swap channel chain for global single-slot
│   │   └── queue.js    # ChannelQueue → global single-slot FIFO (array + one worker)
│   └── agent/
│       ├── client.js   # runAgent — kill auto-title; optionally attach to warm serve
│       └── ops.js
├── agent/
│   ├── opencode.json   # model + Jira MCP config (injected at boot)
│   └── AGENTS.md       # persona + skills
├── scripts/bootstrap.js
├── run.sh              # supervisor: serves agent on :4096 + starts bridge
└── test/
    └── stub/           # placeholder; verify queue with a small assertion here if kept
```

**Structure Decision**: Single existing Node project (`deploy/discord-agent`). No new
packages/projects — the two touched files are `src/bridge/queue.js` and
`src/agent/client.js`, with `src/bridge/client.js` wiring. Keeps the horizontal,
smallest-change shape.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally empty.
