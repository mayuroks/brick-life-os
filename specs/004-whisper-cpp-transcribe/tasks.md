---

description: "Task list for Whisper speech transcription (voice messages on Discord bridge)"
---

# Tasks: Whisper Speech Transcription

**Input**: Design documents from `/specs/004-whisper-cpp-transcribe/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: None required. Per the prototype constitution, tests are optional; validation is manual via
`quickstart.md`. This feature uses no automated test tasks.

**Organization**: Tasks grouped by user story for independent, parallel sub-agent execution. All work is
inside `deploy/discord-agent/` (the live Discord bridge that currently drops voice messages at
`if (!text) return;`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1/US2/US3 (maps to spec.md user stories)
- Paths are relative to `deploy/discord-agent/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Local runtime deps and model. Everything here is independent — run all as parallel
sub-agents.

- [X] T001 [P] Add `ffmpeg-static` to `deploy/discord-agent/package.json` (`npm install ffmpeg-static`) and verify a static ffmpeg binary is available on macOS arm64 (`node -e "console.log(require('ffmpeg-static'))"`)
- [X] T002 [P] Install whisper.cpp CLI locally via Homebrew (`brew install whisper-cpp`) and verify `whisper-cli --help` runs
- [X] T003 [P] Create `deploy/discord-agent/scripts/download-whisper-model.mjs` that fetches `ggml-base.en.bin` from `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin` into `deploy/discord-agent/models/` (idempotent; skip if present); run it so `models/ggml-base.en.bin` exists
- [X] T004 [P] Add optional `WHISPER_MODEL`, `WHISPER_BIN`, `WHISPER_TIMEOUT_MS` keys (documented, NO values) to `deploy/discord-agent/.env.example`

**Checkpoint**: ffmpeg binary, whisper-cli, and model all present locally.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The transcription pipeline module all user stories depend on. Must complete before any
story. These two tasks touch different files and run in parallel.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Implement `deploy/discord-agent/src/transcribe/transcribe.js` per `contracts/transcribe-api.md`: `isVoiceMessage(message)`, `transcribeVoiceMessage(attachment, opts)` returning `{status:'success'|'no-speech'|'error', text}`, `whisperBinPath()`/`whisperModelPath()`; include `downloadAttachment` (`fetch(url,{redirect:'follow'})`), Opus→16kHz mono WAV conversion via `ffmpeg-static` (`-ar 16000 -ac 1 -c:a pcm_s16le`), `whisper-cli -m <model> -f <wav> -otxt -of <tmpbase>` reading `<tmpbase>.txt`, temp-file cleanup in `finally`, and abort→`{status:'error'}` after `WHISPER_TIMEOUT_MS` (default 120000); empty whisper output → `{status:'no-speech', text:''}`; never throw for bad audio
- [X] T006 [P] Extend `deploy/discord-agent/src/config.js` to optionally resolve `WHISPER_BIN`, `WHISPER_MODEL`, `WHISPER_TIMEOUT_MS` (defaults: `whisper-cli`, `./models/ggml-base.en.bin`, `120000`) without making them required secrets

**Checkpoint**: Foundation ready — `transcribe.js` exists and is importable; story work can start.

---

## Phase 3: User Story 1 - Transcribe Voice → Agent Reply (Priority: P1) 🎯 MVP

**Goal**: A Discord voice message (empty text + audio) is transcribed and forwarded to the agent, which
replies in the channel via the normal queue.

**Independent Test**: Send a real voice message in a live channel (or route a fixture through the
handler) and confirm the agent's reply reflects the spoken content; transcript appears in logs.

**Note**: T007–T008 edit `src/bridge/client.js` sequentially (same file). Run them as one sub-agent; do
NOT split this file across parallel agents.

### Implementation for User Story 1

