# groq-stt Specification

## Purpose

Transcribes Discord voice notes into agent-turn text via an external speech-to-text provider so the agent can respond to spoken instructions exactly as it does to typed messages, without ever storing or processing audio on the host.

## Requirements

### Requirement: Detect voice notes and route to transcription
The bridge SHALL recognize a Discord message as a voice note (audio attachment flagged as a voice message, or an audio attachment with no typed text) and SHALL route it to the transcription path.

#### Scenario: A voice note is sent
- **WHEN** a user sends a voice note with no accompanying typed text
- **THEN** the bridge routes it to transcription and does not treat it as a text message

#### Scenario: Unsupported or non-voice audio
- **WHEN** a message cannot be recognized as a supported voice note
- **THEN** the bridge replies with a clear user-facing notice and keeps running

### Requirement: Transcribe without storing or processing audio locally
The bridge SHALL perform transcription by passing the Discord attachment's URL to the transcription provider and MUST NOT write, buffer, or locally process any audio bytes; only the URL string and the returned transcript text transit the bridge.

#### Scenario: All audio stays off the host
- **WHEN** a voice note is transcribed
- **THEN** no audio bytes are written to the host's disk or read into the host's process

### Requirement: Turn transcript into a normal agent turn
On a successful transcript, the bridge SHALL enqueue the transcript text through the existing single-slot message queue and run the normal agent-reply path, so a voice note behaves exactly like a typed message (one note → one agent turn).

#### Scenario: Successful transcription yields a reply
- **WHEN** a voice note is transcribed successfully
- **THEN** the transcript is enqueued and the agent returns its normal, chunked reply to the transcript's content

#### Scenario: Burst of voice notes processed in order
- **WHEN** multiple voice notes arrive in quick succession
- **THEN** each is transcribed and answered serially in arrival order as its own independent agent turn

### Requirement: Prefer typed text over audio
When a message contains both typed text and an audio attachment, the bridge SHALL use the typed text and MUST NOT trigger the voice-transcription path.

#### Scenario: Message has text and audio
- **WHEN** a single message includes both typed text and an audio attachment
- **THEN** the typed text is processed normally and the voice path is not triggered

### Requirement: Fail gracefully without retry or fallback
If transcription fails (provider HTTP error, empty transcript, or silence), the bridge SHALL reply with a clear user-facing notice, log the event, and remain operational. It MUST NOT crash, retry, or fall back to an alternative transcription method.

#### Scenario: Provider returns an error
- **WHEN** the transcription provider returns an HTTP error or an empty transcript for a voice note
- **THEN** the user receives a clear notice (e.g. "transcription failed" / "I didn't catch that") and the bridge stays alive for subsequent messages

#### Scenario: Silent voice note
- **WHEN** a voice note contains no discernible speech
- **THEN** the user receives a "didn't catch that" style notice and no agent turn is run

### Requirement: Validate provider configuration
The bridge SHALL read the transcription provider API key from the environment (sourced from the app's `.env`), require and validate it before making a transcription call, and SHALL return a clean, categorized client response for transcription outcomes (success / error / empty).

#### Scenario: Missing provider key
- **WHEN** the provider API key is not configured in the environment
- **THEN** the bridge returns a clean error outcome that identifies the missing `GROQ_API_KEY` rather than crashing

#### Scenario: Provider key sourced from environment
- **WHEN** `GROQ_API_KEY` is set in the app's environment (`.env` on the box)
- **THEN** the bridge uses that key for the Groq STT call and no key is hardcoded or baked into the image

#### Scenario: Categorized transcription outcome
- **WHEN** a transcription attempt completes
- **THEN** the outcome is returned to the caller categorized as success, error, or empty