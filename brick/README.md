# Brick — Dev Runtime (Local CLI + Discord Surface)

**Brick** is an AI bot that connects **Discord** to **OpenRouter** in a fixed
blunt-coach persona. This repo holds **both** surfaces that share the **same
core logic** (`src/core/`, `src/providers/`):

- **Local CLI** (dev-only) — run and debug Brick on your own machine.
- **Discord surface** (`server.js`) — the deployed, cloud-hosted bot that
  answers Discord commands (feature `002-discord-bot-deploy`).

> Local CLI is a **CLI only** — no Discord tunnel, no web page (FR-001a).

## Setup (FR-004, FR-005)

Requires **Node.js LTS**.

```text
# 1. Install deps
npm install

# 2. Create your local config from the example
cp .env.example .env          # then fill in OPENROUTER_API_KEY (required)

# 3. Confirm .env is git-ignored (never committed)
git status
```

`.env.example` documents the variables:

| Env var | Required | Default if unset |
|---------|----------|------------------|
| `OPENROUTER_API_KEY` | Yes | — (boot fails fast if missing) |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` |
| `BRICK_MODEL` | No | provider default (e.g. `openai/gpt-4o-mini`) |
| `DISCORD_PUBLIC_KEY` | Deployed surface only | — (server fails fast if missing) |
| `JIRA_API_TOKEN` | No (v1 is Discord→OpenRouter) | — |
| `PORT` | No | `3000` |

The real `.env` is git-ignored and never committed. Inline environment values
(e.g. from openCode) work too.

## Run (local CLI)

```text
node src/cli/cli.js "what's the one thing I should do today?"

# or pipe from stdin
echo "hello brick" | node src/cli/cli.js
```

You'll get a reply in the Brick persona:

```text
🔴 **Brick says:** [blunt, actionable advice]
```

## Run (Discord surface, local)

```text
# Fill in OPENROUTER_API_KEY + DISCORD_PUBLIC_KEY in .env, then:
npm start            # or: npm run dev (auto-reload)
# /health -> {"status":"ok"}
# /discord -> verified interactions (see Deploy)
```

## Deploy to Discord + Render (FR-005–FR-008)

The deployed bot is an Express server (`server.js`) with a `/health` liveness
endpoint and a `/discord` interaction endpoint. It verifies every request's
Ed25519 signature before processing (FR-001).

**1. Create the Discord bot** (Discord Developer Portal → New Application):
   - Under **Bot**, copy the **Token** (used if you add slash commands).
   - Under **General Information**, copy the **Public Key** — this is
     `DISCORD_PUBLIC_KEY`.
   - Enable the bot in your server (OAuth2 → URL generator → `bot` scope).

**2. Deploy to Render** (free tier), driven by this GitHub repo:
   - New → Web Service → connect the GitHub repo (root of this `brick/` dir).
   - Render auto-detects the **Dockerfile** (or use the `render.yaml` blueprint).
   - Add env vars as secrets (never in the repo): `OPENROUTER_API_KEY`,
     `DISCORD_PUBLIC_KEY`. Set the health check path to `/health`.
   - Open the running service's `.onrender.com` URL, e.g.
     `https://brick-discord-bot.onrender.com`.

**3. Wire up Discord** (Developer Portal → your app → General Information):
   - Set **Interactions Endpoint URL** to
     `https://<your-service>.onrender.com/discord` and click **Save**.
   - Discord sends a PING; the server replies and the URL is accepted.

**4. Add a slash command** (so you can `/brick <text>`):
   - Use a tool like `discord-interactions`/`@discordjs/rest` or the Portal's
     slash-command config to register a command named `brick` with a `text`
     string option. The server reads `data.options[0].value` as the query.
   - (Context-menu message commands also work — the server reads the targeted
     message's content.)

**5. Keep it awake (FR-008)**: Render's free tier sleeps when idle. Set up an
   external cron pinger (e.g. **UptimeRobot**) hitting
   `https://<your-service>.onrender.com/health` every **10 minutes**.

## Error cases

- **Provider offline** (FR-006): a clear, friendly one-line error — never a hang.
- **Missing secret** (FR-007): boot aborts immediately with the exact next steps
  (copy `.env.example` → fill `OPENROUTER_API_KEY` / `DISCORD_PUBLIC_KEY`); never
  runs half-configured.
- **Bad signature** (FR-001): `/discord` returns `401` — the request is rejected
  and never processed.

## Debugging & adding features

See [docs/dev-workflow.md](docs/dev-workflow.md) — the add-and-debug loop.
Also see `specs/003-local-runnable/quickstart.md` for the manual validation walkthrough
and `specs/003-local-runnable/contracts/cli-core.md` for the shared-core contract.
