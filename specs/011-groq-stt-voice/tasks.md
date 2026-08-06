# Implementation Tasks: Voice-V2 — Discord Voice Notes via Groq STT

**Feature**: `011-groq-stt-voice` | **Date**: 2026-08-06 | **Branch**: `011-groq-stt-voice`

Phase-2 task breakdown derived from [plan.md](./plan.md), cross-checked against the live
Groq docs and the current `deploy/discord-agent` source. Implementation granted: **plan first,
implement after** (per user). All tasks are read as "each note = one independent turn through the
existing global single-slot `ChannelQueue`".

## Design deltas locked in during exploration

- **D-A (detection):** `isVoiceMessage(message)` returns `true` only when there is **no usable
  typed text** AND the attachment is an **audio** type (`contentType` starts with `audio/`, or a
  known audio extension fallback). Text+audio → typed text wins, **no STT call** (FR-006).
  Non-audio, no-text attachments (image/gif/pdf) → a distinct **"unsupported message type"** notice,
  graceful, **no STT call**. Resolves the spec R3 "attachment fallback" hole so images never fire a
  pointless STT call.
- **D-B (language):** the Groq request body includes `language: 'en'` for faster, more accurate
  English transcription (config-driven default).

---

## Task 1 — Config: require `GROQ_API_KEY` + expose STT settings

- **File:** `deploy/discord-agent/src/config.js`
- Add `GROQ_API_KEY` to the `missing` required-secret check (fail-fast at boot, FR-007) alongside
  the Jira secrets.
- Return in the config object:
  - `groqApiKey: env.GROQ_API_KEY`
  - `groqSttUrl: env.GROQ_STT_URL || 'https://api.groq.com/openai/v1/audio/transcriptions'`
  - `groqSttModel: env.GROQ_STT_MODEL || 'whisper-large-v3-turbo'`
  - `groqSttLanguage: env.GROQ_STT_LANGUAGE || 'en'`  (D-B)
- **Verify:** `node -e "import('./src/config.js').then(m=>{try{m.loadConfig({});console.log('fail-fast ok')}catch(e){console.log('correctly threw:',e.message)}})"` throws listing `GROQ_API_KEY` when absent; returns it when present.

## Task 2 — New module `src/transcribe/groq.js`

- **Files:** `deploy/discord-agent/src/transcribe/groq.js` (new); reuse the removed
  `git show f3d591c^:deploy/discord-agent/src/transcribe/transcribe.js` for the `isVoiceMessage`
  shape, but swap the local whisper pipeline for a Groq `url` call.
- `isVoiceMessage(message) → boolean` (D-A):
  - `false` if `message.content` has usable text (FR-006).
  - `true` when the attachment is an audio type. Audio check: `attachment.contentType?.startsWith('audio/')`
    OR extension in `{ogg, opus, mp3, mp4, mpeg, m4a, wav, webm, flac}` (from attachment name).
  - Use `MessageFlags.IsVoiceMessage` as an additional positive signal, but do **not** treat
    "has any attachment" as voice — non-audio must return `false`.
- `transcribeVoiceNote(message, { apiKey, sttUrl, model, language }) → Promise<{status, text}>`:
  - Capture `message.attachments.first().url`; JSON body `{ model, url, language }`; header
    `Authorization: Bearer <apiKey>`, `Content-Type: application/json`; `POST <sttUrl>` (FR-002).
  - Use `AbortController` with a bounded timeout (60 s) → `{ status: 'error', text: '' }` on abort.
  - Parse JSON `{ text }`. 2xx with non-empty `text` → `success`. 2xx with empty/whitespace `text`
    → `empty`. Non-2xx or thrown `fetch` → `error`. **No retry, no fallback** (ADR-011 d5).
  - Never throws for transcription outcomes; resolves the classification object (FR-007). Rejects
    only on programming misuse (e.g. no attachment).
- **Verify:** `node --check src/transcribe/groq.js`; run `scripts/transcribe-stt.mjs` (Task 5). No
  bundler/build step — ESM imports resolve at runtime.

## Task 3 — Route voice notes through the bridge

