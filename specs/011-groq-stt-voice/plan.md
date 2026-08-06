# Implementation Plan: Voice-V2 — Discord Voice Notes via Groq STT

**Branch**: `011-groq-stt-voice` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-groq-stt-voice/spec.md`

**Note**: This plan is filled in by the `/speckit.plan` execution workflow.

## Summary

Voice-v2 restores Discord voice-note transcription on the `discord-agent` bridge by swapping the
stripped whisper.cpp-on-EC2 backend (removed in `f3d591c`) for **Groq STT via URL pass-through**.
When a voice note arrives, the bridge extracts only the Discord attachment's signed CDN URL and
calls `POST https://api.groq.com/openai/v1/audio/transcriptions` with `{ model, url }`; Groq fetches
the audio server-side and returns a transcript. The transcript then reuses the existing text flow
(global single-slot `ChannelQueue` →
`runAgent` → chunked reply) unchanged, so a voice note behaves exactly like a typed message —
one note → one turn, in arrival order, with **zero audio bytes ever touching the EC2 host** (FR-002).

Failures (Groq HTTP error, empty transcript, silence) take a graceful-notice path with no
retry and no fallback (FR-004), keeping the thin low-memory host intact (SC-005).

## Technical Context

**Language/Version**: Node.js ≥ 20 (ESM) — the existing `deploy/discord-agent` runtime.

**Primary Dependencies**:
- `discord.js ^14.15.3` (existing) — `MessageFlags.IsVoiceMessage`, `message.attachments` CDN URL.
- Native `fetch` (Node ≥ 18) — the only new runtime call: `POST /v1/audio/transcriptions` with JSON
  `{ model, url }`. **No** whisper/ffmpeg/audio libraries are added (SC-005).

**Storage**: N/A — the feature is stateless, pure URL-string → text. No audio, file, or model on disk.

**Testing**: No test framework is installed (constitution IV: tests optional). Validation is a
standalone STT harness script (`scripts/transcribe-stt.mjs`) + manual Discord acceptance checks per
`quickstart.md`.

**Target Platform**: ECS Fargate container (`node:24-slim`), amd64, 256/512 CPU/mem. Also runnable
locally on macOS under the same source.

**Project Type**: Single Node ESM service (web-service bridge).

**Performance Goals**: One extra network round-trip (CDN→Groq + Groq→text) on top of the agent turn;
sub-second-to-seconds STT for a ≤~5 min voice note; acceptable for a single-user bot.

**Constraints**:
- **Never touch the host with audio bytes** (FR-002): only a URL string and transcript text transit
  the EC2 process. No disk, no RAM for audio, no OOM risk (SC-004, SC-005).
- No retry / no fallback on failure (user choice; ADR-011 decision 5).
- Free-tier host stays thin (no local model/ffmpeg/audio runtime).
- Groq STT (`whisper-large-v3-turbo`) is a metered paid call (~$0.04/audio-hour) — separate from the
  $0 AWS-month constraint; accepted for a personal single-user bot.

**Scale/Scope**: Single personal bot, one Discord guild, low message volume (bursts of a few notes).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Relevant constitutional principles:

- **IV. Prototype Pragmatism (MUST)** — Prefer the smallest working thing; tests optional. ✅ The
  design reuses the existing queue/agent/chunking verbatim and adds one thin HTTP client; no new
  architecture, no gold-plating.
- **I. Jira is the Single Source of Truth** — The repo is the source; this voice path does not create
  commitments; the agent still drives Jira reads/writes through the unchanged text flow. ✅ No new
  Jira surface.
- **II. Agent Is the Interface / fixed persona** — Unchanged; voice becomes another way to issue the
  same agent commands. ✅
- **V. Sub-Agent Delegation** — Any install/test/verify during implementation is delegated to a
  sub-agent, not the primary loop. ✅ Noted for the tasks phase.
- **III. Motivation (fear/streaks)** — Not affected by this feature. ✅ n/a.

**Gates**:
- ✅ No new projects, no new repo, no scope expansion beyond already-ratified `011` spec.
- ✅ No billable AWS resources added (the only new cost is the metered Groq STT call — a third-party
  paid call explicitly approved in the spec Assumptions, not an AWS billable resource).
- ✅ Deferred items (multipart fallback on fetch failure) stay deferred per ADR-011.

**Post-design re-check**: See bottom of file after Phase 1.

