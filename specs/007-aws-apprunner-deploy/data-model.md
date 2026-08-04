# Data Model: AWS App Runner Deployment (Text-First)

**Feature**: `007-aws-apprunner-deploy` | **Date**: 2026-08-04

The deployment is stateless — no persistent storage is introduced (matching the
existing ephemeral-filesystem and prototype-pragmatism constraints). The feature's
"data" is the runtime configuration contract in `src/config.js` (env vars read at
boot) plus the readiness state already surfaced by the health endpoint. This model
documents the configuration surface the deployment must satisfy.

## Entity: Runtime configuration (deployable service)

Read once at boot from environment variables (`src/config.js`). All required secrets
come from the host's secret store (FR-005/FR-006), never the repo.

| Field | Env var | Required | Values / Default | Meaning |
|-------|---------|----------|------------------|---------|
| Discord token | `DISCORD_BOT_TOKEN` | yes | secret | Bot token used to connect to the Discord gateway (FR-001). |
| Project-data access | `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN` | yes | secret | Credentials for the project data backend used by the agent. |
| Model provider key | `OPENROUTER_API_KEY` (or `ANTHROPIC_`/`OPENAI_`) | yes | secret | LLM provider key the headless agent uses to reply (FR-003). |
| Agent model | `AGENT_MODEL` | no | `openrouter/deepseek/deepseek-v4-flash-0731` | Model id the agent runs on, injected into its config at boot. |
| Text-only flag | `DISABLE_VOICE` | no | `0` (voice) / `1` (text-only) | `1` disables whisper: voice notes get a friendly notice and are not transcribed (FR-004). |
| Health port | `PORT` | no | `3000` | Port the `/health` endpoint listens on; host maps its public port here. |
| Agent serve URL | `OPENCODE_SERVE_URL` | no | `http://127.0.0.1:4096` | URL of the headless agent the bridge calls. |
| Whisper binary path | `WHISPER_BIN` | no | `whisper-cli` | Only used when voice enabled; inert in text-only mode (FR-008). |
| Whisper model path | `WHISPER_MODEL` | no | `./models/ggml-base.en.bin` | Only used when voice enabled; inert in text-only mode. |
| Whisper timeout | `WHISPER_TIMEOUT_MS` | no | `120000` | Only used when voice enabled. |

### Validation rules

- **Fail fast at boot** (FR-006): missing `DISCORD_BOT_TOKEN`, any of
  `JIRA_URL/UUID/API_TOKEN`, or all provider keys → boot aborts with a clear missing-list
  error. This is enforced in `src/config.js` line ~23.
- **Text-only determinism** (FR-004): when `DISABLE_VOICE=1`, the bridge must never
  invoke the whisper binary/model — voice input resolves to a notice reply, and text
  messages flow unchanged.

## Entity: Deployment input (CI → registry → host)

Produced by the CI runner on each change, consumed by the host service.

| Field | Type | Meaning |
|-------|------|---------|
| Container image | immutable Docker image | Built from `deploy/discord-agent/Dockerfile`, tagged with commit SHA, pushed to the private registry. |
| Image tag | `${{ github.sha }}` | Unique per commit so each deployment is traceable to its source. |
| Runtime env (text-only) | map<string,string> | `DISABLE_VOICE=1`, `PORT=3000` set at service creation/update; secrets injected from the host's secret store. |

### Validation rules
- Image must build for `linux/amd64` (FR-002/FR-005).
- Registry must be private and CI-authenticated via short-lived OIDC credentials
  (FR-005) — no long-lived keys in repo.

## State transitions (deploy lifecycle)

- **Boot**: config validated → opencode serve starts → bridge connects → `/health` is
  healthy.
- **Rollout**: new image pushed → host service updated → previous healthy revision
  keeps serving until the new one is healthy (FR-007).
- **Failed rollout**: surfaced as a failed pipeline/operation; previous version is not
  silently taken down (FR-007).
- **Missing secret at boot**: graceful fail-fast error; service stays down with a clear
  reason rather than appearing online (FR-006).
