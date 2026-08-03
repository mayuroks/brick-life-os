# Implementation Plan: Whisper Speech Transcription

**Branch**: `004-whisper-cpp-transcribe` | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-whisper-cpp-transcribe/spec.md`

## Summary

Discord voice messages arrive as audio attachments (`.opus`/`.ogg`) with empty text; the bridge's
`messageCreate` handler drops them at `if (!text) return;` (FR-001 violation). This feature makes the
bridge **transcribe** a voice message locally — download the attachment, convert it to a 16 kHz mono
WAV, run whisper.cpp's `whisper-cli` on it, and forward the resulting text through the same queue →
agent → reply path as a typed message (FR-002, FR-003). Failed/silent transcriptions reply politely
instead of hanging (FR-004, FR-005). The work is tested **locally** on macOS via a CLI harness that
feeds a sample `.opus` through the real transcribe+forward code path (FR-006).

**Approach (from research):** whisper.cpp via the Homebrew-installed `whisper-cli` binary spawned as a
subprocess, `ffmpeg-static` (npm) for Opus→WAV conversion, and `ggml-base.en.bin` as the default model.
This keeps it dependency-light, CPU/Metal-fast on Apple Silicon, and (by using a serialized CLI seam)
swappable later for the deployed image.

## Technical Context

**Language/Version**: Node.js 20+ (ESM), matching the existing `deploy/discord-agent` codebase.

**Primary Dependencies**:
- `ffmpeg-static` (npm) — bundles a static ffmpeg binary for macOS arm64 (Opus→WAV).
- whisper.cpp `whisper-cli` — obtained via `brew install whisper-cpp` (prebuilt Apple Silicon bottle).
- Model: `ggml-base.en.bin` (~148 MB) downloaded from HuggingFace `ggerganov/whisper.cpp`.
- Existing: `discord.js` ^14, `dotenv`, `express`.

**Storage**: N/A. Audio is streamed to temp files in the OS temp dir and cleaned up after
transcription. No persistent storage.

**Testing**: Manual acceptance per the prototype constitution (start → send voice message / run local
harness → verify reply). A `scripts/transcribe-local.mjs` harness proves the pipeline end-to-end with a
fixture `.opus` and a stub forward target.

**Target Platform**: macOS local dev (Apple Silicon arm64) for this feature. Deployment (Render/alpine)
is explicitly OUT of scope per spec Assumptions.

**Project Type**: web-service add-on (Discord gateway bridge) + local CLI harness.

**Performance Goals**: A typical short voice note (~1 min) transcribes in seconds (base.en on Apple
Silicon ≈ 10–15 s CPU, faster with Metal); never blocks the per-channel queue beyond that, with a
sane timeout.

**Constraints**: Must not regress per-channel FIFO ordering; must fail gracefully on bad/empty audio;
must keep secrets out of the repo.

**Scale/Scope**: Single operator (developer) using the bridge locally. Deployed/cloud transcription is a
separate later feature.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Jira SSOT** — Not implicated; no new commitments created. Voice input becomes agent input which may
  itself create Jira issues as the agent already does. ✅
- **II. Agent Is the Interface** — Preserved and strengthened: voice messages now reach the agent instead
  of being silently dropped. ✅
- **III. Motivation Ethos** — Unaffected. ✅
- **IV. Prototype Pragmatism (MUST)** — Satisfied: smallest working thing (single CLI binary + one npm
  dep), optional manual tests, no gold-plating. ✅
- **V. Sub-Agent Delegation (MUST)** — Research delegated to 3 parallel sub-agents. Installation/verification
  of ffmpeg-static + whisper-cli + model download during implementation MUST also be delegated to sub-agents
  (≤3). ✅
- **Governance / Scope** — This is a NEW feature beyond the v1 ratified scope. **Justification:** it is a
  user-requested re-scope (explicit instruction to add voice transcription), recorded here and in the spec.
  It introduces no new surfaces or Jira mechanics. ✅

No violations beyond the documented re-scope; gate passes.

## Project Structure

### Documentation (this feature)

```text
specs/004-whisper-cpp-transcribe/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Created later by /speckit.tasks
```

### Source Code (deploy/discord-agent)

```text
deploy/discord-agent/
├── src/
│   ├── transcribe/
│   │   └── transcribe.js      # NEW: download + convert + whisper + orchestrate
│   ├── bridge/
│   │   └── client.js          # MODIFY: voice-message detection + transcribe path
│   └── config.js              # MODIFY: WHISPER_MODEL / WHISPER_BIN (optional)
├── scripts/
│   ├── transcribe-local.mjs   # NEW: local end-to-end harness (fixture -> stub)
│   └── download-whisper-model.mjs  # NEW: fetch ggml-base.en.bin once
├── fixtures/
│   └── test.opus              # NEW: real/synthesized Discord voice clip (git-ignored? see note)
├── package.json               # MODIFY: add ffmpeg-static
└── .env.example               # MODIFY: document optional WHISPER_* vars (no values)
```

**Structure Decision**: Follows the existing single-project layout inside `deploy/discord-agent`. The
transcription logic is isolated in `src/transcribe/transcribe.js` as pure, testable functions; the
Discord handler stays thin and just wires detection → transcribe → queue → reply. The local harness
(`scripts/transcribe-local.mjs`) lives beside the existing `scripts/bootstrap.js`.

Note: `fixtures/test.opus` is a real user-created clip (per research, no public fixture exists). It is a
small binary asset; because it is a personal voice recording, treat it as `gitignore`d by default and
document how to (re)create it — do not commit the user's voice without explicit consent.

## Complexity Tracking

> No constitution violations requiring justification (the only override is the user-requested re-scope,
> documented above; the "extra" local harness is explicitly part of the feature's scope to satisfy FR-006).
