# Research: Life OS Agent on Discord (Render Deploy)

**Feature**: `002-discord-bot-deploy` | **Date**: 2026-08-03

POC-scoped research. Each unknown from Technical Context is resolved to a
decision with rationale. Kept minimal per prototype pragmatism (constitution IV).

## R-001: How to run the real agent headless

- **Decision**: Run `opencode serve` (the documented headless HTTP server) in
  the container. The Node bridge sends each message to the agent and reads the
  reply.
- **Rationale**: A single long-lived `serve` keeps skills + MCP warm (no
  per-message MCP cold boot), matching the docs' guidance to attach to a
  running server. This is the only way every `001` skill and the Jira MCP work
  unchanged (Spec Clarifications, FR-002).
- **Alternatives considered**: `opencode run` per message (rejected — cold-boots
  MCP and loses continuity); reimplementing skills in Node (rejected — huge,
  drift-prone, contradicts the whole premise).

## R-002: Bridging Discord to the agent

- **Decision**: A thin `discord.js` Gateway client (`messageCreate`) that, per
  message, enqueues and calls the headless agent (via `opencode run --attach
  <serve-url>` or the serve HTTP API), then posts the reply back to the same
  channel.
- **Rationale**: Plain channel messages (voice-dictated or typed) are delivered
  only over the Gateway (FR-001); Discord Gateway replies have no 3-second
  deadline, so a multi-second agent turn won't time out. Serialization per
  channel prevents interleaved replies on burst traffic (edge case).
- **Alternatives considered**: HTTPS interactions endpoint (rejected — slash
  commands only; not needed), reimplementing the agent (rejected).

## R-003: Jira MCP inside the container

- **Decision**: Bundle the `001` agent configuration, including the `atlassian`
  MCP entry (`uvx mcp-atlassian` with `JIRA_URL`, `JIRA_USERNAME`,
  `JIRA_API_TOKEN` env). Provide `python3` + `uv` in the image so the MCP server
  can launch.
- **Rationale**: The agent already reads its Jira MCP from `opencode.json` and
  the env contract (`project-config.json`); reusing it gives Jira-backed
  analysis with zero reimplementation (FR-004). The MCP runs as a local child
  process of the agent.
- **Alternatives considered**: Remote/HTTP MCP endpoint (needs hosting the MCP
  separately — more moving parts); calling Jira REST directly from the bridge
  (rejected — reimplementation, FR-004).

## R-004: Headless auth (no TUI login on Render)

- **Decision**: Provide the LLM provider's key via a Render secret and generate
  the opencode credentials (`auth.json`) at boot from that env, so the headless
  server starts already authenticated. No interactive login.
- **Rationale**: `opencode serve` has no TUI to log in; auth must be present at
  startup. Baking a key into the image is forbidden (FR-007), so the key is an
  env secret materialized into the agent's config/auth at runtime.
- **Alternatives considered**: Interactive `opencode auth login` in the build
  (rejected — can't run a TUI on Render/free tier).

## R-005: Hosting & health

- **Decision**: Single Docker Web Service on Render's free tier; `GET /health`
  returns OK when both the agent server and the bridge are up. Deploy via the
  GitHub repo (`render.yaml` / Dockerfile).
- **Rationale**: Matches the user's "deploy on Render via GitHub" and FR-008.
  Render's own health check reuses `/health`; no external pinger in v1
  (deferred per clarification).
- **Alternatives considered**: Two services (agent + bridge) — more complexity,
  unnecessary for a single user.

## R-006: Secrets on the host

- **Decision**: All secrets (`DISCORD_BOT_TOKEN`, LLM provider key,
  `JIRA_URL`/`JIRA_USERNAME`/`JIRA_API_TOKEN`) are Render env vars /
  `render.yaml` secrets, never committed. Boot fails fast if a required secret
  is missing.
- **Rationale**: Satisfies FR-007/SC-003. `.env.example` documents keys without
  values; `.dockerignore` excludes local secrets from the image.

## Dependency / integration notes

- External deps: Discord (Gateway) and the agent's Jira MCP + LLM provider.
  Failure modes covered: provider/Jira unreachable → clear friendly error;
  bridge disconnected → reconnected by `discord.js`; missing secret → fail-fast
  boot.
- Cold-start after idle (first message slow) and in-flight session recovery are
  deferred (not handled in v1).
