# Feature Specification: AWS App Runner Deployment (Text-First)

**Feature Branch**: `007-aws-apprunner-deploy`

**Created**: 2026-08-04

**Status**: Draft

**Input**: User description: "I think we should do the github runner + aws first... because right now I hope on github runner - at least the text should work"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get Text Replies Working on AWS (Priority: P1)

The Discord agent is currently hosted on Render, which fails to respond reliably to
plain text messages. The user wants the agent moved to an AWS free-tier host where
the **text** conversation path works reliably as the first milestone. Voice/audio
transcription is deferred so it does not burden the constrained host.

**Why this priority**: A bot that reliably answers text is the entire point of the
service. Without it nothing else (voice, research, skills) is usable, so this is the
single highest-value slice and can ship alone.

**Independent Test**: Deploy the agent to the AWS host, then send plain text messages
from Discord and confirm every message draws a useful agent reply promptly.

**Acceptance Scenarios**:

1. **Given** the agent is deployed to the AWS host **When** a user sends a plain text
   message in a Discord channel **Then** the agent replies with a substantive response.
2. **Given** the agent is deployed to the AWS host **When** the service restarts or
   re-deploys **Then** text messaging still works without manual intervention.
3. **Given** the host has limited CPU and no speech model configured **When** the
   user sends a plain text message **Then** the reply is not blocked or slowed by any
   voice/transcription processing.

---

### User Story 2 - Deploy Automatically from the Code Repository (Priority: P2)

Changes merged to the main code branch automatically build and deploy the agent to
the AWS host. The user does not manually push images or configure the host after the
first-time setup.

**Why this priority**: Automatic deployments keep the live bot in sync with the code
and remove a recurring manual step. It ranks P2 because a one-time deploy (US1) can
deliver value first, but automation is needed for sustainable iteration.

**Independent Test**: Merge a trivial change to the worker directory and confirm the
host automatically runs the new build without any manual action.

**Acceptance Scenarios**:

1. **Given** a change is merged to the main branch **When** the change touches the
   deployable service **Then** a new build is produced and deployed automatically.
2. **Given** a deployment is in progress **When** it fails **Then** the failure is
   visible/surfaced so it can be diagnosed, and the previous working version is not
   silently taken down.
3. **Given** the hosting service is reachable **When** a deployment completes **Then**
   the bot connects to Discord and answers text messages.

---

### User Story 3 - Voice Notes Are Handled Gracefully (Priority: P2)

While voice transcription is disabled on the constrained host, a user who sends a
voice note receives a clear, friendly explanation rather than a silent failure or an
error. Full voice transcription via an external service is a documented follow-up.

**Why this priority**: Voice notes are common in Discord, and a bot that silently
ignores them (or crashes) erodes trust. Even in text-first mode the experience must
stay graceful. It ranks P2 because it is not required for the text value to land.

**Independent Test**: Send a voice note to the bot and confirm it replies with the
"transcription off" guidance and that the bot continues working for later text messages.

**Acceptance Scenarios**:

1. **Given** voice/disabling is configured for the host **When** a user sends a voice
   note **Then** the bot replies with a clear message that transcription is off and to
   use text.
2. **Given** the bot answers a voice note with the notice **When** the user then sends
   a text message **Then** text messaging still works normally.

---

### Edge Cases

- What happens when the free-tier host's CPU is saturated (many concurrent messages)?
  The agent should remain responsive to text without crashing; requests may queue but
  not error.
- How does the system behave if the model provider key is missing at boot? The agent
  fails fast with a clear message rather than appearing online but silently broken.
- What happens if an automated deployment partially fails (image pushes but service
  update fails)? The previously running version stays live and the failure is surfaced.
- What happens when the bot cannot reach the required backend (e.g., project data)?
  The user receives a clear error instead of an indefinite "thinking" state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The agent MUST be hosted on a persistent always-on service that keeps
  the Discord connection alive and responds to text messages.
- **FR-002**: The system MUST automatically build and deploy changes from the main
  branch of the code repository to the AWS host.
- **FR-003**: The agent MUST reply substantively to plain text messages received in a
  Discord channel.
- **FR-004**: The system MUST support a text-only mode whereby voice notes are not
  transcribed but are answered with a friendly notice, and subsequent text messages
  keep working.
- **FR-005**: The deployment MUST NOT require storing long-lived credentials in the
  code repository; the pipeline authenticates to the host through short-lived
  credentials assumed from the repository's trust relationship.
- **FR-006**: The system MUST fail fast at boot if required access keys (Discord bot
  token, project-data access, model provider key) are missing, with a clear error.
- **FR-007**: A failed deployment MUST be surfaced/visible and MUST NOT silently
  remove the previously working version.
- **FR-008**: Voice transcription via an external service is a defined follow-up
  (out of scope for this feature's first milestone) and must not be required for text
  functionality.
- **FR-009**: The host MUST support an externally reachable health/liveness check so a
  monitoring service can keep it awake and detect downtime.

### Key Entities

- **Discord Bot Agent**: The always-on process that connects to Discord and produces
  replies. Has runtime settings (Discord token, project-data access, model key, and a
  text-only flag).
- **Container Image**: The deployable unit built from the code, produced on each
  automated build and stored in a private registry.
- **Persistent Host Service**: The AWS free-tier service that runs the image and keeps
  it reachable on a stable public endpoint.
- **Credential / Trust Role**: The identity the build pipeline assumes to push the
  image and update the host, scoped to the minimum permissions needed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of plain text messages sent to the bot receive a substantive reply
  (no dropped or unhandled messages) during a test window.
- **SC-002**: The bot answers a text message within a few seconds of sending under
  normal load.
- **SC-003**: A change merged to the main branch automatically produces a working
  deployment on the host without any manual action (rollout succeeds).
- **SC-004**: Sending a voice note never crashes or wedges the bot; the bot remains
  responsive to the next text message (0 voice-related outages).
- **SC-005**: The host remains continuously reachable (via the health check) so
  message handling is available around the clock.

## Clarifications

### Session 2026-08-04

- Q: Should the spec's documented host be updated from "AWS App Runner" to the deployed ECS Fargate infrastructure? → A: Yes — update to ECS Fargate, documenting that App Runner is closed to new customers.
- Q: After stable deploys via GitHub OIDC, should the static AWS access keys be deleted (FR-005)? → A: Keep the static keys for now — the user iterates on setup with multiple manual changes; OIDC is for CI, static key retained for CLI admin while iterating. Revisit deletion after setup stabilizes.

## Assumptions

- **The host is AWS ECS Fargate** (the original App Runner intent was retired because
  AWS closed App Runner to new customers; ECS was deployed instead). It provides a
  persistent, always-on service that runs the container from a private registry
  (ECR) with a public endpoint and health check.
- **Automated deployment is driven by the code repository's CI runner** using
  short-lived credentials (no long-lived keys stored in the repo). A static CLI
  admin key is kept locally while iterating on setup and should be deleted once the
  OIDC auto-deploy path is stable.
- **Text is the initial deliverable**; full voice transcription (via an external
  speech-to-text service) is a separately scheduled follow-up and out of scope here.
- **The container image already builds successfully** from the existing deployment
  directory; this feature focuses on hosting + automation, not packaging work.
- **A free external uptime/ping service** (or the platform's own probe) is used to keep
  the always-on host awake and to surface downtime.
- **Scope boundaries**: Browser/mobile clients, on-device transcription, and GPU-based
  model hosting are out of scope. Multi-region/backup hosting is out of scope.
