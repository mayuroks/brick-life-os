# Phase 2 — Extract Buried Pure Helpers, Then Test

Move pure logic out of HTTP/gateway handlers into named, exported functions so
they can be unit-tested. Behavior-preserving: no string changes.

## 2.1 `brick/server.js` → `extractQuery(type, data)`

Currently inline at `server.js:91-110`. Extract to an exported pure function.

Cases:
- type 2 + slash (`data.type === 1`) with `data.options[0].value` string →
  trimmed value.
- type 2 + slash with blank/undefined value → falls through (should return
  `''`).
- type 2 + context command with `data.resolved.messages` → content of first
  message, stringified + trimmed.
- type 3 or 2 with `data.content` string → trimmed content.
- everything else / missing → `''`.

**Regression freeze:** the caller at `server.js:71` treats falsy as
"Say something first". Preserve that contract exactly.

## 2.2 `deploy/discord-agent/src/bridge/client.js` → `chunkReply(text)`

Currently inline at `client.js:35-49`. Extract and export.

Cases:
- empty/null/undefined → `['']`.
- length <= 2000 → `[text]`.
- long text splits only at `\n` first, else space, else hard at 2000.
- no chunk is empty; no chunk exceeds 2000; concatenation of trimmed chunks is
  semantically equivalent (order preserved).
- a single word longer than 2000 → hard-sliced, no infinite loop.

## 2.3 `.../bridge/client.js` → `isVoiceMessage(message)`

Currently inline at `client.js:72-82`. Extract and export.

Cases:
- non-`Message` / falsy → false.
- text present → false (typed text always wins).
- `flags.has(IsVoiceMessage)` → true.
- no flags but has attachments → true.
- **New behavior to flag:** current fallback is "any attachment = voice".
  Recommend gating to audio MIME in this phase (or document as an open
  question) so a non-audio file doesn't hit Groq. If gating is added, add cases:
  image file → false, audio file → true.

## 2.4 `.../agent/client.js` → `stripThinking(text)`

Currently inline at `client.js:35-41`. Extract and export.

Cases:
- leading `Thinking: ...` single line → stripped + trimmed.
- multi-line thinking block → trimmed with no trailing blank leak.
- non-string → `''`.
- plain reply (no thinking) → returned trimmed.
- **Keep the exact output contract** — it's what users see after a run.

## 2.5 `.../bridge/client.js` → shared reply posting

Extract the status-edit + follow-up-send fallback logic (`client.js:115-118`)
into a small pure-ish helper `postReply(status, chunks, channel)` so the
"edit vs reply fallback" and "extra-chunk send" branches are testable with a
fake message (full turn wiring is Phase 4).

## 2.6 Demo (first, to prove the conveyor works)

Implement `extractQuery` with a RED test first, watch it fail against the
current inline logic decision, extract, GREEN.

## 2.7 Acceptance

- All extracted helpers unit-tested; production behavior unchanged.
- `server.js` and `bridge/client.js` still wire the same logic via the new
  exports.
- The three duplicated "empty/Say something" strings (`server.js:76`,
  `bot.js:25`, `persona.js:24`) are now frozen by tests pending a deliberate
  consolidation decision (prefer to leave them, or unify in a follow-up that
  changes copy intentionally).
