# Contract: Runtime Environment Variables

Defined and owned by **012 (Jira-Powered Life Map Dashboard)**. Consumed by the local dev server
via a git-ignored `.env` (dotenv) and, at deploy time, by Feature 2 (`013`) which supplies the
same names as Render environment variables. Same names in both so local testing matches
production (SC-006).

| Name | Required | Example / Accepted | Notes |
|------|----------|--------------------|-------|
| `JIRA_URL` | yes | `https://mayurzenith.atlassian.net` | Jira site base URL |
| `JIRA_USERNAME` | yes | `mayurzenith@gmail.com` | Jira account email |
| `JIRA_API_TOKEN` | yes | token string | Secret. Never committed. Present only in `.env` (gitignored) / Render env |
| `PORT` | no | `3000` | Local default; Render injects its own |

**Rules**
- `.env` must be git-ignored; ship only `.env.example` with placeholder values (no real token).
- The dashboard MUST NOT render, log, or serve any of these values to the browser (FR-008).
- Rotating = update `.env` / the Render env var, no code change (SC-004 owned by 013 at deploy).

`.env.example`:
```dotenv
JIRA_URL=https://your-site.atlassian.net
JIRA_USERNAME=you@example.com
JIRA_API_TOKEN=replace-me
PORT=3000
```
