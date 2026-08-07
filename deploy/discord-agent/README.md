# Life OS Agent on Discord

> **[LEGACY/ARCHIVED] — superseded by the EC2 single-box path (`deploy/ec2-single-box/` + `deploy/README.md`). Do not follow. Region is `ap-south-1`, host is a 1GB+2GB-swap `t3.micro`. The host is **EC2 native** (not Fargate), auth is **IAM keys** (not OIDC), and voice is **Groq STT** (already shipped — no local whisper, no `DISABLE_VOICE`). The "Deploy to Render" section below is dead (Render retired).**

Deploys the **Life OS agent** (the `001` opencode agent with its skills and
Jira MCP) as a **Discord surface**, driven from this GitHub repo. You
send any agent command as a plain channel message (typed or voice-dictated) and
the agent replies in that same channel with Jira-backed analysis.

> **Retired host (historical): AWS ECS Fargate** — the ECS Fargate / ECR / SSM /
> CloudWatch / `DISABLE_VOICE` setup described below documents the *retired*
> Fargate deploy (August 2026) only. It is **not** current. The live host is the
> **EC2 single-box** native deploy; see `deploy/README.md` (authoritative) and
> `deploy/ec2-single-box/`. Do not provision ECS/Fargate/ECR/SSM/CloudWatch/App
> Runner — all legacy.
>
> **Historical Fargate provisioning (imperative, not IaC):** ECR repo
> `discord-agent`, ECS cluster/service `discord-agent` (Fargate, taskdef
> `discord-agent`, 256/512), SSM secrets under `/discord-agent/*`, CloudWatch
> logs `/ecs/discord-agent`. Secrets were stored in AWS SSM and referenced by
> the task definition. A static AWS CLI admin key was retained while iterating
> on setup.


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
- Global single-slot serialization: exactly one agent turn runs at a time across all
  channels (no OOM on the small free-tier host); a burst of messages backs up in memory
  and is answered in order, never dropped.
- A fixed `--title "life-os-agent"` is passed to each deployed `opencode run` so the
  throwaway auto-title LLM call (~20s, invisible to a bot) is skipped.

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

## Command set (all `001` agent commands work)

- **capture**: "add to backlog: X"
- **daily**: "today" / "brief" / "what next", "done KEY-42", "practice X"
- **weekly-groom**: "run weekly"
- **research**: "research KEY-42"

## Out of v1 scope (deferred)

- In-flight session recovery.

## Security

- All secrets are host environment variables; nothing is baked into the image
  or committed. `agent/opencode.json` is rendered at boot from env (FR-007).
- `.dockerignore` / `.gitignore` exclude `.env`, `node_modules`, and generated
  `agent/opencode.json` / `agent/auth.json`.
