# Feature Specification: Render Dashboard Hosting

**Feature Branch**: `013-render-dashboard-hosting`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "Feature 2 - Dashboard will be hosted on render.com"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publicly accessible live dashboard (Priority: P1)

The Life Map dashboard (from Feature 1) is reachable at a stable public URL hosted on render.com. The user opens that URL in any browser and sees the live Jira-powered dashboard without running anything locally.

**Why this priority**: Hosting is the whole point of Feature 2 — the dashboard must be usable outside the developer's machine. Without a reachable URL there is no delivered value.

**Independent Test**: Open the deployment's public URL in a fresh browser/incognito window and confirm the live dashboard loads over HTTPS. Delivers an always-on, shareable dashboard.

**Acceptance Scenarios**:

1. **Given** the dashboard is deployed to render.com, **When** the user opens its public URL, **Then** the live Jira dashboard loads over HTTPS with no certificate warnings.
2. **Given** the deployed instance has valid Jira credentials, **When** the page loads, **Then** it displays live Jira projects/Epics/Stories (same behavior as Feature 1).
3. **Given** the deployment is healthy, **When** the user refreshes the page days later, **Then** it still serves current Jira data.

---

### User Story 2 - Updates reach production automatically (Priority: P2)

When the dashboard code changes and is merged, the change reaches the hosted site without the user manually reconfiguring or re-uploading anything on Render.

**Why this priority**: Keeps the hosted site in sync with the source of truth and avoids brittle manual deploys. A small, high-value layer on top of the working deployment.

**Independent Test**: Push a trivial dashboard change to the tracked branch and confirm the deployed URL reflects it after the automated rebuild. Delivers a self-updating hosted dashboard.

**Acceptance Scenarios**:

1. **Given** a tracked code change is pushed, **When** the hosting service rebuilds, **Then** the public URL serves the updated version.
2. **Given** a change is pushed, **When** the deployment fails to build, **Then** the previous working version remains live (no broken site).

---

### User Story 3 - Credentials stay out of the code (Priority: P3)

The Jira token required to fetch data is provided to the hosted site through deployment settings, not committed to version control, so the repository stays safe to share.

**Why this priority**: The token is a secret; a public-hosted project must not leak it. This is the hardening layer on the deployment.

**Independent Test**: Inspect the repository and the fetched pages served by the hosted instance; confirm no Jira token appears in either. Delivers a deployable project that can be pushed/committed safely.

**Acceptance Scenarios**:

1. **Given** the hosted dashboard is deployed, **When** it serves pages, **Then** the pages contain no Jira token or credentials.
2. **Given** the repository, **When** credentials need to rotate, **Then** they can be updated in the hosting environment and take effect without a code change or new commit.

---

### Edge Cases

- What happens if the Jira token is missing or expired on the hosted instance? (Dashboard shows a readable auth error rather than crashing)
- What happens if the app crashes at runtime? (Hosting restarts it automatically and it returns to service)
- What happens if a deploy build fails? (Previous working version stays live)
- What happens if the hosting tier spins the service down after inactivity? (First load may be slower but the page still loads when accessed; acceptable for v1)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The dashboard MUST be deployed and publicly reachable at a stable HTTPS URL hosted on render.com.
- **FR-002**: The hosted instance MUST fetch live Jira data (same behavior as Feature 1) rather than serving static sample data.
- **FR-003**: Jira credentials (URL, username, token) MUST be supplied via deployment/runtime environment settings, NOT committed to the repository.
- **FR-004**: Credentials MUST be updatable in the hosting environment without a code change or redeploy of credentials.
- **FR-005**: Changes to the tracked dashboard code MUST reach the public URL through the hosting service's deploy flow.
- **FR-006**: The hosting service MUST monitor app health and restart the service automatically on failure.
- **FR-007**: A failed build/deploy MUST NOT take down the currently running version.
- **FR-008**: The served dashboard pages MUST contain no Jira token or credential material.

### Key Entities *(include if feature involves data)*

- **Hosted Environment**: The render.com deployment settings (public URL, environment variables, health/liveness configuration, start command). Holds secrets; not part of git.
- **Deployment**: A build + release of the dashboard code to the hosted environment; maps repo changes to the live public URL.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open the public render.com URL and see the live Jira dashboard load successfully.
- **SC-002**: The site is served over HTTPS with no certificate warnings in a standard browser.
- **SC-003**: No Jira token appears in the repository or in any served page.
- **SC-004**: A rotated Jira token takes effect on the hosted instance without a code change or new commit.
- **SC-005**: After a runtime crash, the service returns to serving the dashboard without manual intervention.
- **SC-006**: A merged code change reaches the public URL without manual server configuration.

## Assumptions

- The dashboard from Feature 1 (Jira fetch + omni-compass template) exists before/alongside this deployment work; this feature assumes that application is available to host.
- The render.com free/hobby tier is sufficient for this single-user personal prototype; cold-start latency after idle spin-down is acceptable for v1.
- A single-region, publicly accessible deployment is sufficient; no high-availability/replication requirements for v1.
- Continuous deployment from the repository's default branch; no staged/multi-environment pipeline in v1.
- Credentials are configured once in the hosting environment (e.g., env vars) using the existing Jira site URL, username, and API token from this project's local config.
