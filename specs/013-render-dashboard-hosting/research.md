# Research: Render Dashboard Hosting

Phase 0 output for `013-render-dashboard-hosting`. Focuses only on hosting wiring; the app it
deploys is researched and built by Feature 1 (`012`).

## 1. Hosting platform: render.com Blueprint

- **Decision**: A declarative `render.yaml` Blueprint web service on the free/hobby tier, auto-deploy from the repo's default branch.
- **Rationale**: The user explicitly named render.com; free/hobby tier suits a single-user prototype and matches the spec's Assumptions (cold-start after idle spin-down acceptable). Blueprint keeps config reproducible and enables auto-deploy (FR-005) + health/restart (FR-006) without manual steps.
- **Alternatives considered**: AWS/other paid hosts — rejected (constrained to render.com free tier). Manual one-off deploys without `render.yaml` — rejected (brittle, violates FR-005).

## 2. Env/credential wiring (FR-003/FR-004/FR-008)

- **Decision**: Map the app's `JIRA_URL` / `JIRA_USERNAME` / `JIRA_API_TOKEN` env contract (defined by 012 in its env-contract) to Render environment variables in `render.yaml`. Secrets live in Render settings, never in the repo or served pages.
- **Rationale**: Reuses the 012 contract verbatim so the hosted instance fetches identically to local (FR-002); rotating = update the Render env var with no code change/redeploy of credentials (FR-004/SC-004).
- **Alternatives considered**: Committing credentials — rejected (FR-003/FR-008/SC-003). Duplicating a separate env contract here — rejected (would fork the canonical one owned by 012).

## 3. Resilience: health + failed builds (FR-006/FR-007)

- **Decision**: Use Render's native health check against `/healthz` (the app's liveness route, owned by 012) for auto-restart on crash (FR-006/SC-005); rely on Render's deploy behavior where a failed build keeps the last successful release live (FR-007).
- **Rationale**: Native platform behavior avoids custom supervisor code — prototype pragmatism.
- **Alternatives considered**: Custom restart logic / extra liveness endpoint — rejected (Render already provides it; no gold-plating).

## 4. Scope boundary vs Feature 1

- **Decision**: 013 creates only `render.yaml`; it references (never creates) `life-map-dashboard/` and the `/healthz` + env contract owned by 012.
- **Rationale**: Prevents double-building the app and keeps repo/PR ownership clear (per the re-scope decision: 012 = app + local live testing; 013 = deploy wiring).
- **Alternatives considered**: Fold the app into 013 — rejected (the exact over-concentration the re-scope removed).
