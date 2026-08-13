# Feature Specification: Jira-Powered Life Map Dashboard

**Feature Branch**: `012-jira-dashboard`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "I created a template .lavish/omni-compass-hud.html. We have Jira token in this project. Create all this inside a life-map-dashboard folder. Feature 1 - call JIRA API and fetch the data to show this dashboard."

## Clarifications

### Session 2026-08-12

- Q: When the user clicks an Epic box or a project box, should the click open a view inside the dashboard, jump to that item directly in Jira, or both? → A: Option B - clicking an Epic opens its Jira issue page; clicking a project opens its Jira project page (deep-link navigation, no in-dashboard detail view).
- Q: What should "test this locally" do — static preview or a live server fetching real Jira data? → A: Option B – live dev server that fetches real Jira data (matching production behavior), with an explicit stop command.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Live Jira data drives the dashboard (Priority: P1)

The user opens the Life Map dashboard (".lavish/omni-compass-hud.html" template) and instead of the hard-coded sample data sees live data pulled from Jira. Each Jira project shows as a "project vector" row; its Epics appear as Gantt bars along the timeline; each Epic's Stories appear as a checklist when the Epic is opened. Progress percentages, story lists, and timeline placement are all computed from real Jira state.

**Why this priority**: The whole point of the feature is to stop hand-editing sample JSON and reflect the user's real Jira SSOT. Without live data there is no feature.

**Independent Test**: Point the dashboard at the Jira site, load it, and verify that the projects/epics/stories shown on screen match the actual open Epics in Jira. Delivers a dashboard that needs no manual data editing.

**Acceptance Scenarios**:

1. **Given** the dashboard is configured with valid Jira credentials, **When** the page loads, **Then** all configured Jira projects are listed as project vectors with their real names and epic counts.
2. **Given** at least one Epic exists in a project, **When** the timeline renders, **Then** that Epic appears as a Gantt bar positioned and sized by its start/end timeline dates.
3. **Given** an Epic with Stories, **When** the user clicks the Epic's Gantt bar, **Then** the modal lists those Stories and shows a completion rate that matches the proportion of Done Stories in Jira.
4. **Given** a Story is marked Done in Jira, **When** the dashboard data refreshes, **Then** the Epic's progress percentage increases accordingly.
5. **Given** the timeline is displayed, **When** the user clicks an Epic's Gantt bar, **Then** the browser navigates to that Epic's Jira issue page.
6. **Given** a project vector row, **When** the user clicks the project box, **Then** the browser navigates to that project's Jira project page.
7. **Given** the weekly or monthly timeline, **When** it includes the current real-world week or month, **Then** that column is visually highlighted with a darker shade than the others.

---

### User Story 2 - Fresh data on demand (Priority: P2)

The user can re-pull data from Jira without reloading the whole page so the dashboard stays current with the SSOT.

**Why this priority**: The SSOT changes constantly; staleness erodes trust in the dashboard. Refresh is a small, high-value addition on top of the P1 slice.

**Independent Test**: Change an Epic's status in Jira, trigger refresh, and confirm the dashboard reflects the change. Delivers currency without a full page reload.

**Acceptance Scenarios**:

1. **Given** the dashboard is showing data, **When** the user triggers refresh, **Then** the dashboard re-fetches from Jira and re-renders with the latest state.
2. **Given** a network or Jira outage during refresh, **When** the fetch fails, **Then** the user sees a clear error and the previously loaded data remains visible.

---

### User Story 3 - Secure credential handling (Priority: P3)

The Jira credentials used to fetch data are kept out of the browser and out of version control.

**Why this priority**: The token is already in this project's config but must never leak into client-side code or git history. This is a hardening story layered on the working fetch.

**Independent Test**: Inspect the served page and the repository diff; confirm no Jira token appears in either. Delivers a dashboard that can be shared/committed safely.

**Acceptance Scenarios**:

1. **Given** the dashboard is served, **When** the browser receives its HTML/JS, **Then** the response contains no Jira API token or credentials.
2. **Given** the repository, **When** a commit is inspected, **Then** the token is not present in tracked files (it is read from untracked/local configuration at runtime).

---

### User Story 4 - Test locally as a live server (Priority: P2)

The user can run the dashboard locally as a live dev server that fetches real Jira data (same behavior as the hosted site) to test it before deploying, and can stop that server with an explicit command once testing is done.

**Why this priority**: Local testing proves the real data path works before it is shared/hosted (Feature 2 depends on this). Live-fetch (not static preview) is needed so local behavior matches production.

**Independent Test**: Start the local dev server, load it in a browser, confirm it shows live Jira data, then stop the server with the stop command and confirm the port is released. Delivers a locally testable dashboard.

**Acceptance Scenarios**:

