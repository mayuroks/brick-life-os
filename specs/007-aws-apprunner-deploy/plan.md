> **[LEGACY/ARCHIVED] — historical spec for a retired host path, superseded by the EC2 single-box native deploy (`deploy/ec2-single-box/` + `deploy/README.md`). Kept as audit history — do not follow. Region is `ap-south-1`, host is a 1GB+2GB-swap `t3.micro`.**

# Implementation Plan: AWS Deployment (Text-First, ECS Fargate)

**Branch**: `007-aws-apprunner-deploy` | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-aws-apprunner-deploy/spec.md`

## Summary

Move the Discord agent off the failing Render host and onto **AWS**, with automatic
deploys from GitHub Actions and **text-only mode** so plain text messaging works
reliably as the first milestone. The container image already builds from
`deploy/discord-agent/`.

**Host decision (research + implemented):** App Runner is closed to new customers,
so the deployed host is **Amazon ECS Fargate** (standard Fargate service: cluster
`discord-agent`, task def revision 2, ECR image, SSM secrets, CloudWatch logs). The
`.github/workflows/deploy-aws.yml` targets this ECS infrastructure with OIDC auth.

Voice transcription is deferred to an external service follow-up. Static AWS CLI
admin keys are retained while iterating on setup and should be deleted once the OIDC
auto-deploy path is stable (per clarified spec).

## Technical Context

**Language/Version**: Node.js 24 (glibc) on Ubuntu 26.04 amd64 container; existing `deploy/discord-agent` package (ESM).

**Primary Dependencies**: `discord.js` (gateway bridge), `express` (health endpoint), headless `opencode` agent (subprocess), Amazon ECR (image registry), Amazon ECS Fargate (host), GitHub Actions (CI).

**Storage**: None — no persistent DB in scope. Runtime config comes from env vars; long-lived secrets live in AWS SSM Parameter Store (referenced by the ECS task definition), not the repo.

**Testing**: Constitution allows tests only where they save rework (prototype pragmatism). Primary validation is a runnable end-to-end boot + deploy check (see `quickstart.md`). Node built-in `node --check` for syntax.

**Target Platform**: Linux (amd64) — Amazon ECS Fargate (256 CPU / 512MB, task `discord-agent`); GitHub Actions `ubuntu-latest` runner.

**Project Type**: Deployable web-service/daemon (Discord bot bridge + headless agent).

**Performance Goals**: Plain text message → substantive reply within a few seconds under normal load (SC-002); 100% of text messages answered (SC-001).

**Constraints**: Fargate 256 CPU / 512MB; no long-lived credentials committed (FR-005 — static CLI keys kept locally only while iterating, never in repo/image); text-only default so no whisper model/CPU on the host (FR-004); must stay responsive under brief CPU saturation; service kept at desiredCount=1 so the long-running Discord websocket is never stopped. AWS account must be fully activated.

**Scale/Scope**: Single-user personal agent instance; one Discord bot; single AWS region. Multi-region/backup out of scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ **I. Jira SSOT** — Infrastructure/deployment change; no new user commitment is hidden. The deploy target is a hosting concern, not a personal goal; no Jira issue required for infra config, but any follow-up feature (voice) is tracked in Jira as per the workflow.
- ✅ **II. Agent Is the Interface** — The difficult-coach persona and agent behavior are unchanged; this feature only changes *where* it runs. No re-hiding or deletion behavior introduced.
- ✅ **IV. Prototype Pragmatism** — Smallest working thing: text-first on ECS Fargate, defer voice. Aligns directly. Static CLI keys kept while iterating (documented), deleted once OIDC is stable.
- ✅ **V. Sub-Agent Delegation** — AWS CLI install, credential config, and live deploy/verify are delegated to sub-agents (max 3) rather than run in the primary loop (per constitution V).

No gate violations.

## Project Structure

### Documentation (this feature)

```text
specs/007-aws-apprunner-deploy/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
.github/workflows/        # CI/CD
└── deploy-aws.yml        # build → ECR → ECS Fargate (OIDC, text-only)

deploy/discord-agent/     # the deployable unit
├── Dockerfile            # Ubuntu 26.04 amd64 + Node 24 + opencode + whisper-cli
├── run.sh                # supervisor: bake config → start opencode serve → bridge
├── render.yaml           # legacy Render blueprint (retired; kept for reference)
├── .env.example          # documents all env incl. DISABLE_VOICE
├── src/
│   ├── config.js         # runtime config + DISABLE_VOICE flag
│   ├── index.js          # boot: health + bridge
│   ├── health.js         # /health readiness (FR-009)
│   ├── agent/client.js   # runAgent: opencode run --attach
│   ├── bridge/client.js  # Discord gateway; text-only voice notice
│   ├── bridge/queue.js   # per-channel serialization
│   └── transcribe/transcribe.js  # whisper path (skipped in text-only mode)
└── scripts/              # bootstrap, model download, local transcribe
```

**Structure Decision**: Reuse the existing single-package layout under `deploy/discord-agent/`;
add the CI workflow at repo root `.github/workflows/`. No new runtime source structure needed.

## Complexity Tracking

> None — no constitution violations; single deployable already exists, so no added
> architectural complexity to justify.
