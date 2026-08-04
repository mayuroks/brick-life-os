# Implementation Plan: Health Endpoint for Uptime Monitoring

**Branch**: `006-health-endpoint` | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-health-endpoint/spec.md`

## Summary

Wire the existing `/health` endpoint (already shipped in feature `005` at
`deploy/discord-agent/src/health.js`) as the target for an external keep-alive pinger
(UptimeRobot free tier) so the Render free-tier service does not spin down when idle. The code
already exposes `GET /health` returning `200`/`ok` when agent+bridge are up and `503`/`degraded`
otherwise; the net-new work is (a) a small hardening change to also answer on the root path and bind
reliably for external probing, and (b) a documented UptimeRobot monitor setup (which URL, 5-min
interval, notification channels) satisfying FR-006, plus a validation quickstart.

Key facts driving the design (from research):
- Render free tier spins down after **15 min** without inbound traffic and wakes on the next inbound
  HTTP request (~1 min spin-up). Render's own health checks do NOT wake a sleeping instance.
- UptimeRobot **free** allows **50 monitors** at a **5-min minimum interval** (60 s is paid). A 5-min
  ping keeps a 15-min-idle service awake with a 3× safety margin.
- UptimeRobot HTTP(s) monitors count **2xx–3xx as Up** and any **5xx (incl. 503) as Down**; free cannot
  customize statuses. Email + **Discord** notifications are free (Telegram/Slack are paid).
- Requests to `/robots.txt` do NOT wake the service; the monitor must hit a real route (`/health`).

## Technical Context

**Language/Version**: Node.js ≥20 (ESM), running the existing `deploy/discord-agent` — unchanged.

**Primary Dependencies**: `express` (already a dependency — serves `/health`); `discord-agent` bridge
(`src/index.js` → `createHealthApp`). No new runtime dependencies.

**Storage**: N/A. Stateless (matches 005 ephemeral-filesystem constraint).

**Testing**: Manual acceptance per constitution (prototype pragmatism). No new automated tests.

**Target Platform**: Render Docker web service, free tier (`plan: free`), already deployed by `005`.

**Project Type**: web-service endpoint + external monitoring configuration (documentation-driven feature
with a small code hardening edit).

**Performance Goals**: `/health` answers in well under 5 s (Render health-check and UptimeRobot timeout
bounds); the endpoint must respond to lightweight probes without disturbing message handling.

**Constraints**: 
- Public port is `$PORT` (Render default `10000`); process must bind to accept inbound traffic.
- UptimeRobot free treats `503` as **Down** — a degraded endpoint triggers alerts (this is the desired
  readiness signal, but must be documented so the alert is understood, not treated as a bug).
- Free statuses not customizable → keep-alive depends on `/health` returning 2xx when healthy.
- Monitor target MUST be a public URL (the `onrender.com` subdomain), never localhost.

**Scale/Scope**: Single monitor pinging one endpoint on one hobby deployment. No status page, no
dashboards (per Assumptions and constitution IV).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Jira SSOT** — Not implicated; no new commitment or Jira surface. The keep-alive is operational
  monitoring of the existing `005` deployment, not a user-facing feature. ✅
- **II. Agent Is the Interface** — Unchanged; availability of the bot improves, interface unchanged. ✅
- **IV. Prototype Pragmatism (MUST)** — Satisfied: no gold-plating. We reuse the existing `/health`
  endpoint, add one small hardening route, and document UptimeRobot setup (no dashboards, no status
  page, no paid monitoring). ✅
- **V. Sub-Agent Delegation (MUST)** — Where any endpoint is verified against a live Render URL or
  UptimeRobot config is checked, that verify/install work MUST be delegated to a sub-agent (≤3).
  Planning research was delegated to 2 parallel sub-agents. ✅
- **Governance / Scope** — User-requested addition on top of `005`, documented here and in the spec.
  Navoremove of any existing behavior. ✅

No violations; gate passes. Post-design check confirms the same.

## Project Structure

### Documentation (this feature)

```text
specs/006-health-endpoint/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (health + monitor contract)
└── tasks.md             # later, by /speckit.tasks
```

### Source Code (deploy/discord-agent)

```text
deploy/discord-agent/
├── src/
│   ├── health.js        # MODIFY (small): also answer GET / (root) for pinger coverage
│   └── index.js         # (unchanged) — already binds health app to cfg.port
└── README.md            # MODIFY: add "Keep it awake with UptimeRobot" section (FR-006)
```

**Structure Decision**: A single small web-service project already exists at
`deploy/discord-agent/`. No new structure is introduced; the feature is a tiny hardening edit to
`src/health.js` plus documentation (`README.md`). The monitoring contract is documented under
`specs/006-health-endpoint/contracts/`.

## Complexity Tracking

> No constitution violations to justify — the feature adds negligible complexity (one optional route +
  docs), consistent with constitution IV.
