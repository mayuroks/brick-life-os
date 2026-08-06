## Context

The Discord bridge (`deploy/discord-agent/src/bridge/client.js`) currently drops any message with an audio attachment and replies `"🎙️ Voice transcription is off"` (client.js:96-101). The agent image is thin (node:24-slim, no whisper/ffmpeg — stripped in `f3d591c`), so transcription must happen off-box. The bridge already has a global single-slot `ChannelQueue` (`src/bridge/queue.js`) that serializes all turns and a normal status → agent → chunked-reply path. See proposal.md — Why for motivation.

## Goals / Non-Goals

**Goals:**
- Keeps the host thin: never write/read audio bytes on the host, no new runtime deps.
- Restore voice as a first-class turn type identical to typed text (one note → one agent turn through the existing queue).
- Clear, graceful failure with the bridge left alive.

**Non-Goals:**
- No local/model/ffmpeg audio processing, no multipart streaming fallback, no retry on failure (explicit user choice; revisit only if URL fetch failures prove common).
- No new queueing or messaging semantics — reuse the existing `ChannelQueue` verbatim.
- No batching of a burst into one turn.

## Decisions

1. **Groq STT via URL pass-through.** Detect a voice note, extract `message.attachments.first().url` (a signed Discord CDN URL), and `POST https://api.groq.com/openai/v1/audio/transcriptions` with `{ model: 'whisper-large-v3-turbo', url }` and `Authorization: Bearer $GROQ_API_KEY` using Node's built-in `fetch`. Groq downloads the bytes server-side; the host sees only a URL string and the returned text.
   - *Alternatives*: multipart `file` upload (rejected: pulls bytes into the host process), offload to a Lambda (rejected: extra AWS moving part, no benefit since `url` already avoids touching the host).

2. **Detection = empty text + audio attachment.** Restore the old `isVoiceMessage()` logic: `MessageFlags.IsVoiceMessage` OR (attachment present AND no typed text). A message with both typed text and audio always prefers typed text (voice path not triggered).
   - *Alternative*: reliance on voice-message flag alone (rejected: needs `MessageContent`-adjacent flag plumbing and could miss non-flagged audio notes).

3. **Reuse the existing text flow verbatim (FR-003).** On a successful transcript, enqueue the transcript through the existing `ChannelQueue` and run the exact same status → agent → chunked-reply path used for typed text (extract the inline turn logic in `messageCreate` into a shared `runTurn()` helper). Voice behaves identically to text.

4. **Thin `src/transcribe/groq.js` client.** Exposes `transcribe(url) -> {status: 'success'|'error'|'empty', text}`. On HTTP `2xx` → success (empty transcript text maps to `empty`); on non-`2xx`/network failure or empty result → error/empty.

5. **Config via `GROQ_API_KEY`.** Add to `src/config.js`: require it only when a voice note is actually processed (i.e. validate lazily on first voice message, so the bot still boots without a key for pure-text use) — OR require at startup if the project prefers fail-fast (FR-007). Same `missing`-list error style. Adds `groqTranscribe` to config.

6. **Graceful failure, no retry/fallback (FR-004).** On `error`/`empty`, reply `"🎙️ I didn't catch that"` / `"transcription failed"`, log, and return without enqueuing an agent turn — the bridge stays alive.

## Risks / Trade-offs

- **Signed-URL expiry / CDN fetch failure by Groq** → Mitigation: forward the URL immediately after the message posts (small window); on failure route to the graceful-notice path. If this proves frequent, re-open a multipart fallback as an ADR amendment (deferred, not built).
- **Metered STT cost (~$0.04/audio-hour)** → acceptable for a personal single-user bot; separate from the $0 AWS-month constraint (flagged to user in ADR-011).
- **Burst latency** → serialized through the single-slot queue; same backpressure as a text burst; each note = one independent turn.
- **Config validation timing** (lazy vs. fail-fast) → either is spec-compliant (FR-007); lazy kept as default so text-only operation is unaffected.

## Open Questions

- Should `GROQ_API_KEY` be validated eagerly at boot (fail-fast, changes FR-007's "at startup" feel) or lazily on first voice note? Deferrable without affecting the spec, approach, or task breakdown.
