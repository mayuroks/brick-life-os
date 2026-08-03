# Quickstart: Whisper Speech Transcription — Local Validation Guide

**Feature**: `004-whisper-cpp-transcribe` | **Date**: 2026-08-03

Purpose: prove voice transcription works **locally** on macOS end-to-end, before any deployment.
Manual acceptance checks suffice per the prototype constitution.

## Prerequisites

- Node.js 20+ (the `deploy/discord-agent` runtime).
- Homebrew (`brew`) on macOS (Apple Silicon).
- A sample **Discord voice message** `.opus` clip — see Step 0.

## 0. Get a fixture voice clip

```text
# Option A (real): record a voice message in the Discord app and "Save audio".
#   Save it as deploy/discord-agent/fixtures/test.opus. Keep note of the exact sentence you said
#   (you'll assert a substring of it).
# Option B (synthetic, pipeline-only): generate an Opus clip from local audio:
ffmpeg -f lavfi -i "sine=frequency=440:duration=3" -c:a libopus deploy/discord-agent/fixtures/test.opus
```

**Note**: `fixtures/` is git-ignored — a voice recording is personal; don't commit it without consent.

## 1. Install the two local dependencies (FR-005 wiring)

```text
cd deploy/discord-agent
npm install ffmpeg-static          # static ffmpeg binary (Opus -> WAV)
brew install whisper-cpp           # whisper-cli (Apple Silicon prebuilt)
node scripts/download-whisper-model.mjs   # fetch ggml-base.en.bin -> models/
```

**Expected**: `whisper-cli --help` runs; `models/ggml-base.en.bin` exists.

## 2. Run the local end-to-end harness (FR-006, SC-001/002/004)

```text
node scripts/transcribe-local.mjs fixtures/test.opus
```

**Expected**:
- Console prints the transcription pipeline steps (`downloaded → converted → transcribed`).
- The stub forward target prints/receives the **transcribed text** — the real convert→whisper code path
  ran, offline, with no Discord needed.
- For the known sentence: the printed text contains your expected (sub)string.
- Total time for a short clip is **seconds**, not minutes (SC-004).

## 3. Edge cases (FR-004, FR-005, SC-003)

```text
# empty/near-silent audio:
node scripts/transcribe-local.mjs fixtures/blank.opus
```
**Expected**: reports `no-speech`; the stub receives no forward; message maps to "I didn't catch that".

```text
# missing binary/model (simulate):
WHISPER_BIN=/nonexistent node scripts/transcribe-local.mjs fixtures/test.opus
```
**Expected**: reports `error` gracefully, no crash (FR-005); bridge would reply + log.

## 4. (Optional) Confirm the live handler ignores text-bearing messages

Start the live bridge and send a normal typed message — it behaves exactly as before (typed text wins;
voice only transcribed when text is empty). Add a voice message via a real channel if available to
confirm the full `messageCreate` → transcribe → reply flow.

## Related contracts

- Transcription seam: `contracts/transcribe-api.md`
- Transient data shapes: `data-model.md`
