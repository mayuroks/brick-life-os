# Quickstart: Local Runnable (Brick Bot) — Validation Guide

**Feature**: `003-local-runnable` | **Date**: 2026-08-03

Purpose: prove the local dev mode works end-to-end on the user's machine.
Manual acceptance checks suffice per the prototype constitution.

## Prerequisites

- Node.js LTS installed locally.
- An OpenRouter API key (you supply it locally — never committed).
- The shared core contract fixed (see `contracts/cli-core.md`).

## 1. Set up local config (FR-005)

```text
cp .env.example .env     # then fill in OPENROUTER_API_KEY (required)
                         # optional: OPENROUTER_BASE_URL, BRICK_MODEL
git status               # confirm .env is ignored (not staged)
```

**Expected**: `.env.example` shows the required keys (key required; router URL
and model optional) without values; `.env` is untracked; no key/url/model text
anywhere in the repo or in the code.

## 2. Start and talk to the bot locally (FR-001, FR-001a, SC-001)

```text
node src/cli/cli.js "what's the one thing I should do today?"
```

**Expected**: a reply printed in the Brick persona (blunt coach, brick-red
theme, emoji-prefixed `🔴 **Brick says:**` style). This is the same core logic
the deployed bot uses.

## 3. Add-a-feature loop (FR-003, SC-002)

```text
# edit src/core (e.g., tune persona), then restart:
node src/cli/cli.js "same message"
```

**Expected**: the local reply reflects the change after restart; the cloud
deployment is untouched and continues running (FR-002).

## 4. Offline handling (FR-006, SC-004)

```text
# disconnect network (or set a bogus key), then:
node src/cli/cli.js "hello"
```

**Expected**: a clear, friendly one-line error — never a hang.

## 5. Missing-secret fail-fast (FR-007)

```text
# with OPENROUTER_API_KEY unset (url/model may keep defaults), run any command
node src/cli/cli.js "hello"
```

**Expected**: boot aborts immediately with the exact next steps (copy
`.env.example` → fill key); no half-configured run.

## Notes

- No Discord tunnel or web page — the local surface is the CLI only
  (FR-001a).
- The core module is shared with `002-discord-bot-deploy`; keep changes to
  `src/core` behavior-tested via the CLI before redeploying.
