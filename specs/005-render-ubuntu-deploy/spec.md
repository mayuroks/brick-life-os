> **[LEGACY/ARCHIVED] — historical spec for a retired host path, superseded by the EC2 single-box native deploy (`deploy/ec2-single-box/` + `deploy/README.md`). Kept as audit history — do not follow. Region is `ap-south-1`, host is a 1GB+2GB-swap `t3.micro`.**

# Feature Specification: Render Ubuntu Cloud Deployment

**Feature Branch**: `005-render-ubuntu-deploy`

**Created**: 2026-08-03

**Status**: Draft

**Input**: User description: "create a Dockerfile and other necessary file. we will run this render now ubuntu 26 lts"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run the Bot 24/7 in the Cloud With Voice Messages (Priority: P1)

The Brick bot runs as a long-lived cloud service (Render), built from an Ubuntu LTS-based image. It
handles normal text messages **and** voice messages — including transcribing voice notes in the cloud
(the capability that up to now was local-only). A user on Discord sends a typed or voice message at any
hour and gets an agent reply in the same channel.

**Why this priority**: This is the whole point of "run this on Render now." Without a cloud deployment
the bot only works when the laptop is on. Bringing voice transcription into the cloud restores parity
with the local version and is the primary user value.

**Independent Test**: Deploy the service to Render, confirm the Discord bot is online, then send a
text message and a voice message; both must receive an in-channel agent reply.

**Acceptance Scenarios**:

1. **Given** the service is deployed to Render, **When** the bot boots, **Then** it connects to Discord
   and replies to text messages in the same channel.
2. **Given** a user sends a voice message via Discord, **When** the deployed bot receives it,
   **Then** it transcribes the audio and posts an agent reply in the same channel.
3. **Given** the cloud service restarts (or is redeployed), **When** it boots again, **Then** it
   recovers to the same working state without manual intervention.

---

### User Story 2 - Secure, Reproducible Cloud Build (Priority: P1)

The cloud image is built from a defined, reproducible base (Ubuntu LTS) using the project's own
container definition and dependency lockfiles. All secrets are injected at runtime as environment
variables — nothing secret is baked into the image or committed to the repo.

**Why this priority**: A security or reproducibility failure would invalidate the deployment regardless
of feature completeness; it is a baseline for shipping to the cloud.

**Independent Test**: Build the image from a fresh checkout following the provided definition; confirm
it builds reproducibly and that no secret text or secret files exist inside the built image or the repo.

**Acceptance Scenarios**:

1. **Given** a fresh clone and the container definition, **When** the image is built, **Then** the
   build succeeds with no external ad-hoc steps.
2. **Given** the built image, **When** inspected for secrets, **Then** no credentials, tokens, or
   secret-filled files are present; secrets come only from runtime environment variables.
3. **Given** a missing required secret at container start, **When** the service boots, **Then** it
   fails fast with a clear message naming the missing value.

---

### User Story 3 - Voice Transcription Works in the Cloud Build (Priority: P2)

The cloud image includes the speech-to-text runtime and model so that voice messages are transcribed
on the server, matching the locally verified behavior. The service runs within the cloud provider's
resource limits (CPU, memory) and responds within a reasonable time.

**Why this priority**: Users value voice input in the cloud as much as locally; it is the differentiator
this build is enabling. It ranks P2 because a secure, working service (US1/US2) is the foundation.

**Independent Test**: After deployment, send a voice message and confirm the transcript matches what was
said (subject to model accuracy) and the reply arrives within a few seconds.

**Acceptance Scenarios**:

1. **Given** a voice message sent to the deployed bot, **When** transcribed on the server,
   **Then** the transcript is sensible and forwarded to the agent.
2. **Given** a voice message, **When** transcribed, **Then** the user receives the agent's reply within
   a reasonable time (seconds, not minutes) under normal load.
3. **Given** blank or unprocessable audio, **When** the deployed bot receives it, **Then** it replies
   gracefully without crashing.

---

### Edge Cases

