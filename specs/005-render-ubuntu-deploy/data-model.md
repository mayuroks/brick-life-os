# Data Model: Render Ubuntu Cloud Deployment

**Feature**: `005-render-ubuntu-deploy` | **Date**: 2026-08-03

This feature is deployment infrastructure; the entities below describe the runtime configuration and
artifacts that must exist for the service to run. Transient; no persistent storage.

## Entities

### Service Image (Docker image, the deployable)

| Field | Type | Notes |
|-------|------|-------|
| baseOS | string | `ubuntu:26.04` (glibc), pinned `linux/amd64` |
| nodeRuntime | string | Node 24 LTS (installed via NodeSource on the Ubuntu base) |
| whisperCli | path | `/usr/bin/whisper-cli` (apt `whisper.cpp` pkg, amd64) |
| ffmpeg | path | via `ffmpeg-static` npm (amd64 glibc binary) |
| opencodeCli | path | `/usr/local/bin/opencode` (official installer) |
| model | path | `/app/models/ggml-tiny.en.bin` (baked at build, ~75 MB) |

**Validation rules**
- amd64 only (Render). ARM binaries are NOT acceptable.
- Image ≤10 GB; runtime RSS must stay within the 512 MB plan (tiny.en chosen).
- No secrets baked in; secrets come only from the environment at runtime.

### Runtime Config (environment variables)

| Env var | Required | Source | Purpose |
|---------|----------|--------|---------|
| `DISCORD_BOT_TOKEN` | yes | Render secret | Discord gateway login |
| `JIRA_URL` / `JIRA_USERNAME` / `JIRA_API_TOKEN` | yes | Render secret | agent Jira MCP |
| `OPENROUTER_API_KEY` (or ANTHROPIC/OPENAI) | yes | Render secret | LLM provider |
| `PORT` | yes | Render sets (10000) | public port for express `/health` |
| `WHISPER_MODEL` | no | deploy default | `/app/models/ggml-tiny.en.bin` (override for other plans) |
| `OPENCODE_SERVE_URL` | no | default | `http://127.0.0.1:4096` internal loopback |

**Validation rules**
- `loadConfig()` fails fast with clear steps if required secrets are missing (FR-006).
- `WHISPER_MODEL`/timeouts optional with defaults (service still boots without them).

### Health Endpoint (`GET /health`)

| Field | Type | Notes |
|-------|------|-------|
| status | 200 (2xx/3xx) | Render probes; must respond within 5 s |
| body | JSON | agent + bridge readiness (existing `createHealthApp`) |
| host/port | public `$PORT` | single public port; opencode stays on loopback |

### Model Artifact

| Field | Type | Notes |
|-------|------|-------|
| file | `ggml-tiny.en.bin` | baked into image at build (from scripts/download-whisper-model.mjs) |
| size | ~75 MB | fits 512 MB plan (base.en ~388 MB would be too tight) |
| consumed-by | `WHISPER_MODEL` → `src/transcribe/transcribe.js` | whisper-cli `-m` path |

## Relationships

- `Runtime Config` (env) → injected into `Service Image` at container start.
- `Service Image.whisperCli` + `.ffmpeg` + `.model` → used at runtime by the existing
  `src/transcribe/transcribe.js` (unchanged).
- `Health Endpoint` → probed by Render to keep the instance healthy/routable.
- No state persisted across container restarts (free tier has no disk).
