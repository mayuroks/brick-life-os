## Why

The Groq STT voice-transcription path is fully wired in code (`config.js` reads `env.GROQ_API_KEY`, lazily validated at first voice note), but the key is never actually provisioned: the live `deploy/discord-agent/.env` does not set `GROQ_API_KEY`, and the EC2 deploy does not provide a way to rotate a token on the box without redeploying all code (and does not restart the service when `.env` changes). The result is that voice notes always fail with "Missing GROQ_API_KEY", and token updates cannot reach the box cleanly.

## What Changes

- Add `GROQ_API_KEY` to the app's `.env` (sourced from the environment via `dotenv`, matching the existing `OPENROUTER_API_KEY` pattern) so the Groq token is taken from `.env`.
- Add a **lean secrets-only update path** for the EC2 box: push just the `.env` (secrets) and restart the `discord-agent` systemd service, so rotating a token does not require re-rsyncing all code.
- Make the full `deploy.sh` reliably apply `.env`/token changes by restarting the service when the pushed secrets change (currently `systemctl enable --now` does not restart an already-running service).
- Enable voice on the box by removing the dead `DISABLE_VOICE=1` environment var (not honored anywhere in code) from the systemd unit.
- Document (in code/scripts) that the Groq key source is the environment (`.env`).
- Verify locally via Docker (smoke: build the image, boot with `.env`, confirm `GROQ_API_KEY` is present and visible to the process) before the user-authorized cloud deploy.

## Capabilities

### New Capabilities
- `deploy/ec2-secrets`: How the EC2 box receives and updates runtime secrets (incl. `GROQ_API_KEY` from `.env`), the secrets-only refresh path that restarts the service, and removal of the dead `DISABLE_VOICE` guard so voice is enabled on the box.

### Modified Capabilities
- `voice/groq-stt`: Clarify that the transcription provider's API key is sourced from the environment (`.env`), so the "Validate provider configuration" requirement is explicit that provisioning the key is a deployment responsibility.

## Impact

- **Code (config surface)**: `deploy/discord-agent/.env` gains `GROQ_API_KEY`; `.env.example` already documents it. No change to `config.js`/`groq.js` (they already read `env.GROQ_API_KEY`).
- **EC2 deploy**: `deploy/ec2-single-box/deploy.sh` + `setup-app-remote.sh` — add a secrets-only refresh path (push `.env` + `systemctl restart`) and ensure full deploys restart the service; drop `DISABLE_VOICE=1` from the systemd unit.
- **Local validation**: Docker build + boot of `deploy/discord-agent` to confirm the Groq key is loaded.
- **Not affected**: ECS Fargate task-def / Render paths (legacy; use SSM / dashboard secrets). Agent LLM (OpenRouter) path unchanged. No audio on host (SC-001/SC-005) unchanged.