- **File:** `deploy/discord-agent/src/bridge/client.js`
- In `messageCreate`, replace the hardcoded voice-off branch (`client.js:89-97`, the
  `"🎙️ Voice transcription is off"` reply) with:
  ```js
  const audio = message.attachments?.first?.();
  if (!text && audio) {
    if (isVoiceMessage(message)) { /* voice path */ } else {
      message.reply('⚠️ **Unsupported message type.** I can only take text or voice notes.').catch(()=>{});
      return;
    }
  }
  if (!text) return;
  ```
- **Voice path** (mirrors the existing text enqueue): capture `audio.url` **immediately** (R5 —
  minimise CDN expiry window) and `cfg.groqApiKey`, then `queue.enqueue(message.channelId, async () => { ... })`:
  1. `message.reply('⏳ **Listening**')`; `timer = startStatus(status)`.
  2. `const { status: t, text: transcript } = await transcribeVoiceNote(message, { apiKey: cfg.groqApiKey, sttUrl: cfg.groqSttUrl, model: cfg.groqSttModel, language: cfg.groqSttLanguage });`
  3. `success` → `runAgent(cfg.serveUrl, transcript)` → `chunkReply` + status edit / follow-ups
     (reuse the exact text-path tail) (FR-003).
  4. `empty` → edit status to `"I didn't catch that — try a text message or speak up."`; **no
     agent turn** (FR-004).
  5. `error` → edit status to `"Sorry, I couldn't transcribe that audio. Try again or send a text
     message."`; `log('warn', 'voice.transcribe-error', ...)`; keep bridge alive (FR-004).
  - Wrap in the same try/catch that already guards the text path so **no thrown path cancels the
    queue** and no retry/fallback is attempted.
- **Verify:** `node --check src/bridge/client.js`; static review that the voice job uses the same
  single-slot queue + reply/chunking helpers.

## Task 4 — Deploy plumbing

- **Files:** `deploy/discord-agent/Dockerfile`, `deploy/discord-agent/task-def.json`,
  `deploy/discord-agent/.env.example`
- **Dockerfile:** remove `ENV DISABLE_VOICE=1` and the "text-only" comment header (voice enabled).
- **task-def.json:** remove the `DISABLE_VOICE` env (line ~25); add `GROQ_API_KEY` as a
  `valueFrom` SSM-secret `/life-os/discord-agent/GROQ_API_KEY` (standard-tier SSM = free).
- **.env.example:** document `GROQ_API_KEY=` (required) and optional `GROQ_STT_URL`,
  `GROQ_STT_MODEL`, `GROQ_STT_LANGUAGE`.
- **Verify:** grep confirms `DISABLE_VOICE` gone from both; JSON-parse `task-def.json`.

## Task 5 — Standalone STT harness

- **File:** `deploy/discord-agent/scripts/transcribe-stt.mjs` (new)
- Modes:
  - `<url>` — real `url`-mode call against a public audio URL using `transcribeVoiceNote`
    internals; print `status` + transcript; assert no audio file written by the harness (FR-002).
  - `--stub=error` / `--stub=empty` — drive classify with stubbed responses to prove the
    graceful branches and that the process exits cleanly (FR-004, SC-003).
- **Verify:** run all three modes against `fixtures/test.opus` (uploaded to a public URL for the
  real mode); confirm classifications.

## Task 6 — Local live check + (sub-agent) ECS deploy/verify

- Start bridge locally (`.env` with a real `GROQ_API_KEY`), in a test channel:
  1. Happy path voice note → coherent agent reply, one note → one turn, chunked (SC-001/002).
  2. Burst of 3 notes → serial in arrival order (SC-004).
  3. Image/no-text → "Unsupported message type" (D-A); text+audio → text wins, **no** `transcribe`
     event logged (D-A, FR-006).
  4. Forced STT error → graceful notice; next message still processed (SC-003).
- **Delegated (constitution V):** sub-agent builds/pushes the image, updates the ECS task def, and
  live-verifies on the Fargate host (boots fast-fail without the key).

---

## Definition of Done

- [ ] FR-001..007 + SC-001..005 acceptances pass per [quickstart.md](./quickstart.md).
- [ ] `GROQ_API_KEY` missing ⇒ boot fails fast (FR-007).
- [ ] Zero audio bytes on host (filesystem check; SC-001).
- [ ] Image/gif/PDF no-text ⇒ "unsupported message type", no STT (D-A).
- [ ] Text+audio ⇒ text only, no STT event (FR-006, D-A).
- [ ] Language hint `en` present in the request (D-B).
