# Feature Specification: Local Runnable (Brick Bot Dev Mode)

**Feature Branch**: `003-local-runnable`

**Created**: 2026-08-03

**Status**: Draft

**Input**: User description: "I want a locally runnable version (local opencode works) so I can run it locally too bcoz I may want to add features and debug it."

## Overview

Extends the described [Discord Bot Deploy](../002-discord-bot-deploy/spec.md)
feature with a **locally runnable development mode** for the Brick bot. The
user wants to run the same bot on their own machine (openCode works locally)
so they can add features and debug without depending on the cloud deployment.
The local mode must behave like the deployed version while remaining safe to
run offline/on-device (no secrets in the repo, no interference with the live
cloud instance).

## Clarifications

### Session 2026-08-03

- Q: When running the bot locally, how do you want to send it messages (Discord can't reach a laptop directly)? → A: A simple local CLI / test-input path that feeds a message into the same core bot logic and prints the Brick reply. No tunnel, no local web page — keeps the POC small (finish in ~1hr).
- Q: Should this feature include the GitHub → Render Discord deployment, or stay a local CLI-only dev runtime? → A: Keep it local CLI-only. GitHub → Render Discord deployment (Discord bot/server creation, secret injection, uptime pinger) is out of scope here and belongs to the separate `002-discord-bot-deploy` feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run the Bot on My Own Machine (Priority: P1)

The user starts the bot locally on their laptop, and it behaves just like the
cloud version — accepting the same commands and returning the same Brick
persona replies — so they can try features and logic changes in real time.

**Why this priority**: This is the entire ask — a locally runnable version.
Without the ability to boot and talk to the bot on-device, the rest of the
feature (adding features, debugging) has no foundation.

**Independent Test**: Can be fully tested by starting the bot locally and
sending it a test command/query, then confirming a Brick persona reply returns
— delivering a working local runtime standalone.

**Acceptance Scenarios**:

1. **Given** the local project is set up, **When** the user starts the bot,
   **Then** it boots successfully and exposes the same interaction surface as
   the deployed version.
2. **Given** the bot is running locally, **When** the user sends a test message via the local input path, **Then** the bot returns a reply in the fixed Brick persona.

---

### User Story 2 - Add Features and Debug Without Breaking Cloud (Priority: P1)

The user edits code locally, restarts the local bot, and iterates — changing
behavior and fixing issues — while the cloud deployment continues to run
unaffected. The user can inspect bot responses to verify the change.

**Why this priority**: The stated motive for running locally ("I may want to
add features and debug it"). Local iteration must not destabilize the live
deployment, otherwise the user can't have both.

**Independent Test**: Can be fully tested by making a local change, restarting
the local bot, and confirming the new behavior locally while the cloud instance
continues serving unchanged — delivering isolated local development standalone.

**Acceptance Scenarios**:

1. **Given** the local bot is running, **When** the user changes logic and
   restarts it, **Then** the local bot reflects the change on the next
   interaction.
2. **Given** the cloud instance is live, **When** the user runs and restarts
   the local bot, **Then** the cloud instance continues running unaffected by
   any local state.

---

### User Story 3 - Safe Local Setup With No Secret Leaks (Priority: P2)

Setting up the local version is quick and reproducible, and no secrets are
ever committed to the repo — the user supplies their own values at runtime
either via local environment or the local openCode flow.

**Why this priority**: Security is a baseline requirement inherited from the
deployed feature. A reproducible, copy/substitute local setup prevents
confusion while keeping keys out of source control.

**Independent Test**: Can be fully tested on a fresh clone by following the
setup steps and confirming the bot boots with locally supplied secrets and
that no secret text exists in the repository — delivering a safe, reproducible
local start standalone.

**Acceptance Scenarios**:

1. **Given** a fresh local setup, **When** the user follows the documented
   setup steps, **Then** the bot boots and responds.
2. **Given** the repository, **When** inspected for secrets, **Then** no
   `.env` file or literal key/token value is committed.

---

### Edge Cases

- What happens if the user's local machine has no network access to the AI
  provider? (a clear, friendly offline/error message instead of a hang)
- What happens when the bot is run locally while the cloud instance uses the
  same channel/endpoint? (local mode must have an isolated way to test so the
  two don't collide)
- How are secrets supplied locally without committing them? (via a local
  environment/example file that is git-ignored and never checked in)
- What happens if required secrets are missing at local boot? (fail fast with
  a clear message and the exact steps to supply them)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST run the same bot logic locally on the user's
  machine with the same interaction surface (commands + Brick persona) as the
  deployed version.
- **FR-001a**: Local mode MUST provide a simple local input path (CLI / test
  input) that feeds a message into the same core logic and prints the Brick
  reply — no tunnel or web page required.
- **FR-002**: Local mode MUST be isolated from the deployed instance so running
  and restarting locally does not disrupt or conflict with the cloud version.
- **FR-003**: Local mode MUST support the full add-and-debug loop: change
  code, restart locally, observe behavior change, without touching production.
- **FR-004**: The local setup MUST be reproducible from a fresh checkout using
  documented steps and locally supplied configuration.
- **FR-005**: The system MUST keep all secrets out of the repository (no
  committed keys, tokens, or secret-filled configuration files).
- **FR-006**: Local runs MUST handle provider unreachability (e.g., offline)
  with a clear user-friendly message rather than hanging or failing silently.
- **FR-007**: Missing required secrets at local boot MUST fail fast with a
  clear message and instructions, never mimicking a half-configured run.

### Key Entities

- **Local Bot Instance**: The same Brick logic executed on the user's machine
  for development; shares command surface and persona with the deployed bot.
- **Local Configuration**: Machine-specific values (e.g., a git-ignored local
  environment file or inline openCode-provided values) that supply secrets
  without committing them.
- **Provider Connection**: The link to the AI model service from the local
  runtime; must be checkable and fail gracefully when unreachable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The user can start the bot locally and receive a Brick persona
  reply to a typed message (via the local CLI/test input) within a single
  setup-to-interaction session.
- **SC-002**: A local code change is reflected by the local bot after a restart
  while the cloud instance remains unaffected — both verifiable in one session.
- **SC-003**: A fresh checkout can be booted locally following documented steps
  with no manual step omitted and no secret committed.
- **SC-004**: Querying the bot locally with the provider offline returns a
  clear, friendly error instead of hanging — verifiable in one local run.

## Assumptions

- The local version targets the user's own machine, which runs openCode
  successfully, so a command-line / local-server flow is acceptable.
- The local interaction surface is a simple CLI / test-input path (per
  clarification): it reuses the same core bot logic but does NOT connect
  Discord locally via a tunnel or a web page.
- Local development is expected to occur alongside (not replacing) the 24/7
  cloud deployment; the two coexist.
- Secrets are supplied locally at runtime (via a git-ignored local environment
  file or inline openCode-provided values); the repo holds no secrets.
- The same AI provider and Brick persona apply locally; the bot behavior is
  identical to the deployed version's logic.
- Minimal testing per the prototype constitution: manual acceptance checks
  (start → send command → verify reply) suffice.
- Cloud deployment (GitHub → Render: Discord bot/server creation, secret
  injection, uptime pinger) is explicitly OUT of scope for this feature; it is
  owned by the separate `002-discord-bot-deploy` feature.
