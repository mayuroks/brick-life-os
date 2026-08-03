# Contract: Docker Deployment (Render)

**Feature**: `005-render-ubuntu-deploy` | **Date**: 2026-08-03

Contract between the repo and the Render deployment (the build + runtime contract). The application
code is unchanged; this governs the container and platform wiring.

## Dockerfile contract (deploy/discord-agent/Dockerfile)

The image MUST provide, at minimum, the following commands/paths:

| Requirement | Path / Command | Notes |
|-------------|----------------|-------|
| Base OS | `FROM ubuntu:26.04` with `--platform=linux/amd64` | glibc; amd64 only |
| Node 24 | `node --version` (≥ 22) | via NodeSource apt |
| npm deps | `npm ci --omit=dev` with scripts ENABLED | postinstall must run so `ffmpeg-static` binary downloads |
| ffmpeg binary | `node -e "require('ffmpeg-static')"` resolves | amd64 glibc static binary |
| opencode CLI | `opencode --version` on PATH | /usr/local/bin via official installer; needs `git` + `ca-certificates` |
| whisper-cli | `whisper-cli --help` | apt `whisper.cpp` → /usr/bin/whisper-cli |
| model | `/app/models/ggml-tiny.en.bin` exists | baked at build |
| app dir | `/app` | copies `run.sh`, `src/`, `scripts/`, `agent/` |
| start | `CMD ["./run.sh"]` | renders opencode.json, starts opencode serve + bridge |

**Rules**
- No secrets may be baked (build args/COPY of `.env` forbidden).
- public port bound to `$PORT` (Render default 10000); opencode serve on `127.0.0.1:4096` (loopback).
- Do NOT listen on reserved ports 18012/18013/19099.

## Render blueprint contract (render.yaml)

```yaml
services:
  - type: web
    name: discord-agent
    runtime: docker
    plan: free            # 512 MB / 0.1 CPU (amd64)
    dockerfilePath: ./Dockerfile   # or auto-detect at deploy root
    healthCheckPath: /health
    envVars:
      - key: DISCORD_BOT_TOKEN          # secret
      - key: JIRA_URL                   # secret
      - key: JIRA_USERNAME              # secret
      - key: JIRA_API_TOKEN             # secret
      - key: OPENROUTER_API_KEY         # secret
      - key: WHISPER_MODEL              # value: /app/models/ggml-tiny.en.bin
```

`/health` returns 2xx within 5s (existing `src/health.js`).

## Runtime contract (unchanged app surface)

- Text message → same-channel agent reply.
- Voice message → `isVoiceMessage` → `transcribeVoiceMessage` (uses `WHISPER_MODEL`) → agent reply; or
  friendly `no-speech`/`error` reply (never crashes).

## Known platform limitations (documented, not resolvable in code)

- Free tier sleeps after 15 min idle (Discord gateway is outbound — does not count as inbound). Needs an
  external pinger (<15 min) to stay warm; guaranteed 24/7 requires a paid/starter plan.
- 0.1 CPU makes server-side transcription slower than local; a paid plan restores near-realtime.
- No persistent disk on free tier; no persistent state to depend on.
