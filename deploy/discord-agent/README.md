# Life OS Agent on Discord

Deploys the **Life OS agent** (the `001` opencode agent with its skills and
Jira MCP) as a **Discord surface** on Render, driven from this GitHub repo. You
send any agent command as a plain channel message (typed or voice-dictated) and
the agent replies in that same channel with Jira-backed analysis.

It does **not** reimplement the agent — it bundles and runs the real agent
headless (`opencode serve`) plus a thin `discord.js` gateway bridge.

## How it works

```
Discord message ──► bridge (discord.js) ──► opencode serve (headless agent)
                                               ├── skills (capture, daily, weekly-groom, research)
                                               └── Jira MCP (atlassian) ──► Jira
agent reply ◄── bridge posts reply to same channel ◄─── agent
```

- Plain messages only; no slash commands required (v1).
- `GET /health` reports agent + bridge readiness.
- Multi-second agent turns are fine — Discord gateway replies have no 3-second deadline.
- Per-channel serialization keeps replies from interleaving on burst traffic.

## Local run

Prereqs: Node 20+, `opencode` CLI on PATH, a Discord app (Bot) with the
`MESSAGE_CONTENT` privileged intent and added to your server, Jira MCP creds,
and an LLM provider key.

```text
npm install
cp .env.example .env     # fill DISCORD_BOT_TOKEN, JIRA_*, and the LLM key
./run.sh
```

`run.sh` renders `agent/opencode.json` from env (never baked), starts
`opencode serve` on :4096, then starts the bridge + `/health`.

## Voice messages (local transcription)

Voice messages (audio, no typed text) are transcribed locally and forwarded to
the agent like text. **Local-only in this feature**: the shared/deployed image
does not include whisper yet — deployed voice transcription is a separate later
feature.

Setup (once, local):

```text
npm install ffmpeg-static      # Opus -> WAV conversion
brew install whisper-cpp       # whisper-cli binary
node scripts/download-whisper-model.mjs   # -> models/ggml-base.en.bin
```

Validate offline (no Discord needed):

```text
EXPECT_TRANSCRIPT="voice transcription" node scripts/transcribe-local.mjs fixtures/test.opus
```

Optional env overrides (see `.env.example`): `WHISPER_BIN`, `WHISPER_MODEL`,
`WHISPER_TIMEOUT_MS`. If they're unset the bridge falls back to defaults
(`whisper-cli`, `./models/ggml-base.en.bin`, 120 s) and still boots.

## Deploy to Render (via GitHub)

1. Push this repo (deploy root = this `deploy/discord-agent/` dir) to GitHub.
2. Render → New Web Service → connect the repo → auto-detect the `Dockerfile`
   (or use `render.yaml`).
3. Add these **secrets** in the Render dashboard (never committed):
   - `DISCORD_BOT_TOKEN`
   - `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`
   - `ANTHROPIC_API_KEY` (or `OPENROUTER_API_KEY`)
   - Health check path: `/health`
4. In the Discord Developer Portal, enable the `MESSAGE_CONTENT` privileged
   intent for the bot so it can read message content.

## Command set (all `001` agent commands work)

- **capture**: "add to backlog: X"
- **daily**: "today" / "brief" / "what next", "done KEY-42", "practice X"
- **weekly-groom**: "run weekly"
- **research**: "research KEY-42"

## Out of v1 scope (deferred)

- Cold-start mitigation (free tier may show a slow first reply after idle).
- In-flight session recovery.
- Slash-command interactions and health/uptime observability beyond the basic
  `/health` used by Render.

## Security

- All secrets are host environment variables; nothing is baked into the image
  or committed. `agent/opencode.json` is rendered at boot from env (FR-007).
- `.dockerignore` / `.gitignore` exclude `.env`, `node_modules`, and generated
  `agent/opencode.json` / `agent/auth.json`.
