# Research: Groq STT URL Pass-Through for Discord Voice Notes (Phase 0)

**Feature**: `011-groq-stt-voice` (voice-v2) | **Date**: 2026-08-06

Resolves the technical unknowns in the plan. Ground truth: the grilling-validated ADR-011 (provider
corrected to **Groq**) + direct confirmation of the Groq docs (endpoint, auth, model, url param,
response shape, pricing).

## R1 — Groq Speech-to-Text endpoint & request shape

- **Decision**: `POST https://api.groq.com/openai/v1/audio/transcriptions` with header `Authorization: Bearer $GROQ_API_KEY`.
  Use the **`url` parameter** (server-side download) with a required **`model`** field
  (`whisper-large-v3-turbo` — best price/performance; multilingual).
- **Rationale** (ADR-011 + docs): Groq STT accepts **either** `file` (multipart; 25 MB free-tier /
  100 MB dev-tier, use `url` beyond that) **or `url`** (server-side download). Sending `url` means
  the EC2 bridge only ever holds a URL string and a returned text string — **no audio bytes touch
  the host process or disk**, which directly satisfies the hard constraint (FR-002, SC-004/05).
  Response is JSON `{ "text": string }` (docs confirm `transcription.text`), with `text` empty when
  nothing was heard.
- **Alternatives considered**:
  - Multipart `file` stream — rejected for v1: requires reading the CDN bytes into the EC2 process,
    violating "never touch the host". Only reconsidered as an ADR amendment if fetch failures prove
    common.
  - `whisper-large-v3` instead of `-turbo` — rejected: turbo is cheaper ($0.04 vs $0.111/hr) and
    plenty for short English notes; `v3` kept as a config-mode enum for later.
  - Local whisper.cpp / ffmpeg (004 approach) — rejected: contradicts thin/no-audio-on-host and was
    already stripped in `f3d591c`.

## R2 — Error semantics to handle gracefully

- **Decision**: treat the outcomes as three clean classifications — `error` (HTTP ≠ 2xx, incl. the
  provider's fetch failures for an expired/unreachable `url`), `empty` (2xx but no/near-empty `text`),
  and `success` (non-empty text); log every event.
- **Rationale** (ADR + spec FR-007): a 4xx/5xx HTTP status means auth/size/fetch failure; a 2xx with
  empty text means silence/unsupported audio. All map to the graceful-notice path (FR-004) with
  **no retry and no fallback** (user's explicit choice — a multipart fallback is explicitly deferred
  in ADR-011).
- **Alternatives considered**: auto-retry on 5xx — rejected (user wants no retry; single-user bot
  stays simple).

## R3 — Voice-note detection on Discord

- **Decision**: restore 004's `isVoiceMessage()` — `!text && message.flags.has(MessageFlags.
  IsVoiceMessage)`, with fallback to `!text && message.attachments.size > 0`.
- **Rationale** (reuses 004-R4 research + the pre-strip `transcribe.js`): the `IsVoiceMessage` flag
  (`1 << 13`) is the reliable discriminator; `attachment.waveform !== null` is populated only for voice
  audio. Voice notes are `.ogg`/Opus — in Groq's supported container formats — and the ~5 min per-note
  cap (a few MB) is far under the 25 MB limit. Text-with-audio prefers typed text (FR-006).
- **Alternative rejected**: always-transcribe-any-attachment — would trigger on non-voice audio files
  (images/gifs already excluded as not audio); keep the flag-first rule.

## R4 — Signed CDN URL expiry window

- **Decision**: forward the attachment URL immediately in the same `messageCreate` handler, before any
  queue wait, by capturing `attachment.url` at event time.
- **Rationale** (ADR-011 consequence): Discord CDN URLs are time-limited; the smallest window is
  achieved by grabbing the URL when the message is received and passing it into the queued job. The
  residual risk (a fetch failure if it still expires mid-queue) is absorbed by the graceful-notice path.
- **Alternatives considered**: re-fetching `attachment.url` inside the job — worse (adds latency before
  the fetch); rejected.

## R5 — Config & secrets plumbing

- **Decision**: add `GROQ_API_KEY` as a **required** env var (fail-fast at boot like the other secrets,
  FR-007) and expose a `groqSttUrl` default. Wire it through `.env.example` and the ECS task-def SSM
  secrets; drop the now-obsolete `DISABLE_VOICE=1`.
- **Rationale**: mirrors the existing `loadConfig()` pattern (config.js:11-42) so the bridge fails
  cleanly if the key is missing; keeps third-party cost isolated as a personal-bot accepted cost.
- **Alternatives considered**: optional key + runtime notice — rejected: FR-007 explicitly requires key
  validation, and a boot-time gate is the existing convention.

## Consolidated decisions

| Decision point | Chosen | Rationale |
|----------------|--------|-----------|
| STT provider | Groq `/openai/v1/audio/transcriptions` | thin, external, replaces stripped local model |
| Model | `whisper-large-v3-turbo` ($0.04/hr) | best price/performance for short notes |
| Transport | `url` pass-through (JSON body) | zero audio bytes on EC2 (FR-002) |
| Auth | `Authorization: Bearer GROQ_API_KEY` | standard Bearer |
| Response | JSON `{ text }` | empty text ⇒ silence ⇒ `empty` |
| Failure | graceful notice, no retry/fallback | user choice; multipart-fallback deferred |
| Detection | `IsVoiceMessage` flag + `!text` + attachment | reliable, reused from 004 |
| CDN expiry | capture `attachment.url` at event time | minimal window before Groq fetch |
| Config | required `GROQ_API_KEY`, fail-fast | existing config pattern (FR-007) |
| Local validation | `scripts/transcribe-stt.mjs` harness | exercises real url-mode call offline-from-Discord |
