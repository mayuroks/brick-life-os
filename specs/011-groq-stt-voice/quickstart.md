# Quickstart: Groq STT Voice Notes — Validation Guide

**Feature**: `011-groq-stt-voice` | **Date**: 2026-08-06

Purpose: prove voice-note transcription works: (1) the real `url`-mode Groq STT call, and (2) the
bridge's classify-and-route decision (success/empty/error), before/alongside a live Discord check.
Manual acceptance per the prototype constitution; no test framework installed.

## Prerequisites

- Node.js ≥ 20 (the `deploy/discord-agent` runtime).
- An `GROQ_API_KEY` from Groq (required by the agent for the STT call).
- A publicly fetchable audio URL (or the local `fixtures/test.opus` uploaded to any CDN/host) for the
  STT call; a live Discord voice note for the end-to-end check.

## 1. Wire config + validate the real Groq STT call (FR-007, FR-002)

```text
cd deploy/discord-agent
cp .env.example .env          # add GROQ_API_KEY=...
npm install                   # node_modules already present for local runs
```

Run the standalone harness against a **real** public audio URL to prove `url` pass-through and the
classify logic — this is exactly the request `transcribeVoiceNote()` makes, no Discord needed:

```text
node scripts/transcribe-stt.mjs "https://<host>/test.opus"
```

**Expected**:
- Prints `status: success` and the transcript text (contains your known sentence).
- A `ls -la <cwd>` / `du` check shows **no audio file written to disk** — the harness only holds the
  URL string and the returned text (SC-001, FR-002).
- If the URL is unreachable/expired, prints `status: error` (does not crash; SC-003).

## 2. Simulate the failure classifications without a real note (FR-004, SC-003)

Drive `transcribeVoiceNote()`/`isVoiceMessage()` against stubbed responses (the harness's `--stub`
mode) for:

- **Groq HTTP error** (e.g. a `5xx`) → expect `error` branch → bridge would reply
  "Sorry, I couldn't transcribe..." and log; **no retry, no fallback**.
- **Empty transcript** (2xx, `{ text: "" }`) → expect `empty` → bridge replies
  "I didn't catch that — ..."; **no agent turn**.
- **Silence** (same as empty) → `empty` path.

```text
node scripts/transcribe-stt.mjs --stub=error
node scripts/transcribe-stt.mjs --stub=empty
```

**Expected**: each exits cleanly, prints its classification, and the bridge handler stays alive for
subsequent messages (SC-003).

## 3. Text-with-audio respects typed text (FR-006)

With the live bridge running, send a message that contains **both** typed text and an audio
attachment → the typed text is processed as a normal turn and **no** STT call is made (log confirms
no `transcribe` event). Deterministic by construction (`text` non-empty short-circuits).

## 4. Live Discord end-to-end (SC-001/002/004)

Start the bridge locally (or deploy new image) and, in a test channel:

1. **Happy path**: send a voice note with a known instruction → agent replies coherently to the
   transcript; one note → one turn; reply is chunked like a typed message; `df` / `du` shows no audio
   growth on the host.
2. **Burst**: send 3 voice notes in quick succession → each answered serially in arrival order as its
   own turn (reuses the global single-slot queue; SC-004).
3. **Failure**: send a note while Groq is unreachable (or an expired-URL scenario) → clear
   "transcription failed" notice; bridge processes the next message fine (SC-003).

**Deployment plumbing to verify on the host** (delegate live install/test/verify to a sub-agent per
constitution V): `Dockerfile` no longer sets `DISABLE_VOICE=1`; `task-def.json` carries the
`GROQ_API_KEY` SSM secret; boot fails fast if the key is missing (FR-007).

## Related contracts

- Transcription seam (classifications + caller responsibilities): `contracts/transcribe-api.md`
- Transient data shapes: `data-model.md`
