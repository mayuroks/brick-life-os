# Phase 3 — DI Refactor + Test Core Network / Spawn

Introduce dependency-injection seams to the modules that currently read
`process.env` or call `fetch`/`spawn` directly, so they can be unit-tested
without hitting real providers. Behavior-preserving; keep all user-visible
strings byte-identical.

## 3.1 `brick/src/providers/openrouter.js`

Current: `queryProvider(systemPrompt, userText)` reads `loadConfig()` (real
env) every call and uses global `fetch`. Plus an **uncaught** failure path:
`res.json()` on a non-JSON body rejects (`openrouter.js:43-45`).

Refactor to: `queryProvider(systemPrompt, userText, deps = {})` where
`deps.baseUrl/apiKey/model` default from `loadConfig()`, `deps.fetch` defaults
to global `fetch`. Optionally top-level `loadConfig()` once instead of per call
(mark as a deliberate change — currently re-read per call).

Cases:
- 2xx with `data.choices[0].message.content` → returns trimmed content.
- non-ok status → throws friendly "…check your key and network…".
- `fetch` throws (network) → throws "…check your network connection…".
- **2xx but invalid JSON** → define behavior (currently uncaught parse error).
  Decide: catch and throw the friendly network message, or a distinct message.
  Test whichever you choose.
- 2xx with blank/`undefined` content → returns `''` (trimmed).

Register the fix for the `res.json()` rejection here — it's the buggy branch.

## 3.2 `brick/src/core/bot.js`

Current: `handleMessage(text)` calls `queryProvider(...)` via static import.

Refactor to: `handleMessage(text, provider = queryProvider)`. Callers already
do `await handleMessage(query)` — default keeps them working.

Cases:
- blank/empty/whitespace text → returns the exact
  `🔴 **Brick says:** Say something first. A blank message gets nothing done.`
- non-empty text → calls `provider(systemPrompt, cleaned)` and returns
  `formatBrickReply(raw)`.
- provider rejects → rejection propagates (server surfaces friendly error) —
  test that `handleMessage` doesn't swallow it.

## 3.3 `deploy/discord-agent/src/transcribe/groq.js`

Current: `transcribe(url)` uses `requireGroqKey()` (real env) + global `fetch`
+ real `FormData`/`log`.

Refactor to: `transcribe(url, deps = {})` where `deps.getKey` defaults to
`requireGroqKey`, `deps.fetch` defaults to global `fetch`.

Cases:
- missing key → `{status:'error', text:''}` (and `deps.log` spy called with the
  key-missing message).
- `fetch` throws → error.
- non-ok HTTP → error (and HTTP body logged).
- ok + non-blank `data.text` → `{status:'success', text:trimmed}`.
- ok + blank text → `{status:'empty', text:''}`.
- assert multipart body contains `model` + `url` fields and bearer header.

## 3.4 `deploy/discord-agent/src/agent/client.js` → `runAgent`

Current: `runAgent(serveUrl, message, opts)` calls `spawn('opencode', …)` with
`cwd` pinned; fuses transport, timing, buffering, logging, tracker, heartbeat.

Refactor: add `deps.spawn` (default Node `spawn`), `deps.openaiVersion`/env, and
make the command/dir injectable so tests can point at the **existing stub**
`test/stub/opencode` (toggled by `BRICK_STUB=ok|slow|fail`). Keep the
`finish()` settle-once guard un-touched (it is correct).

Cases (drive via the stub on `PATH` or an injected spawner):
- `BRICK_STUB=ok` → resolves with reply, `stripThinking` applied.
- `BRICK_STUB=slow` (30s) with a short `timeoutMs` → rejects timeout message AND
  asserts the child was killed (observe `kill` on injected fake/pid).
- `BRICK_STUB=fail` → rejects with stderr-text-based message.
- spawn emits `error` (ENOENT) → rejects "Can't reach the agent…".
- settle-once: after resolve or reject, later `close`/`error` events are
  ignored (assert single resolution).
- empty exit (`code 0`, no output) → resolves `''`.
- non-zero exit → rejects with captured stderr or default "The agent failed…".

**Timeout orphaning note:** SIGKILL only kills the direct child. Document this
risk in the test comments; full subprocess-tree teardown is out of scope here.

## 3.5 `deploy/discord-agent/src/health.js` — optional

If you want to assert the flip log, inject `deps.log` (default the real `log`).
Otherwise skip — body assertions in Phase 1 suffice.

## 3.6 Migration guard

Every error string in `runAgent` and `openrouter` is user-scoped:
- `runAgent`: "The agent took too long…", "Can't reach the agent: …", "The
  agent failed to produce a reply."
- `openrouter`: "Can't reach the model — check your network…", "Can't reach the
  model right now. Check your key and network…"

Freeze these exact strings in tests (assert `err.message` equality).

## 3.7 Acceptance

- `npm test` green in both packages.
- Default call paths unchanged (callers still work with no args).
- All user-visible strings byte-identical.
- The `res.json()` parse-error branch now has defined, tested behavior.
