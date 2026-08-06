# Contract: Groq STT Transcription Client

**Feature**: `011-groq-stt-voice` | **Date**: 2026-08-06

Internal interface contract for the new transcription module. Sole production caller is the Discord
bridge (`src/bridge/client.js`); the standalone harness `scripts/transcribe-stt.mjs` reuses the same
functions with a stub responder for offline-ish validation.

## Module

`deploy/discord-agent/src/transcribe/groq.js` (ESM)

### `isVoiceMessage(message)` → `boolean`

True when the message has **no usable typed text** AND carries transcribable voice audio.
- Prefers `message.flags.has(MessageFlags.IsVoiceMessage)`; falls back to
  `!text && message.attachments.size > 0`.
- Guarantees FR-001 (voice is actionable input) and FR-006 (typed text wins — returns `false` when
  text is non-empty).

### `transcribeVoiceNote(message, { apiKey, sttUrl, model })` → `Promise<{ status, text }>`

Orchestrates the **url pass-through** call to Groq. Never throws for transcription outcomes; resolves
with a classification object (FR-007). Rejects only on programming/plumbing misuse.

| status | meaning | text |
|--------|---------|------|
| `success` | non-empty transcript | transcript string |
| `empty` | 2xx but no/near-empty transcript (silence) | `""` |
| `error` | HTTP ≠ 2xx (incl. failed CDN-URL fetch) or network failure | `""` |

Contract on behavior:
- **input**: `message.attachments.first().url` → JSON body `{ model, url }`. No bytes fetched
  locally (FR-002).
- **request**: `POST <sttUrl>` (default `https://api.groq.com/openai/v1/audio/transcriptions`) with
  `Authorization: Bearer <apiKey>`, `Content-Type: application/json`, body `{ model, url }`.
- **model**: required by Groq; default `whisper-large-v3-turbo`.
- **response**: parse JSON, return `text`. `2xx` with empty `text` ⇒ `empty`.
- **non-2xx** ⇒ `error`; log `provider` status for diagnosability.
- **timeout**: abort after a bounded timeout (e.g. 60 s) and return `{ status: 'error' }`.
- **no retry / no fallback**: never re-call, never fall back to multipart (ADR-011 decision 5).

## Caller responsibilities (bridge, `src/bridge/client.js`)

In `messageCreate`, when `isVoiceMessage(message)` and no text:
1. Capture `attachment.url` immediately; capture `apiKey` from `cfg`.
2. Enqueue the job through the existing global single-slot `ChannelQueue` (arrival order, FR-005).
3. Reply `⏳ **Listening**` + status rotation inside the job.
4. `success` → `runAgent(cfg.serveUrl, transcript)` → normal chunked reply (FR-003).
5. `empty` → reply `"I didn't catch that — try a text message or speak up."`; no agent turn.
6. `error` → reply `"Sorry, I couldn't transcribe that audio. Try again or send a text message."`;
   log the event; keep the bridge alive (FR-004).

## Non-contract

- No audio bytes, disk I/O, ffmpeg, model, or local processing.
- No Jira interaction here (stays inside the agent).
- No standalone `message.flags` import surface — all via `discord.js` `MessageFlags`.

## Deployment contract

- `config.js` requires `GROQ_API_KEY` (fail-fast, FR-007) and exposes `groqSttUrl` / `groqSttModel`.
- `Dockerfile` drops `DISABLE_VOICE=1`; `task-def.json` adds the `GROQ_API_KEY` SSM secret;
  `.env.example` documents the key.