1. **Given** the dashboard is started as a local dev server, **When** the user opens it in a browser, **Then** it serves the dashboard with live Jira data (same behavior as Feature 1's fetch).
2. **Given** the local dev server is running, **When** the user issues the stop command, **Then** the server terminates cleanly and the local port is released.
---

### Edge Cases

- What happens when a Jira project has no Epics? (Render the project with zero epic tracks)
- What happens when an Epic has no Stories? (Show empty checklist, 0% progress)
- What happens when Epic date fields are missing? (Fall back to a default timeline band rather than breaking layout)
- What happens when the current real-world week/month falls outside the displayed timeline range? (No column is highlighted; no error)
- How does the system handle an expired/revoked Jira token? (Show a readable authentication error instead of a raw failure)
- How does the system handle Jira being unreachable? (Show a connection error and keep last-known data)
- How does the system stop the local dev server after testing? (An explicit stop command terminates it cleanly and releases the port)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST fetch projects, Epics, and Stories from the Jira REST API using the project's Jira credentials.
- **FR-002**: System MUST map each fetched Jira project to a dashboard "project vector" row showing its name and Epic count.
- **FR-003**: System MUST map each Jira Epic to a timeline Gantt bar positioned and sized from its start/end dates.
- **FR-004**: System MUST compute each Epic's progress percentage from the ratio of its Done Stories to all its Stories.
- **FR-005**: System MUST list each Epic's Stories in the Epic detail modal.
- **FR-006**: System MUST support manual refresh that re-fetches data and re-renders without a full page load.
- **FR-007**: System MUST render a readable error and retain last-known data when Jira is unreachable or the token is invalid.
- **FR-008**: System MUST keep Jira credentials out of the browser and out of tracked files.
- **FR-009**: System MUST tolerate empty projects, empty Epics, and missing date fields without breaking the layout.
- **FR-010**: v1 MAY scope which projects appear by the pre-resolved domain project keys (BF, FAM, HM, FIN, BR, BH, BS, MDP, ART).
- **FR-011**: System MUST navigate to an Epic's Jira issue page when the user clicks that Epic's Gantt bar.
- **FR-012**: System MUST navigate to a project's Jira project page when the user clicks a project vector box.
- **FR-013**: System MUST visually highlight the column corresponding to the current real-world week (weekly mode) or month (monthly mode) with a darker shade than other columns.
- **FR-014**: System MUST fetch and retain a Jira deep-link (URL) for each project and Epic so clicking navigates to the correct Jira page.
- **FR-015**: System MUST be runnable locally as a live dev server that fetches real Jira data (same behavior as the hosted/deployed site), enabling local testing.
- **FR-016**: The local dev server MUST be stoppable via an explicit command once testing is done.

### Key Entities *(include if feature involves data)*

- **Project**: A Jira project (one of the 9 life domains). Dashboard "project vector"; contains Epics; has name; carries a Jira project deep-link.
- **Epic**: A Jira Epic issue. Renders as a timeline Gantt bar; has title, start/end dates, progress, description, a Jira issue deep-link, and belongs to one Project.
- **Story**: A Jira Story/issue under an Epic. Shown as a checklist item in the Epic modal; drives Epic progress via its status (e.g., Done/not Done).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can load the dashboard and see live Jira projects, Epics, and Stories with no manual dataset editing.
- **SC-002**: Epic progress percentage matches Jira's Done-to-total story ratio exactly after a refresh.
- **SC-003**: A refresh completes and the dashboard reflects current Jira state within a few seconds on a normal connection.
- **SC-004**: When Jira is unreachable, the dashboard shows a readable error within the page and keeps the last-loaded data visible.
- **SC-005**: No Jira token or credential appears in the served page or in any tracked file.
- **SC-006**: A developer can start the dashboard locally as a live dev server fetching real Jira data and stop it with an explicit command.

## Assumptions

- The Jira credentials in this project (`opencode.json` JIRA_URL / JIRA_USERNAME / JIRA_API_TOKEN for https://mayurzenith.atlassian.net) are the source of credentials; they are read from local configuration at runtime, never committed.
- The dashboard lives in a new `life-map-dashboard/` folder, with the `.lavish/omni-compass-hud.html` template as the visual base.
- The timeline mapping reuses the template's weekday/week-month bands (Weeks 26-49 / July-December); Epic dates are mapped into that band, with sensible defaults when dates are absent.
- v1 targets the user's real Jira (9-domain project map) and does not add user-configurable multi-account or public/guest access.
- Per the Life OS constitution (prototype pragmatism), the smallest working local server + static dashboard is acceptable for v1; tests are optional where they save rework.
- Data volume is small (single personal Jira); no caching/scale requirements beyond keeping last-known data on fetch failure.
