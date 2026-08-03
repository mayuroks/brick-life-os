# Data Model: Local Runnable (Brick Bot Dev Mode)

**Feature**: `003-local-runnable` | **Date**: 2026-08-03

Small, stateless feature. The only domain entities are the shared bot core
contract, the local config, and the runtime entry points. No persisted store.

## Entities

### Brick Core Module (shared)

The single implementation of bot logic used by BOTH the local CLI and the
deployed HTTP surface (`002-discord-bot-deploy`). This is the anti-drift
guarantee behind FR-001.

- **Input**: a user message string (command or free text).
- **Behavior**: applies the fixed Brick persona system prompt, sends to the
  AI provider, formats the reply in the Brick style.
- **Output**: a Brick-formatted reply string, or a friendly error string.
- **Relationship**: consumed by `CLI` (local) and `Deployed Discord Surface`
  (production); both see identical behavior.

### Brick Reply

- The model-generated response formatted in the Brick persona (blunt coach,
  brick-red theme, emoji-prefixed). Produced by the core, printed by the CLI.

### Local Config

- Machine-specific runtime values supplied at boot.
- **Secrets**: `OPENROUTER_API_KEY` (required); optional `OPENROUTER_BASE_URL`
  (router/proxy endpoint, default `https://openrouter.ai/api/v1`) and
  `BRICK_MODEL` (model name).
- **Rule**: never committed (`.env` git-ignored; `.env.example` exposes the
  required keys without values). No key/url/model hardcoded in code.

### Provider Connection (OpenRouter)

- The link to the AI model service.
- States: healthy / unreachable. Unreachable → friendly error (FR-006).
- Missing-from-state → fail-fast boot error (FR-007).

## State / Lifecycle

- Bot runtime: `boot (validate config) → ready (accept messages) → process →
  reply-or-error → exit`. No long-running state; CLI is one-shot per invocation.

## Validation rules (from requirements)

| Rule | Source |
|------|--------|
| Same core logic used locally and in deployment | FR-001 |
| Local input is CLI/test-input, not tunnel or web | FR-001a |
| Local run does not disturb deployed instance | FR-002 |
| Code change reflected after local restart | FR-003 (dev workflow) |
| Reproducible from fresh checkout | FR-004 |
| No secrets committed | FR-005 |
| Provider offline → clear, friendly error | FR-006 |
| Missing secrets → fail fast at boot | FR-007 |
