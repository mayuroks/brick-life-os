# Implementation Plan: Speed Up CI Build & Plan

**Branch**: `009-speed-up-ci-build` | **Date**: 2026-08-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-speed-up-ci-build/spec.md`

## Summary

Replace the `ubuntu:26.04` + manual NodeSource Node 24 install in
`deploy/discord-agent/Dockerfile` with a `node:24-slim` base image. This
eliminates the two dominant build steps (`apt-get` tooling install ~10 min and
NodeSource `nodejs` install ~4.5 min), cutting a cold build from ~15 min to
~1 min. GHA Docker layer caching is already configured, so warm builds drop to
seconds once the base-image change is in and the workflow path stops churning.

## Technical Context

**Language/Version**: Docker (Dockerfile); Node.js 24 (runtime provided by `node:24-slim` base)

**Primary Dependencies**: `node:24-slim` base image (replaces `ubuntu:26.04` + NodeSource),
`ghcr.io/astral-sh/uv` (copied binary, unchanged), `opencode` CLI install (unchanged)

**Storage**: N/A (container build configuration; no persistent data)

**Testing**: `docker build` reproducibility; deploy to ECS Fargate is non-reversible, so validation is build-time only

**Target Platform**: linux/amd64 (ECS Fargate), GitHub Actions `ubuntu-latest`

**Project Type**: Infrastructure / container build config

**Performance Goals**: Cold build ≤ 1 min; warm build ≤ 20 s (from ~15 min today)

**Constraints**: Correctness preserved; image must remain glibc + Node 24 + opencode + uv compatible; ECS task definition unchanged

**Scale/Scope**: Single Dockerfile (`deploy/discord-agent/Dockerfile`) + optional workflow touch-up

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **IV Prototype Pragmatism**: PASS — this is the smallest change (one base-image swap) that removes the 95% build bottleneck.
- **V Sub-Agent Delegation**: PASS — verification of the build (`docker build`) is delegated to a sub-agent, not the primary agent.
- **SSOT / anti-invisibility**: PASS — feature tracked as Jira/spec work `009-speed-up-ci-build`, no new commitments in chat only.
- No new services, no scope creep, no gold-plating.

## Project Structure

### Documentation (this feature)

```text
specs/009-speed-up-ci-build/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (N/A — no data entities)
├── quickstart.md        # Phase 1 output (build validation guide)
├── contracts/           # Phase 1 output (N/A — internal build config, no external interface)
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
deploy/discord-agent/
├── Dockerfile           # PRIMARY CHANGE: ubuntu:26.04 → node:24-slim
├── package.json
├── package-lock.json
├── run.sh
└── ... (agent source)

.github/workflows/
└── deploy-aws.yml       # (verify only — cache settings already correct)
```

**Structure Decision**: No new directories. Change is contained to the existing
`deploy/discord-agent/Dockerfile`. Workflow untouched unless build verification
reveals a needed tweak.

## Complexity Tracking

> No constitution violations — skip table.
