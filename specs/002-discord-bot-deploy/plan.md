# Implementation Plan: Life OS Agent on Discord (Render Deploy)

**Branch**: `002-discord-bot-deploy` | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-discord-bot-deploy/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Deploy the **Life OS agent** (built in `001`) as a Discord surface on Render's
free tier, driven from a GitHub repo. The agent runs **headless** via
`opencode serve` (loading the `001` skills and the Jira MCP). A thin Node
Discord bridge (`discord.js` Gateway client) reads plain channel messages and
sends them to the headless agent; the agent runs the full `001` command set
and returns Jira-backed analysis to the same channel. Plain messages only —
no slash-command interactions, no external keep-alive pinger in v1.

## Technical Context

**Language/Version**: Node.js >=20 (ESM) for the Discord bridge; the agent is
the opencode runtime (Node-based `opencode` CLI installed in the container).

**Primary Dependencies**:
- `opencode` (headless server) — the real agent with skills + MCP.
- `discord.js` — Gateway client (message -> agent -> reply).
- `express` — minimal `GET /health` for the host health check.
- MCP: `mcp-atlassian` (Jira) — started by the agent from the 001 config.
- `dotenv` — local env loading.

**Storage**: N/A (stateless in v1 — no keep-alive/session persistence). The
agent's own DB may persist sessions ephemerally on the container volume.

**Testing**: Minimal per prototype constitution — manual acceptance (send a
known agent command over Discord, confirm a Jira-backed reply). No automated
suite.

**Target Platform**: Render free tier, Docker Web Service; public HTTPS URL.

**Project Type**: web-service (Discord Gateway + headless agent process) in one
Docker container.

**Performance Goals**: A single agent turn (bridge -> agent -> Jira MCP ->
LLM -> reply) may take tens of seconds; Discord Gateway replies have no 3s
deadline, so no timeout. Send-to-reply latency is not a hard target in v1.
Burst messages queue and process serially per channel.

**Constraints**: Never commit secrets (LLM key, Jira MCP env: `JIRA_URL`,
`JIRA_USERNAME`, `JIRA_API_TOKEN`, `DISCORD_BOT_TOKEN`, opencode auth). The
headless agent must be pre-authenticated in the container (no interactive TUI
login). Enable the Discord `MESSAGE_CONTENT` privileged intent. Fail fast at
boot on missing required secrets.

**Scale/Scope**: 1 user, 1 guild, 1 deployment, low volume. Cold-start
mitigation and session recovery are deferred (see Assumptions).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **IV. Prototype Pragmatism (MUST)** — PASS: smallest working thing —
  one container bundles the existing agent headless + a thin bridge. No
  reimplementation of skills; no gold plating (deferred keep-alive/observability).
- **I. Jira SSOT** — PASS: the agent (and thus Discord) talks to Jira via the
  existing MCP and Jira remains the source of truth (FR-004).
- **II. Agent Is the Interface** — CONSISTENT: this feature extends the same
  agent to a Discord surface; the fixed agent persona/voice governs replies.
- **V. Sub-Agent Delegation** — n/a at plan time; install/verify of the
  container and MCP boot is delegated to sub-agents (max 3) during
  implementation/verification.
- **Out-of-scope guard** — PASS: no Telegram/cron/calendar automation added;
  scope stays "agent command set reachable via Discord + Jira MCP".

No gate violations; no complexity justification needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-discord-bot-deploy/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── discord-surface.md   # Phase 1 output
└── checklists/          # spec quality checklist (existing)
```

### Source Code (repository root)

A new deployable (e.g., `deploy/discord-agent/`) that bundles the agent config
from `001` and the Discord bridge. The `brick/` OpenRouter experiment is not
part of this architecture.

```text
deploy/discord-agent/
├── Dockerfile               # node:20-alpine + opencode + python/uv for MCP
├── render.yaml              # Render free-tier blueprint (Docker)
├── package.json             # bridge deps: discord.js, express, dotenv
├── package-lock.json
├── .dockerignore
├── .env.example             # documents secrets (never committed)
├── src/
│   ├── index.js             # boot: start /health, start bridge
│   ├── health.js            # GET /health (express)
│   ├── bridge/
│   │   ├── client.js        # discord.js Gateway client (intents)
│   │   └── queue.js         # per-channel serial message queue
│   └── agent/
│       └── client.js        # calls headless opencode serve / opencode run --attach
├── agent/                   # <- the 001 agent definitions bundled for deploy
│   ├── opencode.json        # skills paths + atlassian MCP (env-filled)
│   ├── skill/               # capture, daily, weekly-groom, research
│   └── auth.json            # provider auth (from secret at boot, not image)
└── run.sh                   # start opencode serve + node bridge
```

**Structure Decision**: single deployable — one Docker container runs a small
supervisor (`run.sh`) that starts `opencode serve` (agent) and the Node
Discord bridge, plus an `/health` endpoint. Auth and MCP secret env are
injected at container start, never baked into the image.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**
> — none; section intentionally empty.
