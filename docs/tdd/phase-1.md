# Phase 1 — Pure Modules, Test Now

No refactor required. These modules are already testable as-is. Write tests,
then fix only cosmetic issues found.

## 1.1 `brick/src/core/persona.js`

Functions: `formatBrickReply(reply)`, constant `BRICK_SYSTEM_PROMPT`.

Cases:
- non-empty string → prefix `🔴 **Brick says:** ` + trimmed input.
- whitespace-only / empty / `undefined` / `null` → returns
  `'🔴 **Brick says:** Nothing to say. Say something worth reacting to.'`
- input is already trimmed → no double-space.
- **Warning:** this is one of THREE "empty input" messages. Do not unify it in
  this phase — freeze the current copy (`persona.js:24`) in a test to prevent
  accidental drift while consolidating later.

## 1.2 `brick/src/discord/verify.js`

Function: `verifyDiscordSignature(publicKeyHex, rawBody, signatureHex, timestamp)`.

Cases:
- missing any of publicKey/signature/timestamp → `{valid:false, reason}`.
- non-numeric timestamp → invalid.
- timestamp outside ±300s (use injected/faked `Date.now` if extracted; otherwise
  compute boundary values relative to real now) → `'Stale signature timestamp (possible replay)'`.
- receipt of a valid sign: build a known Ed25519 keypair, sign
  `Buffer.from(timestamp + rawBody)`, assert `{valid:true}`.
- tampered body/signature → `{valid:false}`.
- malformed public key hex → `'Signature verification error'` (not a throw).

## 1.3 Configs — `brick/src/config.js` + `deploy/discord-agent/src/config.js`

Both already take `env` as a parameter (injectable). **Do not let the
`import 'dotenv/config'` import pollute tests** — pass an explicit `env` object.

`loadConfig(env)`:
- missing `OPENROUTER_API_KEY` (brick) → throws with the documented steps text.
- missing required Discord/Jira secrets (discord-agent) → throws listing all.

`requireGroqKey(env)`:
- key present → returns it.
- missing → throws with the Groq next-steps text.
- constants `GROQ_TRANSCRIBE_URL` / `GROQ_TRANSCRIBE_MODEL` are stable strings.

## 1.4 `deploy/discord-agent/src/agent/ops.js`

Function: `parseOp(text)`; factory: `track()`.

`parseOp` cases:
- no op keyword (model/jira/tool) → `null`.
- op but no duration → `null`.
- non-finite duration → `null`.
- unit map: `ms`→x, `s`→x*1000, `m`→x*60000, default `ms`.
- status map: `ok`/`done`→success, `fail`→failed, `error`→error, else unknown.
- non-string input → `null`.

`track()`:
- `add` with matchable text returns a record and `summary()` includes it.
- `add` with unmatchable text returns undefined, doesn't throw.
- `summary()` returns a copy (mutating result doesn't affect internal state).

## 1.5 `deploy/discord-agent/src/bridge/queue.js`

Class `ChannelQueue` — the single-slot FIFO. Test the scheduler, not Discord.

Cases:
- FIFO order: enqueue 3 jobs with staggered resolves → run in arrival order.
- busy-lock: a running job's `pump` doesn't start the next until `.finally`.
- never-drop: enqueue >1 before any resolves → all drain.
- rejection propagates to that job's promise and does NOT block the next job.
- empty queue → `pump` no-ops.

## 1.6 `deploy/discord-agent/src/log.js`

Function: `log(level, event, ctx, msg, fields)`.

Cases: capture `process.stdout`/`process.stderr` writes; assert:
- one NDJSON line per call; valid JSON.
- `ts`, `level`, `event`, `ctx`, `msg` present; `fields` spread at top level.
- `info`/`warn` → stdout, `error` → stderr.
- does not throw on missing args (defaults).

## 1.7 `deploy/discord-agent/src/health.js`

Factory: `createHealthApp(state)`; returns an Express app. Test with
`node:test` + `fetch`-style by `listen(0)` + superagent-free fetch, or via
supertest if you accept the dep. Prefer Node 20's global `fetch` against a
`listen(0)` server to stay zero-dep.

Cases:
- default `{agentUp:true,bridgeUp:false}` → 503, `status:'degraded'`.
- both up → 200, `status:'ok'`, `agent/bridge:'up'`.
- asserting on the flip log: it fires exactly once per flag change between
  successive `/health` calls (use an injected `log` spy; currently `health.js`
  imports `log` directly — see phase-3 if you want this injectable, otherwise
  assert on the JSON body only).

## 1.8 Acceptance

- `npm test` green in both packages.
- No production code changed except any export added for testability (none
  strictly required in this phase).
