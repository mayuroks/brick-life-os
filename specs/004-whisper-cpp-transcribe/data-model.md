# Data Model: Whisper Speech Transcription

**Feature**: `004-whisper-cpp-transcribe` | **Date**: 2026-08-03

This feature is pipeline logic; the only structured data flows are transient. No persistent storage is
introduced.

## Entities

### VoiceMessage (transient, input)

Represents a Discord voice message the bridge must act on.

| Field | Type | Notes |
|-------|------|-------|
| attachmentUrl | string | Signed CDN URL from `attachment.url`; time-sensitive; fetch with redirect follow |
| flag | enum | `MessageFlags.IsVoiceMessage` — reliable voice discriminator |
| hasText | boolean | true if the message already carries typed text (in which case audio is ignored) |
| channelId | string | Used only to route through the existing per-channel FIFO queue |

**State transitions (within the queue job)**:
`received → downloaded → converted → transcribed → forwarded` OR any step → `failed → user-notified`

### Transcript (transient, output)

| Field | Type | Notes |
|-------|------|-------|
| text | string | Speech-to-text result; forwarded to agent as message content |
| status | enum | `success` \| `no-speech` (empty transcript) \| `error` (conversion/whisper failure) |

**Validation rules**
- `success` → non-empty text → forward via `runAgent(serveUrl, text)`.
- `no-speech` / `error` → notify the user with a clear, friendly line (FR-004, FR-005), never crash.

### Config (new optional fields)

| Env var | Default | Purpose |
|---------|---------|---------|
| `WHISPER_MODEL` | `./models/ggml-base.en.bin` | Model file path for whisper-cli |
| `WHISPER_BIN` | `whisper-cli` (on PATH) | Path to whisper-cli binary |
| `WHISPER_TIMEOUT_MS` | `120000` | Max transcription time before failing gracefully |

All optional — missing values fall back to defaults; the bridge fails gracefully if the binary/model is
absent (FR-005) rather than crashing at boot.

## Relationships

- `VoiceMessage` → (transcribe) → `Transcript`
- `Transcript.success` → `runAgent` (existing `agent/client.js`)
- All flow is **stateless**: nothing persisted across messages.
