# Quickstart: Life OS Agent on Discord — Validation Guide

**Feature**: `002-discord-bot-deploy` | **Date**: 2026-08-03

Purpose: prove the deployed agent works end-to-end — a plain Discord message
(typed or voice-dictated) with any `001` agent command returns the agent's
Jira-backed reply in the same channel. Manual acceptance checks suffice per the
prototype constitution.

See `contracts/discord-surface.md` for the surface contract and
`data-model.md` for entities/rules.

## Prerequisites

- Node.js LTS locally; a Discord app (Bot) with a **Bot Token**, `MESSAGE_CONTENT`
  intent enabled, and the bot added to a server you control.
- Jira MCP credentials (`JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`) and an
  LLM provider key for the agent.
- Docker + a GitHub repo + a Render account for the hosted deploy.

## 1. Local setup (FR-007)

```text
cd deploy/discord-agent
npm install
cp .env.example .env     # fill DISCORD_BOT_TOKEN, JIRA_*, and the LLM key
git status               # confirm .env is ignored
```

**Expected**: `.env` untracked; `.env.example` lists keys without values.

## 2. Run and verify locally (FR-001, FR-002, FR-003, SC-001)

```text
./run.sh                 # starts opencode serve + the bridge
```

**Expected**:
- The bridge logs in to Discord and the agent server starts.
- `GET /health` → `{"status":"ok","agent":"up","bridge":"up"}` (FR-006).
- In your Discord server, send a plain message with a known agent command, e.g.
  **"today"** or **"add to backlog: call bank"** → the agent replies in that
  same channel with a Jira-backed response (FR-003, SC-001).
- The bot ignores its own messages (no reply loop).

## 3. Jira-backed analysis (FR-004, SC-002)

Send a command that reads Jira (e.g., "today" for the Todo-Week assessment, or
"research KEY-42"). **Expected**: the reply reflects Jira project data pulled
via the Jira MCP — matching what the same command returns locally.

## 4. Error handling (FR-007; edge cases)

- Set a bogus `JIRA_API_TOKEN` or LLM key → a clear friendly error is posted to
  the channel, never a hang.
- Unset a required secret and start → boot fails fast with exact next steps.
- Send several messages quickly in one channel → replies are returned
  serially in order (no interleaving).

## 5. Hosted deploy (FR-008, SC-003)

1. Push `deploy/discord-agent/` (repo root = deploy root) to GitHub.
2. Render → New Web Service → connect repo → auto-detect `Dockerfile` (or use
   `render.yaml`). Set secrets: `DISCORD_BOT_TOKEN`, `JIRA_URL`,
   `JIRA_USERNAME`, `JIRA_API_TOKEN`, and the LLM key. Health check path
   `/health`.
3. Discord portal → enable `MESSAGE_CONTENT` intent and set the bot up in your
   server.

**Expected**: send a 001 agent command from any device → the agent replies with
a Jira-backed answer; no secret is committed (SC-003). (Note: after an idle
period the free tier may show a slow first reply — cold-start mitigation is
deferred out of v1.)

## Notes

- This feature does not reimplement the agent — it deploys the existing `001`
  agent headless. All agent behavior (persona, skills, Jira via MCP) matches
  local usage.
- Slash-command interactions, an external keep-alive pinger, and in-flight
  session recovery are out of v1 scope (per clarification).
