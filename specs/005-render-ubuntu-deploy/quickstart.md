> **[LEGACY/ARCHIVED] — historical spec for a retired host path, superseded by the EC2 single-box native deploy (`deploy/ec2-single-box/` + `deploy/README.md`). Kept as audit history — do not follow. Region is `ap-south-1`, host is a 1GB+2GB-swap `t3.micro`.**

# Quickstart: Render Ubuntu Cloud Deployment — Validation Guide

**Feature**: `005-render-ubuntu-deploy` | **Date**: 2026-08-03

Purpose: validate the Ubuntu-based Docker image builds, boots, and serves the bot (text + voice) the
same way locally, then confirm the Render deployment. Manual acceptance suffices per the constitution.

## Prerequisites

- Docker (for a local build test).
- A GitHub repo with `deploy/discord-agent/` (this repo, already pushed).
- Render account; secrets: `DISCORD_BOT_TOKEN`, `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`, plus an LLM
  provider key (`OPENROUTER_API_KEY`).

## 1. Build the image locally (FR-002, SC-003)

```text
cd deploy/discord-agent
docker build --platform=linux/amd64 -t brick-life-os .
```

**Expected**: build succeeds; no secrets in the image, no `ffmpeg/whisper/opencode` missing.

## 2. Inspect the image provides the runtime (FR-008)

```text
docker run --rm --platform=linux/amd64 --entrypoint sh brick-life-os -c \
  "node --version && opencode --version && whisper-cli --help >/dev/null 2>&1 && echo whisper-ok && \
   node -e \"console.log(require('ffmpeg-static'))\" && ls -la /app/models/ggml-tiny.en.bin"
```

**Expected**: node ≥22, opencode version, `whisper-ok`, a ffmpeg path, and the tiny model present.

## 3. Boot the container (typied + voice, FR-001/003/004)

Run the container locally with your `.env` values injected as env vars; confirm:
- `/health` returns 200 on `$PORT`.
- Sending a **text** message → agent reply in-channel.
- Sending a **voice** message → Whisper transcribes (log shows transcript) → agent reply in-channel; or a
  friendly `no-speech`/`error` reply — never a crash.

```text
docker run --rm -p 10000:10000 --env-file .env -e WHISPER_MODEL=/app/models/ggml-tiny.en.bin brick-life-os
```

**Expected**: bot online in Discord; both message types answered.

## 4. Deploy to Render (FR-001, SC-001/002/004)

1. Ensure `Dockerfile` + `render.yaml` are committed and pushed.
2. Render → New Web Service → connect the repo → runtime `docker`, deploy root = repo root (blueprint
   auto-detects `render.yaml`).
3. Add the **secret** env vars in the Dashboard (never committed).
4. Deploy; Render builds the amd64 image and starts the service.
5. Confirm `/health` returns 200; bot appears online in Discord.

**Expected**: after build, typed + voice messages are answered in-channel; a redeploy/restart recovers to
the same working state (SC-004).

## 5. Free-tier keep-alive + limitations (documented)

- Add an **external pinger** (e.g., UptimeRobot) hitting the public `/health` URL every <15 min.
- Understand: on free tier the bot may sleep when idle (Discord gateway is outbound); guaranteed 24/7 and
  near-realtime transcription require a paid/starter plan. This is documented, not a defect.

## Related contracts

- Deployment contract: `contracts/deploy-contract.md`
- Runtime config/entities: `data-model.md`
