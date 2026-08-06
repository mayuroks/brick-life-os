# Data Model: Groq STT Voice Notes

**Feature**: `011-groq-stt-voice` | **Date**: 2026-08-06

This feature is stateless pipeline logic. The only structured values that transit the process are
transient (a URL string + a text string); **no persistent storage and no audio bytes** are introduced
(FR-002). The global single-slot queue allocates only an in-memory job closure, unchanged.

## Entities

### VoiceNote (transient, input)

Represents a Discord voice note the bridge must transcribe. Only the **signed CDN URL string** is
ever held; the audio bytes are never downloaded into the process (FR-002).

| Field | Type | Notes |
|-------|------|-------|
| attachmentUrl | string | Signed CDN URL (`message.attachments.first().url`); captured at message-event time to minimize expiry window |
| isVoice | boolean | `MessageFlags.IsVoiceMessage` true, or `attachments.size > 0` fallback; false when the message carries typed text (FR-006) |
| hasText | boolean | true ⇒ typed text wins; voice path not triggered (FR-006) |
| channelId | string | Routing key through the existing global single-slot `ChannelQueue` (unchanged) |

**State transitions (inside the queue job)**:
`received → (transcribed via Groq url) → transcribed` OR `... → failed` (each end state maps to a
user-facing notice; never a crash, retry, or fallback — FR-004).

### Transcript (transient, output)

| Field | Type | Notes |
|-------|------|-------|
| text | string | Provider's `{ text }`; empty ⇒ `empty`. Becomes the agent turn input on `success` (FR-003) |
| status | enum | `success` \| `empty` \| `error` (FR-007 classification) |

**Validation rules**
- `success` → non-empty text → forward via `runAgent(serveUrl, text)` (unchanged text path).
- `empty` (2xx, near-empty text ⇒ silence) → reply "I didn't catch that" style notice; **no agent turn**.
- `error` (HTTP ≠ 2xx, incl. a failed fetch of the CDN `url`) → reply a clear
  "transcription failed" notice, log the event, and keep the bridge alive; **no retry, no fallback** (FR-004).

### BridgeConfig (new required field)

| Env var | Default | Purpose |
|---------|---------|---------|
| `GROQ_API_KEY` | *(required)* | Authorizes the Groq STT call (FR-007). Missing ⇒ fail fast at boot. |
| `GROQ_STT_URL` | `https://api.groq.com/openai/v1/audio/transcriptions` | Optional override of the STT endpoint. |
| `GROQ_STT_MODEL` | `whisper-large-v3-turbo` | Model used for the transcription call. |

The obsolete `DISABLE_VOICE` flag is removed: voice is unconditionally enabled on this path.

## Relationships

- `VoiceNote` → (Groq `url` STT) → `Transcript`
- `Transcript.success` → `runAgent` (existing `src/agent/client.js`)
- `Transcript.empty` / `Transcript.error` → user-facing notice (FR-004)
- All flow **stateless**: nothing persisted across messages; no audio on disk or in memory.

## Non-data

No new Jira entities, no files, no DB, no model artifacts. Storage stays at zero for audio (SC-004/05).
