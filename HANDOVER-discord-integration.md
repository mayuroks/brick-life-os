# Agent Handover: Project "Brick" (Discord-Jira Bot POC)

## Render Ubuntu 26.04 deployment (added 2026-08-03, feature 005)
* Deploy image rebased from `node:20-alpine` to **`ubuntu:26.04` (amd64)** —
  glibc base so whisper-cli/ffmpeg/opencode all run. Cloud **voice transcription** is now in scope
  (was local-only in 004).
* Image (578 MB, secret-free) installs: `whisper.cpp` (apt `/usr/bin/whisper-cli`), `ffmpeg` (apt) +
  `ffmpeg-static` (npm), Node 24 (NodeSource), opencode via official installer + **symlink to
  /usr/local/bin** (the installer ignores `OPENCODE_INSTALL_DIR` and puts the binary in
  `$HOME/.opencode/bin` — the symlink is REQUIRED or `run.sh` can't start the agent).
* Baked model: `/app/models/ggml-tiny.en.bin` (free-tier 512 MB safe); `WHISPER_MODEL` env override.
* `render.yaml`: runtime docker, plan free, healthCheckPath /health, secrets + WHISPER_MODEL.
* Validated in Docker: build clean, whisper transcribes fixture, agent (`opencode server listening`) +
  bridge (`Bridge logged in as Brick#4254`) boot, /health ok.
* Known: free tier sleeps ~15 min idle (Discord gateway is outbound) → needs external pinger; ~0.1 CPU
  slows transcription; guaranteed 24/7 + near-realtime needs a paid plan. See README "Render free-tier notes".
* Minor (pre-existing, not fixed here): `/health` reports `agent:"up"` even if opencode serve failed
  (hard-coded `true` in `src/index.js`); worth fixing in a later observability feature.

## Voice transcription (local, feature 004)
* Voice messages (audio, empty text) transcribed locally with whisper.cpp + ffmpeg-static then
  forwarded to the agent. Local-only originally; now also available server-side in the 005
  Ubuntu image. Local setup + offline validation: see `deploy/discord-agent/README.md` ("Voice messages").
* Key files: `src/transcribe/transcribe.js`, `src/bridge/client.js`, `scripts/transcribe-local.mjs`.

## Objective
Deploy a 24/7 serverless/cloud-hosted minimal AI bot ("Brick") on Render's free tier, connecting Discord webhooks to OpenRouter for remote querying while traveling.

## Current State & Architecture
* **Stack:** Node.js (Express), Docker, OpenRouter API (Claude 3.5 Sonnet / target model).
* **Components:**
  * `/discord` endpoint: Handles Discord interaction verification and command payloads.
  * `/health` endpoint: Used for external uptime pings to prevent Render free-tier spin-down.
  * System Prompt: Hardcoded persona ("Brick", blunt Jira coach, brick-red theme `#B7410E`, emoji-prefixed responses `🔥 **Brick says:**`).
* **Deployment:** Render Web Service (Docker environment) driven via a GitHub repo.

## Action Items / Next Steps
1. **Repository Setup:** Scaffold `server.js`, `package.json`, and `Dockerfile` locally.
2. **Environment Configuration:** Secure `OPENROUTER_API_KEY`, `JIRA_API_TOKEN`, etc., via Render environment variables (never commit `.env`).
3. **Discord Portal:** Configure Interactions Endpoint URL to point to the live Render deployment URL.
4. **Keep-Alive:** Attach an external cron pinger (e.g., UptimeRobot) to hit `/health` every 10 minutes.
