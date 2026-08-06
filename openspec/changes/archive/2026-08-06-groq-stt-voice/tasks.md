## 1. Config

- [x] 1.1 Add `GROQ_API_KEY` to `src/config.js` env reading, with a lazy validation path that only requires it when a voice note is processed (see design.md Open Questions for the eager-vs-lazy choice).
- [x] 1.2 Expose `groqTranscribe` / Groq base URL constants in the config object.

## 2. Groq transcription client

- [x] 2.1 Create `src/transcribe/groq.js` with `transcribe(url) -> {status:'success'|'error'|'empty', text}`.
- [x] 2.2 Implement the `POST /openai/v1/audio/transcriptions` call via `fetch` with `{ model:'whisper-large-v3-turbo', url }` and `Authorization: Bearer $GROQ_API_KEY`.
- [x] 2.3 Map outcomes: HTTP 2xx + text → success; HTTP 2xx + empty/blank transcript → empty; non-2xx or network error → error (FR-007). Add `src/transcribe/index.js` export.

## 3. Bridge integration

- [x] 3.1 Extract the existing inline turn logic in `src/bridge/client.js` (`messageCreate`) into a shared `runTurn()` helper reused by both text and voice paths.
- [x] 3.2 Add `isVoiceMessage()` detection (MessageFlags.IsVoiceMessage or audio attachment with no typed text); prefer typed text when both present (FR-006).
- [x] 3.3 Replace the "Voice transcription is off" notice with voice routing: extract attachment URL, call `transcribe()`, and handle each outcome.
- [x] 3.4 On success: enqueue the transcript through the existing `ChannelQueue` and run the normal status → agent → chunked-reply path (FR-003, FR-005).
- [x] 3.5 On error/empty: reply with a clear notice, log, and keep the bridge alive with no retry/fallback (FR-004).

## 4. Verification

- [ ] 4.1 Verify no audio bytes are written to disk or buffered in-process (filesystem/process check) during a voice-note turn (SC-001/SC-005).
- [ ] 4.2 Verify a sent voice note yields a coherent agent reply, identical to a typed turn.
- [ ] 4.3 Verify forced failures (HTTP error, empty transcript, silence) produce a clear notice and the bridge survives subsequent messages.
- [ ] 4.4 Verify a burst of voice notes is handled serially in arrival order, one turn each.
- [ ] 4.5 Verify a message with both text and audio uses the typed text (voice path not triggered).
- [ ] 4.6 Re-run the agent boot/build checks to confirm the image stays thin (no new native deps).
