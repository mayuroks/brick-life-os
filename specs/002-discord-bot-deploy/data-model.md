# Data Model: Life OS Agent on Discord (Render Deploy)

**Feature**: `002-discord-bot-deploy` | **Date**: 2026-08-03

Stateless surface in v1. Entities are the headless agent, its Jira MCP, the
Discord bridge, and the message/reply flow. No persisted store beyond the agent
runtime's own transient state.

## Entities

### Life OS Agent (headless)

The real `001` opencode agent running headless via `opencode serve` (FR-002).

- **Fields / identity**: opencode config (skills paths + atlassian MCP), agent
  persona, runtime URL (`opencode serve`).
- **Behavior**: executes the full `001` command set (capture, daily,
  weekly-groom, research, done/practice/streaks) and produces Jira-backed
  analysis.
- **Input**: a user message (from the bridge).
- **Output**: the agent's reply in its fixed persona.
- **Relationships**: consumes `Jira MCP` for data; consumed by `Discord Bridge`.

### Jira MCP (atlassian MCP server)

The agent's existing Jira integration (FR-004). Local child process launched by
the agent from config, using env:

- `JIRA_URL` (e.g., `https://mayurzenith.atlassian.net`)
- `JIRA_USERNAME` (e.g., `mayurzenith@gmail.com`)
- `JIRA_API_TOKEN` (secret)
- **Behavior**: read/write project data (issues, fields, labels, transitions)
  for the agent's analysis and actions.
- **Rule**: credentials come from host env secrets, never committed (FR-007).

### Discord Bridge

A thin `discord.js` Gateway client (FR-001, FR-005).

- **Fields**: bot token, guild/channel ids at runtime, per-channel queue.
- **Behavior**: reads `MESSAGE_CREATE` → sends text to the agent → posts the
  agent's reply to the same channel.
- **Rules**: ignore the bot's own messages and other bots; empty → ignore;
  serialize per channel (burst traffic, edge case).

### Channel Message → Agent Reply

- **Message**: plain text (typed or voice-dictated) treated as an agent command
  or query.
- **Reply**: the agent's response, posted back to the originating channel.

### Environment Config (host secrets — FR-007)

| Env var | Purpose | Required |
|---------|---------|----------|
| `DISCORD_BOT_TOKEN` | Gateway login | Yes (fail-fast) |
| `JIRA_URL` | Jira MCP site | Yes (fail-fast) |
| `JIRA_USERNAME` | Jira MCP user | Yes (fail-fast) |
| `JIRA_API_TOKEN` | Jira MCP auth | Yes (fail-fast) |
| LLM provider key (e.g., `ANTHROPIC_API_KEY`/`OPENROUTER_API_KEY`) | Agent model | Yes (fail-fast) |
| `PORT` | HTTP port | No (default `3000`) |

### Health (minimal)

- `GET /health` returns OK when the agent server and bridge are both running
  (FR-006), used by Render's health check. No external pinger in v1.

## State / Lifecycle

- Process: `boot (validate secrets) → materialize auth → start opencode serve →
  start bridge → ready (route messages) → handle message → reply`. Single
  long-running container process supervisored by `run.sh`.
- Cold-start after idle and in-flight session recovery are out of v1 scope
  (deferred).

## Validation rules (from requirements)

| Rule | Source |
|------|--------|
| Plain channel message routed to the agent via Gateway | FR-001 |
| Real agent run headless (`opencode serve`), 001 skills loaded | FR-002 |
| Full 001 command set works over Discord | FR-003 |
| Jira data via the Jira MCP (no custom integration) | FR-004 |
| Reply returned to the same channel in the agent persona | FR-005 |
| Minimal `GET /health` | FR-006 |
| Secrets in host env, never committed | FR-007 |
| Reproducible container build from GitHub | FR-008 |
