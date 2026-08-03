# Feature Specification: Whisper Speech Transcription on Discord

**Feature Branch**: `004-whisper-cpp-transcribe`

**Created**: 2026-08-03

**Status**: Draft

**Input**: User description: "add the whisper C++ speech transcribe support. lets test it locally"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Transcribe a Voice Message and Get an Agent Reply (Priority: P1)

A user sends a **voice message** (audio attachment with no typed text) to the Discord bridge
instead of typing. The bridge recognizes that there is audio to act on, converts the speech to
text, and forwards that text to the agent exactly like a typed message. The user receives the
agent's normal reply (loading status, then the response) in the same channel.

**Why this priority**: Voice messages are currently silently ignored (empty text falls through
with no action). Making them work is the entire point of the feature — nothing else delivers
user value until audio gets transcribed and reaches the agent.

**Independent Test**: Send a voice message containing a known spoken phrase via
`[discord] msg ... @user` flow, run the bridge locally, and confirm the agent's reply reflects
the spoken content (e.g., transcript logged, reply posted to channel).

**Acceptance Scenarios**:

1. **Given** a user sends a voice message with no typed text, **When** the bridge receives it,
   **Then** the audio is converted to text and forwarded to the agent like a text message.
2. **Given** the transcription succeeds, **When** the agent processes the text, **Then** a normal
   reply (status then response) is posted back to the same channel.

---

### User Story 2 - Handle Audio That Cannot Be Transcribed (Priority: P2)

A user sends a voice message the system cannot transcribe (unsupported format, corrupt audio,
no speech detected, or local transcription not installed). The bridge fails gracefully instead
of hanging or crashing.

**Why this priority**: Real usage of voice messages will hit bad audio. A clean failure path
keeps the bridge reliable; it is secondary to the happy path.

**Independent Test**: Feed the locally running bridge an empty/blank/non-speech audio file and
confirm the user gets a clear "couldn't transcribe" message and the bridge keeps running for the
next message.

**Acceptance Scenarios**:

1. **Given** audio has no detectable speech, **When** transcription is attempted, **Then** the user
   receives a clear note that nothing was heard and the bot does not silently drop the message.
2. **Given** a required component (e.g., audio converter) is missing, **When** a voice message
   arrives, **Then** the bridge logs the issue and responds politely rather than crashing.

---

### User Story 3 - Verify the Feature Works Locally (Priority: P2)

The developer runs the bridge on their own machine (local mode), sends a voice message, and
confirms end-to-end transcription before anything is deployed.

**Why this priority**: The build must be validated on the developer's machine before shipping,
so "test locally" is a first-class part of this feature, not a follow-up.

**Independent Test**: Run the local bridge, send a real voice message, and observe the
transcribed text in the logs and the agent's reply.

**Acceptance Scenarios**:

1. **Given** the bridge runs in local mode, **When** the developer sends a voice message,
   **Then** the transcript is captured in logs and the agent replies correctly.
2. **Given** a transcribed voice message, **When** the transcript is inspected, **Then** it
   approximately matches what was spoken (usable, not necessarily perfect).

---

### Edge Cases

- Voice message with **no text but a very long audio** file — transcription must not block or
  time out the channel for an unreasonable time.
- Voice message posted **in a channel while another message is queued** — must process serially
  per channel (existing queue behavior preserved).
- Audio in a **different codec/container** than expected — should either convert or fail
  gracefully with a clear message.
- Message with **both typed text AND an audio attachment** — decide whether to use the typed
  text, the transcript, or both (assumption: use transcript when text is empty; see Assumptions).
- **No speech / silence** in the audio — treat as "nothing heard," not an error.
- Transcription **not installed / unavailable** (e.g., first local run) — graceful message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST recognize voice messages (audio attachments with empty or absent text)
  as actionable input, not ignore them.
- **FR-002**: System MUST convert the spoken audio into text (speech-to-text) and use that text
  as the message content sent to the agent.
- **FR-003**: System MUST process transcribed voice messages through the same queue, status, and
  reply flow as typed messages, so replies never interleave per channel.
- **FR-004**: When transcription produces no usable text, System MUST inform the user clearly
  (e.g., "I didn't catch that") instead of silently dropping the message.
- **FR-005**: When the transcription capability is unavailable or fails (missing component,
  unsupported audio), System MUST log the issue and reply gracefully without crashing.
- **FR-006**: System MUST support running and testing the feature locally with a real voice
  message before deployment.

### Key Entities

- **Voice message**: A Discord message carrying an audio attachment (speech) and no meaningful
  typed text; treated as a potential transcribable input.
- **Transcript**: The text produced from the spoken audio; becomes the effective message
  content for agent processing.
- **Channel queue**: The per-channel FIFO ordering that guarantees serial processing; voice
  transcriptions must respect the same ordering.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can send a voice message and receive an agent reply in the same channel,
  in the normal flow (100% of valid voice messages lead to a reply, not silence).
- **SC-002**: Transcription runs locally and a real voice message is transcribed and processed
  end-to-end, verified by the transcript appearing in logs.
- **SC-003**: Invalid or silent audio produces a friendly "didn't catch that" note and never
  crashes the bot (verified by test).
- **SC-004**: Transcription completes within a reasonable time (a typical short voice note
  transcribes within seconds, not minutes) in the local test environment.
- **SC-005**: Voice transcription reuses the existing per-channel serial queue so replies
  never interleave (verified by a burst of mixed typed + voice messages).

## Assumptions

- Transcription runs **locally within the bridge process** on the developer's machine for this
  feature; the shared/deployed environment is not part of this feature's scope (that's a later
  deployment step).
- For a message containing **both typed text and audio**, the typed text takes precedence and
  the audio is ignored; audio is only transcribed when the typed text is empty. (Documented
  default; can be revisited.)
- A lightweight/local speech-to-text model is acceptable as the v1 transcription source; exact
  accuracy is not guaranteed, only that it is "usable" (SC-002).
- The local test environment is the same machine used for development (Node/bridge runs
  locally as in the existing local-runnable mode).
- Secrets/API keys are supplied at runtime; nothing new requiring secrets is assumed for this
  feature since transcription runs locally.
