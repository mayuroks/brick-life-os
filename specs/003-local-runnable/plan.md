# Implementation Plan: Local Runnable (Brick Bot Dev Mode)

**Branch**: `003-local-runnable` | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-local-runnable/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

The user wants a locally runnable version of the Brick Discord bot so they can
add features and debug on their own machine. Per clarification, the local
surface is a **simple CLI / test-input path** that feeds a message into the
**same core bot logic** as the deployed bot and prints the Brick reply — no
Discord tunnel and no local web page. The deployable bot lives in
`002-discord-bot-deploy`; this feature factors the shared core so both the
deployed HTTP surface and the local CLI can call it, then adds a thin local CLI
plus safe local config.

## Technical Context

**Language/Version**: Node.js (the deployed bot uses Node/Express per the handover). Version: current LTS.

**Primary Dependencies**: Shared bot core module (same one used by the deployed bot); a CLI entry that reads a message and calls the core; OpenRouter client for the AI query; `dotenv`-style config loaded from a git-ignored local env file.

**Storage**: N/A — stateless bot; config only.

**Testing**: Minimal per prototype constitution — manual acceptance (start → type message → verify Brick reply). A tiny smoke script is optional, not required.

**Target Platform**: macOS / Linux local machine (user's laptop); Node.js local runtime.

**Project Type**: cli (local dev harness) built around a shared core module.

**Performance Goals**: Instant reply as perceived by a human in a one-shot CLI call (network bound on the AI provider).

**Constraints**: Never commit secrets; reuse the exact same core logic as deployed (no drift); offline must produce a clear friendly error, not a hang; fail fast on missing secrets.

**Scale/Scope**: 1 user, 1 laptop, single-feature POC. Minimal.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **IV. Prototype Pragmatism (MUST)** — PASS: this plan ships the smallest working thing (shared core + thin CLI), no gold plating.
- **I. Jira SSOT** — PASS (n/a to this bot's own runtime code; the feature itself is tracked as a Jira issue).
- **V. Sub-Agent Delegation** — n/a at plan time; install/verify work is delegated during implementation if needed.
- **Out-of-scope guard** — PASS: no Telegram/cron/calendar-write introduced; this is a standalone bot POC the user requested.

No gate violations; no complexity justification needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-local-runnable/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Option 1: Single project (DEFAULT) — one Node package in the brick bot repo
brick/                         # (or reuse the 002 repo layout)
├── src/
│   ├── core/                # shared Brick logic (persona + query → reply)
│   │   ├── bot.js           # handleMessage(text) → Brick reply
│   │   └── persona.js       # fixed Brick system prompt / formatting
│   ├── providers/
│   │   └── openrouter.js    # OpenRouter client (single dependency)
│   ├── cli/
│   │   └── cli.js           # local CLI entry: message in → reply out
│   └── config.js            # load env secrets; fail fast if missing
├── .env.example             # documented, git-ignored real .env
├── .gitignore               # ignores .env
├── package.json
└── README.md                # how to run locally (quickstart)
```

**Structure Decision**: Single Node package. The key structural move is a
**shared core module** (`src/core`) so the local CLI and the deployed HTTP
surface both call the same bot logic — satisfying FR-001 ("same bot logic,
same interaction surface") and preventing behavior drift. The CLI is a thin
wrapper over that core. No web page, no tunnel (FR-001a).

## Complexity Tracking

> Not needed — Constitution Check passes without violations.

---

## Phase 0: Outline & Research

See `research.md` (decisions documented):

- Local interaction surface → CLI/test-input (shared core), not tunnel/web (FR-001a).
- Language/reuse → Node.js shared core reused by deployed bot (avoids two implementations).
- Secrets locally → git-ignored `.env` + documented `.env.example`; inline env from openCode also supported (FR-005).
- Offline handling → friendly one-line error from provider wrapper (FR-006).
- Missing secrets → fail fast at boot with exact steps (FR-007).

## Phase 1: Design & Contracts

Artifacts produced:

- `data-model.md` — entities: Local Bot Runtime, Brick Reply, Local Config, Provider Connection (shared core reused by deployed).
- `contracts/cli-core.md` — the `handleMessage(text) → reply` contract shared by CLI and deployed surface; env var contract.
- `quickstart.md` — runnable manual validation: setup, run CLI, verify Brick reply, offline + missing-secret cases, secret-leak check.
