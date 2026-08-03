# Research: Whisper Speech Transcription (Phase 0)

**Feature**: `004-whisper-cpp-transcribe` | **Date**: 2026-08-03

Resolves the technical unknowns in the plan. Findings consolidate three parallel research passes.

## R1 — How to run whisper.cpp from Node.js on macOS

- **Decision**: Install `whisper-cli` via `brew install whisper-cpp` and spawn it as a subprocess from
  Node (`child_process.spawn`). Download the `ggml-base.en.bin` model separately.
- **Rationale**: Prebuilt Apple Silicon bottle (no compile, no Xcode CLT needed); direct control; no
  wrapper-package maintenance risk; works identically on the eventual deployed image since we control
  the binary path (`WHISPER_BIN`).
- **Alternatives considered**:
  - `nodejs-whisper` (maintained) — self-contained, auto-downloads model + does ffmpeg, but compiles
    whisper.cpp on install (needs CLT) and adds a wrapper layer. Rejected: more moving parts.
  - `whisper-node` — unmaintained (2023). Rejected.
  - `node-whisper` (Pnlvfx) — **Python** openai-whisper, not whisper.cpp. Rejected (violates "local" goal).
  - `whisper.cpp` official npm / `whisper-wasm` — abandoned stubs. Rejected.

## R2 — Model choice

- **Decision**: `ggml-base.en.bin` (~148 MB) as the default; English-only `.en` variant.
- **Rationale**: Best speed/accuracy tradeoff for short, near-certain English voice notes; ~10–15 s CPU
  for a 1-minute clip on Apple Silicon (faster with Metal). tiny (77 MB) is faster but notably rougher.
- **Alternatives**: `small.en` (488 MB) for better accuracy if needed later; medium/large overkill + too
  slow for local prototype. Model source: `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin`.

## R3 — Opus→WAV conversion path

- **Decision**: `ffmpeg-static` (npm) — bundles a static ffmpeg binary for macOS arm64; call via
  `child_process.execFile`.
- **Rationale**: Self-contained (no Homebrew ffmpeg), identical CLI on later alpine, robust to real
  Discord Opus (48 kHz) — it resamples to 16 kHz mono.
- **ffmpeg CLI form**:
  `ffmpeg -i <in.opus> -ar 16000 -ac 1 -c:a pcm_s16le <out.wav>`
- **Alternatives rejected**: system ffmpeg (fragile on alpine), pure-JS Ogg demux + `@discordjs/opus`
  should do it but the Ogg demuxers are abandoned and won't build on Node 24/arm64.

## R4 — Accessing the Discord voice attachment

- Voice-message audio appears as a normal `message.attachments` item with a direct, signed CDN `url`
  (fetch follows redirects; no auth header needed for the CDN GET).
- Reliable discriminator: `message.flags.has(MessageFlags.IsVoiceMessage)` (`1 << 13`); also
  `attachment.waveform !== null` / `duration !== null` are only populated for voice audio. Detect voice
  as `!text && attachment present` and prefer the flag check.
- URLs are time-sensitive — download promptly on the message event.

## R5 — Local end-to-end validation

- **Decision**: Isolate the pipeline into a pure function and drive it from a CLI harness
  (`scripts/transcribe-local.mjs`) that reads `fixtures/test.opus`, runs the real
  convert→whisper steps, then calls a **stub forward target** (the only mock — there's no real channel
  to reply to on a laptop).
- **Rationale**: Exercises the exact production code path without any Discord connectivity.
- **Fixture source**: no reliable public `.opus` fixture exists; record a real voice clip in the Discord
  app (or synthesize with `ffmpeg -f lavfi -i sine ... -c:a libopus sample.opus`) and know its expected
  text for an assertable substring match.
- **Pitfall**: the "post reply to channel" step cannot run locally — inject responder seam + stub.

## Consolidated decisions

| Decision point | Chosen | Rationale |
|----------------|--------|-----------|
| Whisper runtime | `whisper-cli` subprocess (brew) | robust, no compile, portability |
| Opus→WAV | `ffmpeg-static` npm | static binary, macOS+alpine, one CLI form |
| Model default | `ggml-base.en.bin` (~148 MB) | speed/accuracy balance |
| Voice detection | `MessageFlags.IsVoiceMessage` + `!text` + attachment | reliable discriminator |
| Local test | `scripts/transcribe-local.mjs` + fixture + stub forward | exercises real pipeline offline |
| Deployed/cloud STT | OUT of scope | spec Assumptions |