- [X] T007 [US1] Modify `deploy/discord-agent/src/bridge/client.js` `messageCreate`: when `!text` and `isVoiceMessage(message)` is true, enqueue a job (same per-channel `queue`) that calls `transcribeVoiceMessage(...)`, and on `success` runs `runAgent(cfg.serveUrl, transcript)` then replies via the existing rotating-status flow; keep the existing bot/bot-ignore and empty-typed-text behavior unchanged
- [X] T008 [US1] Add voice status handling in `deploy/discord-agent/src/bridge/client.js` (reply with a status before transcribing, e.g. reusing `startStatus`), and update the `state.agentUp`/error flow so the new voice path reports status the same way as typed messages

**Checkpoint**: US1 fully functional and testable independently (voice → transcript → agent reply).

---

## Phase 4: User Story 2 - Graceful Failure on Bad Audio (Priority: P2)

**Goal**: Unsupported/empty/corrupt audio gets a clear, friendly reply instead of a hang or crash.

**Independent Test**: Feed blank/near-silent audio (or set a bad `WHISPER_BIN`) through the handler/harness
and confirm a friendly "didn't catch that" or error reply; bot keeps running for the next message.

**Note**: T009 edits the same `src/bridge/client.js` already touched by US1 — run this sub-agent AFTER
US1's bridge edits land to avoid a file conflict.

### Implementation for User Story 2

- [X] T009 [US2] In `deploy/discord-agent/src/bridge/client.js`, handle `transcribeVoiceMessage` results: `no-speech` → reply "I didn't catch that — try a text message or speak up."; `error` → log the cause and reply a friendly one-liner (FR-004/FR-005); ensure neither case throws or leaves the channel queue stuck

**Checkpoint**: US1 + US2 work independently; bad audio never hangs or crashes.

---

## Phase 5: User Story 3 - Local Validation (Priority: P2)

**Goal**: Prove transcription end-to-end locally with no Discord connectivity.

**Independent Test**: `node scripts/transcribe-local.mjs fixtures/test.opus` prints transcript steps and
the stub forward receives the spoken text in seconds.

**Note**: T010–T011 are separate files and fully parallel.

### Implementation for User Story 3

- [X] T010 [P] [US3] Create `deploy/discord-agent/scripts/transcribe-local.mjs` harness: read a fixture `.opus`, call the real `transcribeVoiceMessage` (same module as the bridge), and print downloaded/converted/transcribed steps; instead of posting to a channel, use a stub forward that prints and asserts the expected substring (inject the responder seam per `contracts/transcribe-api.md`; report `no-speech`/`error` clearly)
- [X] T011 [P] [US3] Create `deploy/discord-agent/fixtures/test.opus` — a real Discord voice clip (Save-audio) or synthesized (`ffmpeg -f lavfi -i "sine=frequency=440:duration=3" -c:a libopus fixtures/test.opus`); record the expected spoken text in a `fixtures/README.md` so the harness can assert a substring

**Checkpoint**: US3 delivers the local validation harness from `quickstart.md`; all stories independently
functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Wrap-up affecting the whole feature.

- [X] T012 Add `fixtures/` (and optionally `models/`) to `deploy/discord-agent/.gitignore` — never commit a personal voice recording or a 148MB model
- [X] T013 Run every step of `specs/004-whisper-cpp-transcribe/quickstart.md` end-to-end and confirm all scenarios (success, no-speech, error) pass
- [X] T014 Update `deploy/discord-agent/README.md` (and `HANDOVER-*.md`) noting voice transcription is LOCAL-only in this feature; deployed/cloud STT is a separate later feature

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — all `[P]` tasks start immediately in parallel.
- **Foundational (Phase 2)**: Depends on Phase 1 (ffmpeg/whisper/model present). BLOCKS all stories.
- **US1 (Phase 3)**: Depends on Foundational.
- **US2 (Phase 4)**: Depends on Foundational + US1 bridge edits (same file).
- **US3 (Phase 5)**: Depends on Foundational only — independent of US1/US2.
- **Polish (Phase 6)**: Depends on all stories.

### User Story Dependencies

