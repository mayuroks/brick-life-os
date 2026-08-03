# Agent Handover: Project "Brick" (Discord-Jira Bot POC)

## Voice transcription (added 2026-08-03, feature 004)
* Voice messages (audio, empty text) are now transcribed **locally** with whisper.cpp
  (`brew install whisper-cpp` → `whisper-cli`) + `ffmpeg-static`, then forwarded to the agent.
* **Local-only**: the deployed Render image does not include whisper yet — deployed STT is a separate,
  later feature. Local setup + offline validation: see `deploy/discord-agent/README.md` ("Voice messages").
* Key files: `src/transcribe/transcribe.js` (pipeline: download → Opus→16k mono WAV → whisper, silence
  gate + graceful no-speech/error), `src/bridge/client.js` (voice detection via `MessageFlags.IsVoiceMessage`),
  `scripts/transcribe-local.mjs` (offline harness), `scripts/download-whisper-model.mjs` (model fetch).
* Optional env: `WHISPER_BIN`, `WHISPER_MODEL`, `WHISPER_TIMEOUT_MS` (all have defaults; bot boots without them).

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