- **Missing secrets at boot** — the container must fail fast with clear next steps, never half-run.
- **Unsupported/invalid audio** — must produce a friendly reply, never crash, matching local behavior.
- **Silent/blank audio** — must be treated as "nothing heard," not forwarded garbage.
- **Cloud architecture (CPU) mismatch** — speech/audio binaries and model must be built for the
  provider's CPU architecture; a mismatch must be caught at build time, not silently at runtime.
- **Constrainted memory** — the service must start and serve reliably within the chosen cloud plan's
  memory; the speech model must not cause out-of-memory restarts.
- **Provider restart/spin-down** — the service must come back to a working state automatically.
- **Provider sleep behavior** — a cold start must still produce a working bot (possibly slower first
  reply) without manual action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The service MUST run as a long-lived, always-on cloud web service that hosts the same
  Discord bridge and headless agent as the local version.
- **FR-002**: The service image MUST be built from a reproducible Ubuntu LTS base using a container
  definition (`Dockerfile`) and pinned dependencies, so the same image can be rebuilt identically.
- **FR-003**: The service MUST accept and reply to normal text messages in the same channel.
- **FR-004**: The service MUST accept voice messages and transcribe them server-side, forwarding the
  transcript to the agent and replying in the same channel.
- **FR-005**: All secrets MUST be supplied at runtime as environment variables; no secret value or
  secret-carrying file may be baked into the image or committed.
- **FR-006**: The container MUST fail fast at boot when required secrets are missing, with a clear
  message and next steps.
- **FR-007**: The service MUST expose a health check that the platform can probe to confirm availability.
- **FR-008**: The service MUST include the speech-to-text runtime and model required to transcribe,
  sized to run within the chosen cloud plan's memory.
- **FR-009**: On provider restart or redeploy, the service MUST automatically recover to a working
  state (connect to Discord, serve the agent, respond).

### Key Entities

- **Cloud service**: The long-lived deployment (Render web service) hosting the agent + Discord bridge.
- **Service image**: The reproducible Ubuntu-based container built by the container definition.
- **Runtime configuration**: Environment-variable supplied secrets and optional speech settings that
  tune the service without rebuilding.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After deploy, the bot appears online in Discord and a text message gets an in-channel
  reply within a short time (seconds) in normal conditions.
- **SC-002**: A voice message sent to the deployed bot is transcribed and answered with an agent reply
  in the same channel (100% of valid voice messages get a reply, not silence).
- **SC-003**: A fresh inspection of the built image and repo finds no secret values (0 secrets baked /
  committed).
- **SC-004**: Boot after a restart/redeploy reaches a working, replying state without manual action
  each time.
- **SC-005**: Speech transcription on the server completes in seconds (not minutes) for a typical
  short voice note within the plan's resource limits.
- **SC-006**: Blank or invalid audio produces a friendly "didn't catch that" / error reply and never
  crashes the service.

## Assumptions

- **Ubuntu LTS base**: The image is based on Ubuntu **26.04 LTS** (released; the user's explicit choice
  as of this spec's date), giving glibc compatibility for the speech/audio binaries.
- **Provider**: The cloud platform is Render; the service runs from a container definition checked into
  the repo (deploy root is `deploy/discord-agent/`).
- **Architecture**: The provider runs amd64 (x86_64) containers; all speech/audio binaries and the
  model must be amd64-compatible. Local (Apple Silicon) binaries are NOT reused in the image — the
  image builds its own amd64-runnable stack.
- **Voice transcription is now in cloud scope**: Unlike feature `004` (which was local-only), this
  feature ships server-side transcription to the cloud.
- **Secrets**: Supplied in the provider dashboard as environment variables (never committed). Runtime
  config (e.g., agent model, speech model, timeouts) uses documented optional variables with sensible
  defaults.
- **Resource limits**: The container must boot and serve reliably within the plan's CPU/memory; the
  speech model is chosen to fit. A lightweight English model is the default to stay within limits.
- **Prototype pragmatism (constitution IV)**: Keep the container minimal and working; do not gold-plate
  the platform config beyond what the bridge + agent + speech need.
