# Phase 4 — Turn-Path + HTTP Integration Tests

Test the orchestration layers with lightweight fakes (fake `Message`,
injected `runAgent`/`transcribe`, injected `verify`/`handleMessage`). No real
Discord/provider.

## 4.1 `brick/server.js` → app factory

Refactor `server.js` from a flat bootstrap into an exported factory:
`createApp({ publicKey, verify, handleMessage })` returning the Express app,
then `index`-style bootstrap calls `.listen`. Keep `/discord` raw-body + JSON
parse + PING + error handling inside the factory.

Cases (via `listen(0)` + `fetch`, zero-dep):
- **401** — bad/missing `x-signature-ed25519`/timestamp.
- **400** — valid signature but non-JSON body.
- **PING** — `{type:1}` → `{type:1}`.
- **application command** with slash option → `{type:4, data.content}`.
- **empty query** → the "Say something first." reply.
- **provider ok** → reply string is `formatBrickReply(...)` result.
- **provider throws** → `🔴 **Brick says:** <err.message>` (not a 500).
- **Adversarial regression to cover:** non-`application/json` content-type →
  `req.body` may be `undefined`, and the current `req.body.toString('utf8')`
  (`server.js:48`) throws. Decide: reject 400 (recommended) and test it.

## 4.2 `.../bridge/client.js` → turn paths with fakes

Refactor `runTurn(...)` / `handleVoice(...)` to accept injected
`runAgent`/`transcribe` (default the real ones) so tests pass a fake.

Fake `Message` shape: `{ content, channelId, channel: { send }, author: { bot,
username }, attachments: { size, first() }, flags, reply, edit }` — each method
resolvable/rejectable as the test needs.

### `runTurn(message, cfg, state, payload, status)` — success
- posts then edits status with `chunks[0]`; extras via `message.channel.send`.
- sets `state.agentUp = true`.

### `runTurn` — agent rejects
- clears timer, sets `state.agentUp = false`, edits status with the error
  message (fallback to `message.reply` only when `status` is unset).

### `runTurn` — deleted status + fallback
- `status.edit` rejects → falls back to `message.reply(chunks[0])`.

### `handleVoice(message, cfg, state)` — 4 outcomes
- no attachment → replies "couldn't see an audio attachment…", **no runTurn**.
- transcribe `error` → status edited to "Sorry, I couldn't transcribe…",
  **no runTurn**, `state.agentUp` untouched.
- transcribe `empty` → "I didn't catch that…", no runTurn.
- transcribe `success` → reuses the status message into `runTurn` (single
  message Listening → Wondering → answer; assert `status.edit` sequence, no
  second "Got it" reply).

### Assertion on one-shot events
- status timer started then cleared (inject a fake `setInterval`/`clearInterval`
  or spy) — verify no leakage.
- Exactly one reply/edit per turn.

## 4.3 `.../bridge/client.js` → created message routing (thin)

Optionally test the `messageCreate` guard by exporting a handler that takes
`(message, queue, cfg, state)`; assert bots/empty/typed/voice routing without a
real `Client`.

## 4.4 `.../agent/ops.js` integration with `runAgent`

With the DI'd `runAgent` (Phase 3), assert `tracker.summary()` entries are
reflected in the timeout/error log fields — confirms observability wiring.

## 4.5 Leave untested (document as manual-only)

- `deploy/discord-agent/src/index.js` (process hooks, boot) — no seam, thin.
- `createBridge` full gateway wiring (`new Client(...)`, `client.login`) —
  mock `Client` only if necessary; otherwise covered by Phase 4.2 handlers.
- `deploy/discord-agent/scripts/bootstrap.js` — near-infra template render;
  cheap to add a file-content test if you want, else leave manual.

## 4.6 Acceptance

- `npm test` green in both packages.
- Both turn paths (typed + voice) exercise success and every failure branch
  with fakes — no network, no Discord token.
- The `/health` 200/503 contract and `{agentUp,bridgeUp}` JSON are frozen by
  Phase 1 tests and unchanged.
- All Phase 3 user-visible strings still match.
