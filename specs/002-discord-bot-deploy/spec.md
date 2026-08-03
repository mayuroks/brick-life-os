# Feature Specification: Life OS Agent on Discord (Render Deploy)

**Feature Branch**: `002-discord-bot-deploy`

**Created**: 2026-08-03

**Status**: Draft

**Input**: User: "I want the 002-discord bot to speak with the agent. The agent should have Jira MCP to pull project data and give me analysis. All the commands implemented in the 001 agent commands should work. Deploy on Render via GitHub."

## Overview

Deploy the **Life OS agent** (built in `001`) as a Discord surface on Render's
free tier, driven from a GitHub repo, so the user can run the full agent command
set remotely (e.g., while traveling). The agent runs **headless** via
`opencode serve`; a thin Node Discord bridge reads plain channel messages
(typed or voice-dictated) over the Discord Gateway and sends them to the agent.
The agent executes its own skills (`capture`, `daily`, `weekly-groom`,
`research`) and uses the **Jira MCP (atlassian MCP server)** to pull project
data and return analysis — identical behavior to using the agent locally.

## Clarifications

### Session 2026-08-03

- Q: How should a user invoke the bot in Discord — what counts as a "command"? → A: **Any plain channel message** is sent to the agent. This enables fluent voice input (mic dictation → text in the message box → send → agent replies in the same chat).
- Q: Plain channel messages reach a bot over the Discord **Gateway** (WebSocket, requiring the bot token + the privileged `MESSAGE_CONTENT` intent), not an HTTPS endpoint — is that the surface? → A: Yes — a Gateway listener reads `MESSAGE_CREATE` and routes each message to the agent.
- Q: Should the bot reimplement the 001 agent behavior, or run the real agent? → A: **Run the real agent headless** (`opencode serve`) on Render so every existing 001 command and the Jira MCP work unchanged, with no reimplementation.
- Q: How is the agent reached programmatically? → A: The Node bridge calls the headless `opencode serve` instance (via `opencode run --attach` / the serve HTTP API), which keeps skills + MCP warm and avoids per-message cold boot.
- Q: Which command surface is required in v1? → A: Plain messages only. Keep-alive / 24/7 cold-start mitigation and in-flight session recovery are **out of v1 scope for now** (deferred).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run the Full Agent From Discord While Away (Priority: P1)

While away from their machine, the user sends any 001 agent command to the
Discord channel (e.g., "today", "add to backlog: X", "run weekly",
"research KEY-42") and receives the agent's Jira-backed reply/analysis in that
same chat — no need to be at home.

**Why this priority**: This is the entire ask — make the existing Life OS agent
reachable remotely. Without a Discord→agent round-trip that reproduces local
behavior, the feature has no value.

**Independent Test**: Send a plain message containing an agent command (e.g.,
"today") from Discord and confirm a reply that reflects Jira data (e.g., the
Todo-Week assessment), matching what the same command returns locally —
delivering the core remote-query value standalone.

**Acceptance Scenarios**:

1. **Given** the bot is deployed and present in a Discord server, **When** the
   user sends any 001 agent command as a plain message, **Then** the agent
   responds in the same channel with its analysis.
2. **Given** a command that requires Jira data, **When** the agent runs, **Then**
   it reads/writes Jira via the Jira MCP and returns a data-backed reply.

---

### User Story 2 - Secure, Reproducible Render Deploy (Priority: P2)

The agent's secrets (provider keys, Jira MCP/API auth, Discord bot token) live
in the host's secure environment, never in the repo, and the deployment builds
reproducibly from GitHub via a containerized build.

**Why this priority**: The agent holds privileged Jira access; leaking secrets or
non-reproducible deploys would compromise the Life OS system. Baseline security
and reliability.

**Independent Test**: Confirm the repo contains no secret values and that a
fresh checkout deploys to Render with only environment variables configured —
delivering a secure, reproducible deploy standalone.

**Acceptance Scenarios**:

1. **Given** the project is pushed to GitHub, **When** inspected, **Then** no
   `.env` or literal key/token value is committed.
