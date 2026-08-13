# Research: Jira-Powered Life Map Dashboard

Phase 0 output for `012-jira-dashboard`. Resolves the technical unknowns in the plan.

## 1. Runner runtime

- **Decision**: Node.js + Express server (`life-map-dashboard/server.js`), started via `node server.js` (`npm start`).
- **Rationale**: Matches the repo's only server precedent (`deploy/discord-agent`: Express + dotenv + `start` script on `node src/index.js`). Express trivially serves the static `omni-compass-hud.html` and adds a server-side `/api/jira` proxy — required so the Jira token never reaches the browser (FR-008). No build step keeps it small (constitution §IV).
- **Alternatives considered**: Plain `python -m http.server` — rejected: cannot proxy Jira server-side, so credentials would leak to the browser. Pure static CDN `index.html` — rejected: US1/US3 require live Jira fetch with secure credential handling.

## 2. Jira credential sourcing & security

- **Decision**: Three env vars — `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN` — loaded locally from a git-ignored `.env` via dotenv (ship `.env.example` with placeholders). All Jira calls happen server-side in the proxy; the browser receives only rendered data, never credentials (FR-008).
- **Rationale**: Same names as the project's existing Jira config in `opencode.json` (`https://mayurzenith.atlassian.net`) keeps the SSOT consistent; server-side proxy guarantees FR-008/SC-005. dotenv matches the discord-agent precedent.
- **Alternatives considered**: Fetch directly from the browser using the token — rejected (token leak, SC-005). Hardcode sample data with manual edits — rejected (US1 non-goal). Read `opencode.json` at runtime — rejected (couples the app to the agent config; not available on a deployed host).

## 3. Local live dev server (FR-015 / FR-016)

- **Decision**: Same Node server locally; start `npm start`, stop with Ctrl-C (SIGINT terminates the process and releases the port). The local run fetches real Jira data through `/api/jira`, matching production behavior.
- **Rationale**: Parameter parity with the hosted site means local testing validates the real data path (SC-006). Ctrl-C is the natural, zero-code stop command matching the user's "stop this local server" intent.
- **Alternatives considered**: A `/shutdown` admin route — rejected (unnecessary code, footgun if ever exposed publicly). Static preview with no fetch — rejected by the clarified decision (Option B: live fetch).

## 4. Serving + proxy shape

- **Decision**: Three routes — `GET /` (dashboard HTML), `GET /healthz` (liveness), `GET /api/jira` (server-side Jira proxy inlined into the template's expected project/epic/story shape).
- **Rationale**: One small server covers serving, health, and proxying; `/healthz` is reused by Feature 2's Render health check. Keeping the proxy route out of the browser preserves FR-008.
- **Alternatives considered**: Separate API service + static host — rejected (gold-plating for a single-user prototype).
