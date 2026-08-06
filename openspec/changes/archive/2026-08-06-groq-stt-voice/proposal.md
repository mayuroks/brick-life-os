## Why

Discord voice messaging is currently deactivated: the earlier whisper.cpp-on-EC2
transcription was stripped in `f3d591c` for a thin text-only image, so a voice note
now gets `"🎙️ Voice transcription is off"`. Users cannot speak instructions to the
agent. This is **voice-v2**: restore voice by delegating transcription off-box to
Groq's STT API via URL pass-through, keeping the zero-storage thin host intact.

## What Changes

- **Detect voice notes** in the bridge and route them to a Groq STT transcription path (detection = empty text + audio attachment / voice-message flag).
- **Transcribe via Groq `url` pass-through**: call `POST https://api.groq.com/openai/v1/audio/transcriptions` with the Discord attachment CDN URL. No audio bytes ever reach the host's disk or process.
- **Reuse the existing text flow verbatim**: a successful transcript is enqueued through the global single-slot `ChannelQueue` and runs the normal status → agent → chunked-reply path, one note = one agent turn.
- **Graceful failure without retry/fallback**: on Groq HTTP error, empty transcript, or silence, reply with a clear notice and keep the bridge alive.
- **Config**: add `GROQ_API_KEY` env validation; add a thin `src/transcribe/groq.js` client returning `{status: 'success'|'error'|'empty', text}`.

## Capabilities

### New Capabilities

- `voice/groq-stt`: Transcribing Discord voice notes into agent-turn text via Groq's STT API (URL pass-through), including voice detection, typed-text preference, graceful no-fallback failure, and one-note-one-turn semantics.

### Modified Capabilities

- none (no existing openspec specs reference the voice path; this is the first, formalized version of 011-groq-stt-voice).

## Impact

- **Code**: `deploy/discord-agent/src/bridge/client.js` (voice detection + routing), new `deploy/discord-agent/src/transcribe/groq.js`, `deploy/discord-agent/src/config.js` (add `GROQ_API_KEY`).
- **Reused as-is**: `deploy/discord-agent/src/bridge/queue.js` (single-slot queue), agent reply path.
- **Dependencies**: adds `GROQ_API_KEY` secret; no new npm deps required (uses `fetch`).
- **Systems**: Groq STT API (metered, ~$0.04/audio-hour for `whisper-large-v3-turbo`); no change to the $0 AWS-month constraint.
