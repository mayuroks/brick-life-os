> **[LEGACY/ARCHIVED] — historical spec for a retired host path, superseded by the EC2 single-box native deploy (`deploy/ec2-single-box/` + `deploy/README.md`). Kept as audit history — do not follow. Region is `ap-south-1`, host is a 1GB+2GB-swap `t3.micro`.**

# Implementation Plan: Render Ubuntu Cloud Deployment

**Branch**: `005-render-ubuntu-deploy` | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-render-ubuntu-deploy/spec.md`

## Summary

Ship the `deploy/discord-agent` bot to Render as a Docker web service built from an **Ubuntu 26.04 LTS**
(amd64) image, with **cloud voice transcription** now included (whisper-cli + ffmpeg + model in the
image). This replaces the old `node:20-alpine` Dockerfile (whose musl base is incompatible with the
whisper/ffmpeg binaries). Deliverables: a new `Dockerfile`, updated `render.yaml`, a model-download
step at build, and the supporting docs — sized to fit Render's free tier (512 MB RAM, amd64).

## Technical Context

**Language/Version**: Node.js 24 LTS (via NodeSource) on Ubuntu 26.04 LTS; existing app is ESM Node 20+.

**Primary Dependencies**:
- Ubuntu 26.04 base (glibc) — user's explicit choice; amd64 pinned.
- `whisper.cpp` apt package → `/usr/bin/whisper-cli` (prebuilt amd64, no compile).
- `ffmpeg-static` (npm) — reused; its postinstall downloads the amd64 glibc binary.
- opencode CLI — official install script → `/usr/local/bin`.
- Model: `ggml-tiny.en.bin` (~75 MB) baked at build, referenced by `WHISPER_MODEL` env.

**Storage**: N/A (no persistent disk on free tier). Model is baked into the image; temp audio cleaned up.

**Testing**: Manual acceptance per constitution (deploy → text reply, voice reply, secrets absent, restart
recovery). No new automated tests.

**Target Platform**: Render Docker web service, linux/amd64, `plan: free` (512 MB / 0.1 CPU).

**Project Type**: web-service deployment artifact (Dockerfile + Render blueprint + supporting files).

**Performance Goals**: Voice message transcribed + answered on the deployed bot. On free tier (0.1 CPU)
transcription will be slower than local — a paid plan gives near-realtime; documented as a limitation.

**Constraints**: amd64 only; ≤512 MB RAM (→ tiny.en); secrets only via env; image ≤10 GB; bind express to
`$PORT` (10000) and opencode to `127.0.0.1:4096`; `/health` for Render probes; free tier sleeps after
15 min idle (needs external pinger; paid plan for guaranteed always-on).

**Scale/Scope**: Single hobby deployment of the existing bot. No change to bot behavior beyond making
voice transcription available in the cloud.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Jira SSOT** — Not implicated; bot behavior unchanged (voice input reaches the same agent). ✅
- **II. Agent Is the Interface** — Preserved; voice now works in the cloud too. ✅
- **IV. Prototype Pragmatism (MUST)** — Satisfied: minimal imgpression (apt + npm reuse, no source
  builds, no platform gold-plating). ✅
- **V. Sub-Agent Delegation (MUST)** — Research delegated to 3 parallel sub-agents. During implementation,
  verifying the Docker build / Render constraints MUST be delegated to sub-agents (≤3). ✅
- **Governance / Scope**: New feature beyond v1 — user-requested re-scope (explicit "run this on Render
  now, Ubuntu 26 LTS"), documented here and in the spec. Cloud voice transcription is now IN scope
  (extends the local-only `004`). ✅

No violations; gate passes. Post-design check confirms the same.

## Project Structure

### Documentation (this feature)

```text
specs/005-render-ubuntu-deploy/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md            # later, by /speckit.tasks
```

### Source Code (deploy/discord-agent)

```text
deploy/discord-agent/
├── Dockerfile                 # MODIFY: replace node:20-alpine with ubuntu:26.04 (amd64) multi-purpose runtime
├── render.yaml                # MODIFY: Docker runtime, plan free, add WHISPER_MODEL, healthCheckPath /health
├── .dockerignore              # VERIFY: exclude node_modules, .env, models source, agent runtime
├── .env.example               # MODIFY: document WHISPER_MODEL default for deployment
├── package.json               # UNCHANGED (ffmpeg-static already a dep)
├── run.sh                     # likely UNCHANGED (renders opencode.json, starts opencode serve + bridge)
└── scripts/
    ├── download-whisper-model.mjs  # REUSE in build (downloads model to /app/models)
    └── transcribe-local.mjs        # UNCHANGED (local harness)
```

**Structure Decision**: Honor the existing single-project layout. The deployment change is confined to
the `Dockerfile` + `render.yaml`; application code under `src/` is untouched. Model is placed at
`/app/models/ggml-tiny.en.bin` and referenced by `WHISPER_MODEL` (default in `src/config.js` stays
`ggml-base.en.bin` for local runs; deployment overrides to `tiny.en` via env).

## Complexity Tracking

> No constitution violations requiring justification. The only override is the user-requested re-scope
> to Ubuntu + Render deployment, already documented above.
