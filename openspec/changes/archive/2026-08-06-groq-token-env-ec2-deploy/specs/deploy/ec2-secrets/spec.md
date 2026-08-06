## Purpose

Governs how the EC2-hosted agent receives and updates runtime secrets (notably `GROQ_API_KEY`), so tokens are sourced from the app's `.env` and can be rotated on the box without redeploying code, with voice transcription enabled on the host.

## ADDED Requirements

### Requirement: Secrets sourced from the app .env
The EC2 deployment SHALL deliver the app's runtime secrets (including `GROQ_API_KEY`) from the `deploy/discord-agent/.env` file to the box, and the systemd service SHALL load that `.env` as its environment so the running process reads tokens from the environment, not from baked image config or hardcoded values.

#### Scenario: Box runs with secrets from .env
- **WHEN** the app is deployed to the EC2 box
- **THEN** the box's `discord-agent` service runs with `GROQ_API_KEY` (and all other `.env` secrets) loaded into its environment

#### Scenario: Missing .env on deploy
- **WHEN** `deploy/discord-agent/.env` is absent at deploy time
- **THEN** the deploy aborts with a clear error before pushing code, so a token is never silently dropped

### Requirement: Secrets-only refresh path
The deployment SHALL provide a lean, dedicated way to update only the secrets on the box (push the updated `.env`, then restart the `discord-agent` service) so a token rotation takes effect without re-rsyncing the application source.

#### Scenario: Rotate a token via secrets-only update
- **WHEN** a token in `.env` changes
- **THEN** running the secrets-only update pushes the new `.env` to the box and restarts the service, and the service comes up using the new token

#### Scenario: Service restarted when secrets change
- **WHEN** `.env` is replaced on the box through any deploy path
- **THEN** the `discord-agent` service is restarted so the changed secret actually takes effect (not left running with the stale value)

### Requirement: Voice enabled on the box
The EC2 deployment SHALL NOT disable voice transcription via a dead environment variable; the systemd unit SHALL leave the Groq STT path enabled so a configured `GROQ_API_KEY` can transcribe voice notes.

#### Scenario: Voice transcription available on box
- **WHEN** the agent is running on the EC2 box with `GROQ_API_KEY` set
- **THEN** sending a voice note triggers Groq STT transcription and the agent replies to the transcript

### Requirement: Local Docker smoke validation
The change SHALL provide a way to validate locally via Docker that the image builds, boots with the `.env`, and has `GROQ_API_KEY` present and visible to the runtime, before any cloud deploy.

#### Scenario: Local build boots with the key
- **WHEN** the `deploy/discord-agent` image is built and run locally with `.env` mounted
- **THEN** the process starts (health/liveness available) and `GROQ_API_KEY` is present in the runtime environment