- US1 (P1): starts after Foundational; no story-level deps.
- US2 (P2): starts after US1 bridge edits (file-conflict-ordered).
- US3 (P2): starts after Foundational; independent of US1/US2 — can run concurrently with US1.

### Parallel Opportunities

- Phase 1: T001, T002, T003, T004 fully parallel (4 sub-agents).
- Phase 2: T005, T006 parallel (2 sub-agents).
- US1 + US3 in parallel (bridge edits vs harness+fixture — distinct files) = up to +2 sub-agents.
- US2 after US1 bridge edit has landed.

**Constitution note (Principle V)**: installs/verification in Phase 1 (ffmpeg, brew, model download) and
the `quickstart` run (T013) MUST be delegated to sub-agents, ≤3 at once, with the primary agent reporting
results rather than blocking.

---

## Parallel Example (max throughput)

```bash
# Wave 1 — Setup (4 parallel sub-agents):
Task: "T001 add ffmpeg-static to deploy/discord-agent/package.json"
Task: "T002 brew install whisper-cpp"
Task: "T003 create + run download-whisper-model.mjs"
Task: "T004 document WHISPER_* vars in .env.example"

# Wave 2 — Foundational (2 parallel sub-agents):
Task: "T005 implement src/transcribe/transcribe.js"
Task: "T006 extend src/config.js with WHISPER_* optional fields"

# Wave 3 — Stories (US1+US3 in parallel; US2 after US1's bridge edit):
Task: "T007/T008 wire voice path into src/bridge/client.js (single agent)"
Task: "T010 create scripts/transcribe-local.mjs"
Task: "T011 create fixtures/test.opus"
>>> after US1 bridge edit: T009 US2 failure handling in src/bridge/client.js

# Wave 4 — Polish:
Task: "T012 gitignore fixtures/models", "T013 run quickstart.md", "T014 update README/HANDOVER"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup (parallel)
2. Phase 2 Foundational (parallel)
3. Phase 3 US1 — voice → transcript → agent reply
4. **STOP and VALIDATE** US1 via a live voice message (or fixture through the handler)

### Incremental Delivery

1. Setup + Foundational → pipeline module ready.
2. US1 → MVP (voice now works).
3. US3 harness → offline validation path.
4. US2 → graceful failure.
5. Polish.

### Parallel Team Strategy

- Stage 1: Setup across 4 sub-agents.
- Stage 2: Foundational across 2 sub-agents.
- Stage 3: US1 (bridge) + US3 (harness/fixture) in parallel; US2 queued on US1's file.
- Stage 4: Polish.

---

## Notes

- `[P]` = different files / no unfinished dependencies. **Shared-file rule**: `src/bridge/client.js` is
  touched by T007/T008 (US1) and T009 (US2) — never edit it from two parallel agents at once.
- No automated test tasks — validation is manual per `quickstart.md`.
- Commit after each task or logical group.
- `fixtures/` holds a personal voice recording — do NOT commit without explicit consent (T012).

---

## Phase 7: Convergence

**Purpose**: Close the gap between intent and proof — the code implements all requirements but was
validated only with synthesized audio offline; a real Discord-recorded voice message and the live
"reply in channel" loop are unverified.

- [X] T015 [HIGH] Validate FR-006/SC-002/US3 with a **real** Discord-recorded voice message: capture/save an actual Discord voice-message `.opus` (Discord app "Save audio", or fetch the CDN url), run it through `deploy/discord-agent/scripts/transcribe-local.mjs` with an `EXPECT_TRANSCRIPT` assertion, and confirm a usable, forwarded transcript (keep the real clip out of git — `partial`)
- [X] T016 [MEDIUM] Verify SC-001/US1/AC1+AC2 end-to-end on a live server: with `DISCORD_BOT_TOKEN` (MESSAGE_CONTENT intent) and a server, run `deploy/discord-agent/` locally, send a real voice message, and confirm the bridge transcribes, forwards to the agent, and posts the agent's reply in the same channel (`partial`)
