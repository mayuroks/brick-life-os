# Feature Specification: Voice-V2 — Discord Voice Notes via Groq STT

**Feature Branch**: `011-groq-stt-voice`

**Created**: 2026-08-06

**Status**: Draft

**Input**: User description: "011 groq stt" (voice notes transcribed via Groq's speech-to-text, URL pass-through). This is **voice-v2**: an upgrade of the earlier whisper.cpp-on-EC2 transcription, swapping the local model for Groq's STT API via URL pass-through.

## Clarifications

### Session 2026-08-06

- Q: Should this feature include re-enabling Discord voice messages, or is that handled separately? → A: Not "re-enabling" — earlier transcription ran on the hosted EC2 via whisper.cpp; this feature swaps that backend for Groq's transcribe API. Frame the whole thing as **voice-v2**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Transcribe a voice note and get an agent turn reply (Priority: P1)

A user sends a voice note in the Discord channel. The agent transcribes it (via Groq STT, replacing the old whisper.cpp-on-EC2 path) and responds to its content, exactly as it would to a typed message.

**Why this priority**: This is the entire feature. The prior voice path ran whisper.cpp on the EC2 host and was stripped in a thin-text refactor; restoring useful voice on a zero-storage host requires delegating transcription off-box. Without this story nothing is delivered.

**Independent Test**: Send a voice note containing a known instruction in a test
channel; verify the agent replies with a coherent answer to that instruction and
that no audio bytes ever touch the host's disk.

**Acceptance Scenarios**:

1. **Given** voice messaging is enabled and the agent is running, **When** a user
   records and sends a voice note, **Then** the note is transcribed and the agent
   returns a normal, chunked reply to the transcript's content.
2. **Given** an audio `.ogg`/Opus voice note is sent, **When** the bridge
   processes it, **Then** the response is produced from the transcript text and
   behaves exactly like a typed-message turn (one message → one agent turn).
3. **Given** a message contains both typed text AND an audio attachment, **When**
   the bridge processes it, **Then** the typed text is preferred and the voice
   path is not triggered.

---

### User Story 2 - Handle failed or silent transcription gracefully (Priority: P2)

If Groq cannot transcribe the note (HTTP error, empty transcript, or silence),
the agent tells the user clearly and keeps running — it does not crash, retry, or
fall back.

**Why this priority**: A personal bot must stay alive and give honest feedback on
unroutable input. This is table-stakes reliability but secondary to the happy-path
transcription itself.

**Independent Test**: Send a forced-failure voice note (or simulate a Groq error)
and verify the user receives a clear notice and the bridge remains operational for
subsequent messages.

**Acceptance Scenarios**:

1. **Given** Groq returns an HTTP error or an empty transcript for a voice note,
   **When** the bridge processes it, **Then** the agent replies with a clear notice
   (e.g. "transcription failed" / "I didn't catch that"), logs the event, and
   stays alive.
2. **Given** a voice note is silent, **When** the bridge processes it, **Then** the
   agent replies with a "didn't catch that" style notice and no agent turn is run.
3. **Given** a transient provider failure (e.g. a `5xx` from the STT API or a failed
   CDN-URL fetch), **When** the bridge forwards the note, **Then** the user receives the
   graceful-notice path and no retry or multipart fallback is attempted.

---

### User Story 3 - Process a burst of voice notes in order (Priority: P3)

Several voice notes sent in quick succession are each transcribed and handled as
their own independent agent turns, in arrival order, without audio ever being
buffered or chunked on the host.

**Why this priority**: Real usage produces bursts (e.g. a user rambling across a
few notes). This matters for correctness but is covered by the existing global
single-slot queue re-used in Story 1, so it is lower urgency.

**Independent Test**: Send three voice notes in quick succession; verify each is
transcribed and answered sequentially as its own turn, in arrival order.

**Acceptance Scenarios**:

1. **Given** multiple voice notes arrive in a burst, **When** the bridge processes
   them, **Then** each note is transcribed and processed through the global
   single-slot queue one at a time, preserving arrival order.
2. **Given** a burst of notes, **When** one note is long but within Discord's
   per-note cap, **Then** it is handled as a single note with no on-host chunking
   or local audio processing.

---

### Edge Cases

- What happens when Groq returns an HTTP error (e.g. a `5xx` while fetching the signed
  CDN URL)? → graceful-notice path; no retry/fallback (deferred to a future multipart
  amendment if fetch failures prove common).
- How does the system handle a voice note whose signed CDN URL has expired? → same
  graceful-notice path; bridge forwards the URL immediately after posting to keep
  the window small.
- What if a message has both text and audio? → typed text wins; voice path not
  triggered.
- What if the audio format is unsupported or exceeds Groq's limits? → graceful
  "transcription failed" notice; per-note length is far under the 25 MB limit.
- How are bursts backpressured? → serialized through the existing single-slot
  queue, same as a text burst.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect when a Discord message is a voice note (audio
  attachment, with voice-message flag) and route it to the transcription path.
- **FR-002**: The bridge MUST NOT store or process audio bytes locally — it only
  handles the Discord attachment's CDN URL and the returned transcript text; no
  audio ever reaches the host's disk or process.
- **FR-003**: On a successful transcript, the system MUST enqueue the transcript
  text through the existing global single-slot queue and run the normal
  status → agent → chunked-reply path, exactly as for a typed message.
- **FR-004**: If transcription fails (Groq HTTP error, empty transcript, or
  silence), the system MUST reply with a clear user-facing notice and MUST NOT
  crash, retry, or fall back to an alternative transcription method.
- **FR-005**: Each voice note MUST be handled as one independent agent turn, in
  arrival order; the system MUST NOT batch multiple notes into one turn or chunk
  audio on the host.
- **FR-006**: The system MUST prefer typed text over audio when a message contains
  both (voice path not triggered).
- **FR-007**: The system MUST validate/require the Groq API key configuration and
  MUST return a clean client response categorizing the outcome as
  success / error / empty.

### Key Entities

- **VoiceNote / Attachment**: A Discord voice note carrying a signed CDN URL
  (`attachment.url`); the only data that leaves the bridge is this URL string.
- **Transcript**: The text returned by the transcription provider; becomes the
  agent turn input.
- **BridgeConfig**: Holds the transcription provider API key used to authorize
  the STT call.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can send a voice note and receive a coherent agent reply to
  its content, with zero audio bytes written to the host's disk (verified by
  filesystem check) — 100% of happy-path test notes.
