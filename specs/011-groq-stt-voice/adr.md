# ADR-011: Discord Agent — Voice Notes via Groq STT URL Pass-Through

**Date**: 2026-08-06 | **Status**: Accepted | **Context**: grilling session (domain-modeling)

## Context

Discord voice messages are currently **deactivated**. Feature 004 built local
transcription (whisper.cpp + ffmpeg) but commit `f3d591c` stripped it for a thin
text-only image; a voice note now gets `"🎙️ Voice transcription is off"` from
`deploy/discord-agent/src/bridge/client.js:96-101`.

Goals from the grilling session:

- Transcribe Discord voice notes via **Groq's speech-to-text API** (`/v1/audio/transcriptions`).
- **Never let the audio file reach the EC2 host's disk**, and ideally never reach the
  EC2 process at all. The host is a free-tier EC2 with 1GB RAM / 2GB swap / ~10GB disk
  — minimal compute and storage.
- Keep the bridge thin (no whisper model, no ffmpeg, no local audio processing).
- Preserve the existing text-message semantics: one message → one agent turn, strictly
  serialized through the global single-slot queue (`src/bridge/queue.js`).

### Key research finding

Groq STT (OpenAI-compatible) accepts **either** `file` (multipart upload; 25 MB free-tier /
100 MB dev-tier, use `url` beyond that) **or `url`** (server-side download). The `url`
parameter lets Groq fetch the audio itself. Request body needs a **`model`** (e.g.
`whisper-large-v3-turbo`) plus either `url` or `file`.

Discord attachments carry a **signed CDN URL** (`attachment.url`). Voice notes are
`.ogg`/Opus, which is in Groq's supported container formats (ogg, flac, mp3, mp4, mpeg,
mpga, m4a, wav, webm), and the per-note length cap (~5 min, a few MB) is far under the
limit.

**Consequence**: the original "never touch EC2" constraint is fully satisfiable. The EC2
bridge only handles a URL string and the returned text — it never receives audio bytes,
so it needs neither disk nor meaningful RAM/CPU for audio.

## Decision

1. **Groq STT via `url` pass-through.** When the bridge detects a voice message, it
   extracts the Discord attachment's CDN URL and calls `POST https://api.groq.com/openai/v1/audio/transcriptions`
   with `{ model: 'whisper-large-v3-turbo', url }` and `Authorization: Bearer $GROQ_API_KEY`.
   Groq fetches the CDN bytes server-side and returns a transcript. No audio bytes ever
   enter the EC2 process; no ffmpeg/whisper/model/image changes.

2. **Reuse the existing text flow verbatim (FR-003).** On a successful transcript, the
   text is enqueued through the existing global single-slot `ChannelQueue` and runs the
   normal status → agent → chunked-reply path. Voice notes behave exactly like typed
   messages.

3. **Detection = empty text + audio attachment.** Restore the old `isVoiceMessage()`
   logic: `MessageFlags.IsVoiceMessage` with an attachment fallback. A message with both
   typed text AND audio prefers the **typed text** (voice path not triggered).

4. **Per-note, per-turn semantics.** Each voice note = one transcription = one
   independent agent turn, in arrival order. Long speech is expressed as multiple notes
   processed one-by-one; Discord's per-note cap is the hard limit for a single note. No
   on-EC2 chunking (would require local audio processing, which we reject).

5. **Graceful failure, no retry/fallback.** On Groq HTTP error, empty transcript, or
   silence: reply with a clear notice ("I didn't catch that" / "transcription failed"),
   log, and keep the bridge alive — mirroring old FR-004/FR-005. No multipart fallback,
   no retry (user's explicit choice).

6. **Config.** Add `GROQ_API_KEY` to `src/config.js` env validation. Add a thin
   `src/transcribe/groq.js` client returning `{status:'success'|'error'|'empty', text}`.

## Consequences

- **Zero audio bytes on EC2** — satisfies the hard constraint; host stays thin, no OOM
  or disk risk from audio (only a URL string + text transit the bridge).
- **Latency** — one extra network round-trip (CDN→Groq fetch + Groq→text) on top of the
  agent turn. Acceptable for a single-user personal bot; text path unchanged.
- **Risk: signed-URL expiry / HTTP failure on fetch**. The bridge forwards the URL
  immediately after the message posts, so the window is small. Mitigation is the
  graceful-notice path (decision 5). If fetch failures prove common in practice, re-open
  with a multipart-stream fallback (ADR amendment) — explicitly deferred, not built now.
- **Cost** — Groq STT `whisper-large-v3-turbo` is ~$0.04/audio-hour (whisper-large-v3
  ~$0.111); non-free but tiny for personal voice notes. Flagged for user awareness,
  separate from the $0 AWS-month constraint.
- **Multiple notes in a burst** drain serially through the single-slot queue (same
  backpressure characteristics as a text burst).

## Alternatives Considered

- **Multipart streaming fallback on HTTP failure** — rejected (user wants no retry/fallback;
  adds bytes-in-memory + code for a case not yet observed).
- **Offload CDN→Groq to a free-tier Lambda/Worker** — rejected: adds a second AWS moving
  part and latency for zero benefit, since `url` pass-through already avoids touching
  EC2.
- **Re-enable local whisper.cpp** — rejected: contradicts the thin/never-touch-EC2 goal
  and was stripped in `f3d591c`.
- **Batch a burst of voice notes into one agent turn** — rejected: user wants each note =
  its own independent turn, matching the existing text flow.
