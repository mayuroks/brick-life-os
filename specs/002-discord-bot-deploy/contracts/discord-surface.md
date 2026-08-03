# Contract: Discord Surface (Life OS Agent)

**Feature**: `002-discord-bot-deploy` | **Date**: 2026-08-03

Documents the two external surfaces the deployable exposes: the Discord Gateway
surface (primary) and a minimal HTTP health endpoint. The agent itself is an
internal runtime (headless `opencode serve`) — its full command grammar is the
`001` agent contract, not redefined here.

## Gateway surface (primary — `bridge/client.js`)

- **Connect**: `discord.js` `Client` with intents `Guilds`, `GuildMessages`,
  `MessageContent` (privileged); login with `DISCORD_BOT_TOKEN`.
- **On `messageCreate`**:
  1. Ignore if the author is the bot itself or another bot.
  2. If `message.content` is empty/whitespace → ignore.
  3. Enqueue the message for that channel; process serially.
  4. Send the text to the headless agent; post the agent's reply back to the
     same channel (`message.reply`).
- **Failure modes**: agent/provider/Jira unreachable → the agent returns a clear
  friendly error, which is still posted to the channel (never a hang); gateway
  disconnect → `discord.js` reconnects and logs.

## HTTP surface (`health.js`)

### GET /health

Liveness for the host health check (FR-006).

- **Response**: `200` → `{"status":"ok","agent":"up","bridge":"up"}` when both
  the headless agent server and the bridge are running; non-200 otherwise.

## Agent interface (internal — `agent/client.js`)

```text
run(messageText) -> string  # agent reply in its fixed persona
```

- The bridge calls the headless `opencode serve` (via `opencode run --attach
  <serve-url>` or the serve HTTP API).
- The agent loads `001` skills and the Jira MCP from `agent/opencode.json`
  (env-filled at boot). All `001` command verbs are supported as-is (FR-003).

## Environment contract

All values via env, never committed (FR-007); boot fails fast on missing
required secrets (FR-008 fail-fast in Assumptions / FR-007).

| Env var | Required | Purpose |
|---------|----------|---------|
| `DISCORD_BOT_TOKEN` | Yes | Gateway login |
| `JIRA_URL` | Yes | Jira MCP site |
| `JIRA_USERNAME` | Yes | Jira MCP user |
| `JIRA_API_TOKEN` | Yes | Jira MCP auth |
| LLM provider key (e.g., `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY`) | Yes | Agent model |
| `PORT` | No | HTTP port (default `3000`) |

**Rules**: real values live only in Render env (production) or a git-ignored
`.env` (local dev); `.env.example` documents keys without values; `.dockerignore`
excludes secrets from the image; auth is materialized at boot from env, not
baked in.

## Error behaviors

- **Unreachable provider/Jira** → clear friendly error posted to the channel.
- **Gateway not connected / `MESSAGE_CONTENT` off** → messages never arrive;
  enable the intent in the Discord portal.
- **Missing secret** → boot fails fast with exact next steps.
- **Cold start after idle** → first message may be slow (deferred in v1).