**Complexity Tracking**: No gate violations → table left empty.

## Project Structure

### Documentation (this feature)

```text
specs/011-groq-stt-voice/
├── plan.md               # This file (/speckit.plan output)
├── research.md           # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── transcribe-api.md # Phase 1 output (Groq STT client contract)
└── tasks.md              # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

The feature is contained entirely inside `deploy/discord-agent/`. No new packages; one new module,
restoring voice to the existing `src/bridge/client.js`.

```text
deploy/discord-agent/
├── src/
│   ├── config.js                 # MODIFY: require GROQ_API_KEY (FR-007); drop voice-off plumbing
│   ├── transcribe/
│   │   └── groq.js               # NEW: isVoiceMessage() + transcribeVoiceNote(url) → {status,text}
│   └── bridge/
│       └── client.js             # MODIFY: route voice notes through groq, reuse queue/agent/chunking
├── scripts/
│   └── transcribe-stt.mjs        # NEW: standalone STT validation harness (real url-mode call + stubs)
├── fixtures/
│   └── test.opus                 # EXISTING fixture reused by the harness
├── .env.example                  # MODIFY: document GROQ_API_KEY
├── Dockerfile                    # MODIFY: remove DISABLE_VOICE=1 (voice now enabled)
└── task-def.json                 # MODIFY: + GROQ_API_KEY SSM secret, remove DISABLE_VOICE env
```

**Structure Decision**: Keep the existing single-package layout — the feature is a small, localized
change to one deployable. Adding a `src/transcribe/` subfolder (mirroring 004's pre-strip layout)
keeps the new HTTP client isolated from the bridge and testable in isolation, without reorganizing
the repo.

## Existing-flow touchpoints (must stay byte-identical)

- `src/bridge/client.js:110` `queue.enqueue(...)` — the voice path reuses this verbatim; only the
  pre-enqueue "payload resolution" changes (text vs. transcript).
- `src/agent/client.js` `runAgent(serveUrl, text)` — reused unchanged (FR-003).
- `chunkReply()` + status rotation — reused unchanged (FR-003).
- Text-with-audio → typed text wins; voice path not triggered (FR-006).

## Implementation outline (deferred detail to tasks.md)

1. `src/config.js` — add `GROQ_API_KEY` to the required-secrets check; expose `groqSttUrl` default
   `https://api.groq.com/openai/v1/audio/transcriptions`; remove the now-obsolete `disableVoice`.
2. `src/transcribe/groq.js` —
   - `isVoiceMessage(message)` → restore `MessageFlags.IsVoiceMessage` + attachment fallback.
   - `transcribeVoiceNote(message)` → take `message.attachments.first().url`, `fetch` to Groq with
     `{ method:'POST', body: JSON.stringify({ model, url }) }`; classify `success|empty|error` (FR-007).
3. `src/bridge/client.js` — in `messageCreate`, when `isVoiceMessage` and no text: enqueue, reply
   "Listening", transcribe; on `success` continue to `runAgent(transcript)`; on `empty`/`error`
   reply the graceful notice (FR-004) and return; never crash, never retry.
4. `scripts/transcribe-stt.mjs` — standalone harness to validate the real `url`-mode call against a
   public audio URL and to exercise classify logic with stub responses.
5. Deploy plumbing — `Dockerfile` (drop `DISABLE_VOICE=1`), `task-def.json` (add `GROQ_API_KEY` SSM
   secret), `.env.example` (document). Live verify on the ECS host is delegated to a sub-agent.

## Constitution Check — Post-Design Re-check

Re-evaluated after Phase 0/1 (research, data model, contracts, quickstart):

- ✅ **IV. Prototype Pragmatism** — still holds: one new thin module (`src/transcribe/groq.js`) + a
  localized bridge edit + config/deploy plumbing. Everything reuses the existing queue/agent/chunking.
- ✅ **I. Jira SSOT / II. Agent interface** — unchanged: voice just feeds the existing text flow into
  the fixed persona; no new commits surface.
- ✅ **V. Sub-Agent Delegation** — the deploy/verify step records a sub-agent delegation, keeping the
  primary loop responsive.
- ✅ **No new AWS billable resources** — the only new cost is the third-party Groq STT call
  (explicitly approved in spec Assumptions); host stays free-tier and thin.

No gate violations introduced by the design (confirming the Phase-0 check). **Complexity Tracking
table remains empty.**
