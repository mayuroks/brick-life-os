# Contract: Voice Transcription API

**Feature**: `004-whisper-cpp-transcribe` | **Date**: 2026-08-03

Internal interface contract for the transcription module. The Discord bridge is the sole caller;
`scripts/transcribe-local.mjs` (local harness) reuses the same seam with a stub responder.

## Module

`deploy/discord-agent/src/transcribe/transcribe.js` (ESM)

### `isVoiceMessage(message)` → `boolean`

True when the message has **no usable typed text** AND carries audio to transcribe.
- Uses `message.flags.has(MessageFlags.IsVoiceMessage)` when available; falls back to
  `!text && message.attachments.size > 0`.
- Guarantees FR-001 (voice is actionable input).

### `transcribeVoiceMessage(attachment, { model, bin, timeoutMs })` → `Promise<{ status, text }>`

Orchestrates download → convert → whisper. Never throws for bad audio; resolves with a result object.

| status | meaning | text |
|--------|---------|------|
| `success` | non-empty transcript produced | transcript string |
| `no-speech` | audio processed but nothing heard | `""` |
| `error` | conversion or whisper failed | `""` (caller surfaces the error) |

Contract on behavior:
- **download**: `fetch(attachment.url, { redirect: 'follow' })` → bytes; streamed promptly.
- **convert**: `ffmpeg -i <in.opus> -ar 16000 -ac 1 -c:a pcm_s16le <out.wav>` (16 kHz mono WAV, exact
  whisper input format).
- **transcribe**: `whisper-cli -m <model> -f <out.wav> -otxt -of <tmpbase>`; read `<tmpbase>.txt`.
- **cleanup**: temp files removed in `finally`.
- **timeout**: abort and return `{ status: 'error' }` after `WHISPER_TIMEOUT_MS` (default 120000).
- **no-speech**: empty whisper output → `{ status: 'no-speech', text: '' }`.

### `whisperBinPath()` / `whisperModelPath()` → `string`

Resolve configured binary/model (env `WHISPER_BIN` / `WHISPER_MODEL`) with documented defaults.

## Caller responsibilities

The bridge (`bridge/client.js`) wraps transcription in the per-channel queue and:
- `success` → `state.agentUp` path: `runAgent(cfg.serveUrl, transcript)` → reply.
- `no-speech` → reply "I didn't catch that — try a text message or speak up." (FR-004)
- `error` → reply friendly error, log, keep going (FR-005).

The local harness replaces "reply to channel" with a stub that prints/asserts the text.

## Non-contract

- No persistent storage; no auth headers needed for the CDN download; no interaction with Jira here
  (that stays inside the agent).
