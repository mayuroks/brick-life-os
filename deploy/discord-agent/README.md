# Life OS Agent on Discord

Deploys the **Life OS agent** (the `001` opencode agent with its skills and
Jira MCP) as a **Discord surface**, driven from this GitHub repo. You
send any agent command as a plain channel message (typed or voice-dictated) and
the agent replies in that same channel with Jira-backed analysis.

> **Current host: AWS ECS Fargate** (Render was retired — free-tier CPU/uptime was
> unreliable, then AWS App Runner closed onboarding to new customers, so the host
> is ECS Fargate). Deployment is automated via `.github/workflows/deploy-aws.yml`
> (build -> ECR -> ECS service) using GitHub OIDC. Text-first: `DISABLE_VOICE=1`
> on the host so no whisper model/CPU is needed; voice transcription via an
> external service is a scheduled follow-up.
>
> **AWS provisioning is imperative, not IaC**: ECR repo `discord-agent`, ECS
> cluster/service `discord-agent` (Fargate, taskdef `discord-agent`, 256/512),
> SSM secrets under `/discord-agent/*`, CloudWatch logs `/ecs/discord-agent`.
> Secrets are stored in AWS SSM and referenced by the task definition — never
> committed. A static AWS CLI admin key is retained locally **only while iterating**
> on setup and should be deleted once the OIDC auto-deploy path is stable.


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

## Deploy to Render (via GitHub)

1. Push this repo (deploy root = this `deploy/discord-agent/` dir) to GitHub.
2. Render → New Web Service → connect the repo → auto-detect the `Dockerfile`
   (or use `render.yaml`). The deploy builds from an **Ubuntu 26.04 LTS (amd64)**
   base image and includes server-side **voice transcription** (whisper-cli +
   ffmpeg + a baked `ggml-tiny.en.bin` model).
3. Add these **secrets** in the Render dashboard (never committed):
   - `DISCORD_BOT_TOKEN`
   - `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`
   - `ANTHROPIC_API_KEY` (or `OPENROUTER_API_KEY`)
   - `WHISPER_MODEL` — defaults to `/app/models/ggml-tiny.en.bin` (can be
     overridden for larger plans)
   - Health check path: `/health`
4. In the Discord Developer Portal, enable the `MESSAGE_CONTENT` privileged
   intent for the bot so it can read message content.

### Render free-tier notes (read before relying on 24/7)

- **Sleep**: free tier spins down after ~15 min idle, and the Discord gateway is
  *outbound* (doesn't count as inbound activity), so the bot can go offline when
  idle. Add an external pinger (e.g. UptimeRobot) hitting the public `/health`
  URL every <15 min to keep it warm. **Guaranteed always-on 24/7 requires a
  paid/starter plan.**
- **Speed**: free tier gives ~0.1 CPU, so server-side voice transcription is
  slower than local; a paid plan restores near-realtime transcription.
- **Memory**: free tier is 512 MB; the image uses the `tiny.en` model by default
  to fit. Switch `WHISPER_MODEL` (`base.en` etc.) only on a larger plan.
- **No disk**: free tier has no persistent disk; the bot holds no state to lose.

### Keep the service awake (external ping monitor)

The free tier sleeps after ~15 min idle (the Discord gateway is outbound and doesn't count as inbound
traffic, and Render's own health check does not wake a sleeping instance). To keep it warm, point any
free **ping / uptime monitor** — UptimeRobot, cron-job.org, or any equivalent — at the public health
endpoint:

- **URL**: `https://<your-service>.onrender.com/health` (the `/health` path; do **not** use
  `/robots.txt`, which Render answers without waking the service).
- **Interval**: must be **< 15 minutes** (5 minutes is a safe default; a kept-warm service also counts
  toward the free 750 instance-hours/mo).
- **Up / Down semantics**: `/health` returns `200` when healthy and `503` when degraded (agent or
  Discord bridge down). Configure the monitor so 2xx = Up; a `503` alert means readiness failed — it's
  expected, not a bug.
- **Notifications**: wire a channel you'll see (e.g. email or a Discord webhook integration).

**Guaranteed always-on 24/7 still requires a paid/starter plan** — the pinger reduces, but does not
eliminate, free-tier limits.

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
