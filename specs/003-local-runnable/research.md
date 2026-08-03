# Research: Local Runnable (Brick Bot Dev Mode)

**Feature**: `003-local-runnable` | **Date**: 2026-08-03

POC-scoped research. Each unknown from Technical Context is resolved to a
decision with rationale. Kept minimal per prototype pragmatism (constitution
IV) — no deep-dives warranted for a 1-hour POC.

## R-001: Local interaction surface

- **Decision**: A simple CLI / test-input path that calls the same core bot
  logic and prints the Brick reply. No Discord tunnel, no local web page.
- **Rationale**: User's explicit clarification (Spec §Clarifications). Discord
  cannot reach a laptop without a tunnel; a tunnel adds setup time that a POC
  doesn't need. A CLI is the smallest thing that satisfies "add features and
  debug it" (FR-001a, SC-001).
- **Alternatives considered**: (1) Tunnel local server to Discord — realistic
  but slower, rejected. (2) Local web chat page — nicer UX, more to build,
  rejected for 1hr POC.

## R-002: Language / code reuse

- **Decision**: Node.js. Factor bot logic into a **shared core module**
  (`src/core`) used by both the local CLI and the deployed HTTP surface
  (`002-discord-bot-deploy`).
- **Rationale**: The deployed bot is already Node/Express (handover). Sharing
  the core avoids two divergent implementations and satisfies FR-001 ("same
  bot logic, same interaction surface").
- **Alternatives considered**: Duplicating logic in the CLI (rejected — drift
  risk, violates FR-001).

## R-003: Secret handling locally

- **Decision**: A git-ignored `.env` file (real secrets) loaded at runtime from
  a documented `.env.example`; inline env from openCode also supported.
- **Rationale**: Standard Node practice; keeps keys out of source control
  (FR-005, SC-003). `.gitignore` excludes `.env`.
- **Alternatives considered**: Committing a `.env` (rejected — secret leak),
  hardcoding (rejected).

## R-004: Errors when provider offline

- **Decision**: Provider wrapper catches network failure and returns a clear,
  friendly one-line message (e.g., "Can't reach the model — network offline").
- **Rationale**: Satisfies FR-006 / SC-004; a CLI must not hang.
- **Alternatives considered**: Retry loops / backoff (rejected — overkill for
  POC), silent failure (rejected — unusable).

## R-005: Missing secrets at boot

- **Decision**: `config.js` fails fast at startup if required secrets are
  absent, printing the exact steps (copy `.env.example` → fill values).

## R-006: All connection params as env (key, router URL, model)

- **Decision**: The provider connection is fully env-driven. Env vars:
  `OPENROUTER_API_KEY` (required), `OPENROUTER_BASE_URL` (optional, default
  `https://openrouter.ai/api/v1`), `BRICK_MODEL` (optional, default model).
- **Rationale**: User requirement to keep model name, OpenRouter/router URL,
  and key out of the code (FR-005). Defaults let the common case work with a
  single key while still allowing a proxy/self-hosted endpoint and a specific
  model without editing source.
- **Alternatives considered**: Hardcoding the base URL (rejected — exposes the
  endpoint and blocks proxy use), reading only the key (rejected — misses
  url/model the user flagged).
- **Rationale**: Satisfies FR-007; prevents a half-configured run that mimics
  success.

## Dependency / integration notes

- OpenRouter is the single external dependency (from `002`). CLI and deployed
  surface share one client instance.
- No storage, no persistence: stateless. Config-only (data-model).
