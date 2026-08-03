# Contract: Shared Core + Local CLI (Brick Bot)

**Feature**: `003-local-runnable` | **Date**: 2026-08-03

Defines the shared interface between the local CLI and the deployed Discord
surface, plus the local configuration contract. Both entry points consume the
same core module so behavior stays identical (FR-001).

## Core bot interface

```text
handleMessage(text: string) -> string
```

- `text`: a user message (command or free text).
- Returns the Brick-formatted reply, or a friendly error string.
- The single persona system prompt lives in the core (`persona.js`), shared by
  CLI and deployed surface — one source of truth for the Brick voice.
- All connection parameters come from the environment (`config.js`); the code
  contains no hardcoded model name, provider URL, or key.

**Consumers**
- Local CLI (`cli.js`): reads a message (argv or stdin), calls `handleMessage`,
  prints the result.
- Deployed HTTP surface (`002-discord-bot-deploy`): verifies the Discord
  interaction, calls the same `handleMessage`, returns it to Discord.

## Environment contract

All connection values are supplied via environment variables and are NEVER
committed to the repo. `config.js` loads them and fails fast on missing
required values (FR-005, FR-007).

Required (fail-fast at boot if missing — FR-007):

| Env var | Purpose | Required |
|---------|---------|----------|
| `OPENROUTER_API_KEY` | AI provider key | Yes |

Optional (sensible defaults so the no-env case still works):

| Env var | Purpose | Default |
|---------|---------|---------|
| `OPENROUTER_BASE_URL` | OpenRouter (router) API base URL | `https://openrouter.ai/api/v1` |
| `BRICK_MODEL` | Model name for queries | provider default (e.g., `openai/gpt-4o-mini`) |

> The provider wrapper (`openrouter.js`) reads all three from `config.js`. The
> base URL is env-overridable so a self-hosted/proxy endpoint can be used
> without touching code. No value is hardcoded in source.

**Setup rules (FR-004, FR-005):**
- Provide `.env.example` listing the keys without real values.
- Real `.env` is git-ignored and never committed.
- Create `.env` by copying `.env.example` and filling values (key required;
  url and model may be left to defaults).
- Inline env from openCode is also supported (e.g., pass the vars as
  environment at run time); either path is acceptable.

## Error behaviors

- **Provider unreachable** (`FR-006`): `handleMessage` returns a clear, friendly
  one-line message; never hangs. CLI prints it and exits non-zero.
- **Missing secrets** (`FR-007`): boot aborts with the exact next steps
  (copy `.env.example` → fill `OPENROUTER_API_KEY`, and optionally
  `OPENROUTER_BASE_URL` / `BRICK_MODEL`); never runs half-configured.