- **SC-002**: Voice notes behave identically to typed messages (one note → one
  agent turn), with no change to the letter-day behavior of typed-message turns.
- **SC-003**: 100% of forced transcription failures (HTTP error, empty transcript,
  silence) produce a clear user-facing notice and leave the bridge alive
  for subsequent messages.
- **SC-004**: A burst of voice notes is responded to serially in arrival order,
  each as its own turn, without host-side audio processing or disk usage.
- **SC-005**: No new host dependencies are required for audio (no local
  transcription model, no audio processing runtime) — the bridge stays thin and
  low-memory.

## Assumptions

- This is **voice-v2**: the earlier whisper.cpp-on-EC2 transcription is superseded by Groq's STT; the voice path is rebuilt around URL pass-through rather than being a fresh "re-enable". If voice handling is currently inactive, bringing it onto the Groq STT path restores it as part of this feature.
- The transcription provider's STT endpoint accepts a `url` parameter and fetches
  the audio server-side; Discord attachments are `.ogg`/Opus within its supported
  formats and well under the max size.
- No retry/fallback on failure is desired (user's explicit choice); re-opening a
  multipart fallback is explicitly deferred and only considered if fetch failures prove
  common in practice.
- Transcription is a metered, paid third-party call; cost is acceptable for a
  personal single-user bot and is separate from the $0 AWS-month constraint.
- The existing single-slot queue and text-message flow are reused verbatim; no new
  queueing or messaging semantics are introduced.