2. **Given** a fresh deployment, **When** the host starts, **Then** required
   secrets are read from host environment variables and the agent boots without
   hardcoded credentials.

---

### Edge Cases

- Provider or Jira MCP unreachable → return a clear, friendly error rather than
  hanging or silently failing.
- Required secrets missing at boot → fail fast with exact next steps, never a
  half-configured run.
- Gateway not connected / `MESSAGE_CONTENT` intent not enabled → messages never
  arrive; must be enabled in the Discord portal.
- Burst/rapid messages → queue and process serially per channel; replies are
  posted as they finish (Gateway replies have no 3-second deadline, so no
  timeout, but latency can exceed a human's "instant" expectation).
- Cold start on free tier (deferred): the first message after idle may be slow —
  not handled in v1 per clarification.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept a plain Discord channel message (typed or
  voice-dictated) via the **Gateway** (`MESSAGE_CREATE`) and route it to the
  Life OS agent.
- **FR-002**: System MUST run the real agent headless via `opencode serve`
  (loading the `001` skills: capture, daily, weekly-groom, research) so agent
  behavior matches local usage with no reimplementation.
- **FR-003**: System MUST support the full `001` agent command set over Discord
  (e.g., "today"/"brief", "add to backlog: X", "run weekly", "research KEY-42",
  "done KEY-42", streak/practice commands).
- **FR-004**: System MUST read/write Jira project data and produce analysis via
  the **Jira MCP (atlassian MCP server)** — no separate custom Jira integration.
- **FR-005**: System MUST return the agent's reply to the same Discord channel
  the message arrived in, in the agent's fixed persona.
- **FR-006**: System MUST expose a minimal `GET /health` endpoint for the host's
  health check.
- **FR-007**: System MUST store all secrets (provider/LLM keys, Jira MCP auth,
  Discord bot token, opencode/auth) in the host's secure environment and MUST
  NOT commit them to the repo.
- **FR-008**: System MUST deploy reproducibly from a GitHub repository via a
  containerized build (Docker + Render Web Service).

### Key Entities

- **Life OS Agent**: The opencode agent (from `001`) running headless
  (`opencode serve`) with its skills and persona; the source of all replies.
- **Jira MCP**: The atlassian MCP server the agent calls to pull project data
  (site `mayurzenith.atlassian.net`, project keys per `project-config.json`).
- **Discord Surface / Bridge**: A thin Node (`discord.js`) Gateway client whose
  only job is: message in → send to the agent → post the reply back in the
  channel.
- **Channel Message**: A plain message (typed or voice-dictated) that is sent to
  the agent.
- **Agent Reply**: The analysis/response produced by the agent in its fixed
  persona.
- **Environment Config**: Host-side secrets injected at runtime (FR-007).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user sends any `001` agent command from Discord (typed or
  voice-dictated) and receives the agent's reply in the same chat on the first
  attempt.
- **SC-002**: A Jira-data-dependent command (e.g., "today") returns an analysis
  backed by Jira via the MCP, matching local behavior.
- **SC-003**: A fresh checkout deploys to Render with only environment variables
  configured; no secret is committed and no manual step is omitted.

## Assumptions

- Deployment target is Render's free tier via a Docker-based Web Service,
  driven from a GitHub repo (FR-008).
- The agent runs headless on the host via `opencode serve`; the Discord bridge
  calls it (FR-002).
- Jira access is via the **Jira MCP (atlassian MCP server)** with an API token —
  the agent's existing integration, not recreated in the bot.
- The query surface is plain channel messages (typed or voice-dictated); no
  slash commands are required in v1.
- The agent's fixed persona (from `001` / the constitution) governs all replies;
  the bot does not impose a separate persona.
- 24/7 cold-start mitigation (keep-alive pinger), in-flight session recovery,
  slash-command interactions, and health-visibility observability are **out of
  v1 scope** (deferred per clarification).
- Per the prototype constitution, minimal testing: a manual acceptance check
  (send a known agent command over Discord, confirm a Jira-backed reply) suffices.
