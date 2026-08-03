# Dev Workflow: Add Features and Debug Locally (US2)

This documents the local **add-and-debug loop**. The whole point of `brick/` is
that you can change bot logic on your laptop and see it immediately, while the
deployed `002-discord-bot-deploy` instance keeps running untouched (FR-002,
FR-003).

## The Loop

1. **Edit the shared core** — `brick/src/core/` (persona) or
   `brick/src/providers/` (provider call). These are the same modules the
   deployed bot consumes, so a change here is a change everywhere (anti-drift,
   FR-001).
2. **Restart the CLI** — run it again with whatever message you want:
   ```text
   node src/cli/cli.js "same message"
   ```
3. **Observe the change** — the local reply reflects your edit.
4. **Verify your `.env` was not touched and production state is not reached.**
   Local runs read only your local `.env` and call the AI provider directly —
   they never hit the deployed bot, its state, or its Discord channel (FR-002).

## Isolation guarantee (FR-002)

- `src/core/` and `src/providers/` contain **no** Discord, HTTP server, or
  `express` code — they are pure logic plus the provider `fetch`. This is what
  keeps the local CLI isolated from the deployed surface.
- Local runs are **one-shot and stateless**: each CLI invocation reads input,
  queries the provider, prints, and exits. There is no long-running process and
  no shared state to collide with the cloud instance.
- The deployment (a separate `002-discord-bot-deploy` surface) is only affected
  when you deliberately redeploy it — never by a local run.

## Practical tips

- Tune the persona in `brick/src/core/persona.js` then restart to hear the new
  voice.
- Behavior-test `src/core` via the CLI *before* redeploying to the cloud
  surface.
- Offline? You'll get a friendly one-line error, not a hang (FR-006).
- Missing key? The CLI fails fast at boot with exact steps (FR-007) — it never
  runs half-configured.
