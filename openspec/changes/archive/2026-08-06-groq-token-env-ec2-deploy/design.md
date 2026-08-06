## Context

The Groq STT voice path is already implemented (`config.js` reads `env.GROQ_API_KEY`; `transcribe/groq.js` calls Groq STT url pass-through; `Dockerfile` is text-thin and leaves audio off-box). See proposal.md - Why for the gap. The live surface is the EC2 single box (`deploy/ec2-single-box/`), which deploys `deploy/discord-agent/` natively (no Docker on the box): `deploy.sh` rsyncs source and pushes `.env` via stdin, `setup-app-remote.sh` installs a systemd unit with `EnvironmentFile=<app>/.env`. Constraints: never commit secrets; no audio on host (SC-001/SC-005); EC2 must remain free-tier (t3.micro, 1GB + swap).

## Goals / Non-Goals

**Goals:**
- `GROQ_API_KEY` sourced from `.env` end-to-end and actually set in the live `.env`.
- A lean secrets-only update path (push `.env` + restart service) plus ensuring full deploys restart the service so changed tokens apply.
- Remove the dead `DISABLE_VOICE=1` guard from the systemd unit so voice works on the box.
- Local Docker smoke validation (build + boot + key present) before deploy.

**Non-Goals:**
- No change to the ECS Fargate task-def / Render paths (legacy; still SSM/dashboard-based).
- No change to the OpenRouter agent-LLM path.
- No change to the SSH/`PEM` provisioning; no switch of the box to Docker runtime.
- No behavior change to STT itself (features like retries, languages unchanged).

## Decisions

- **Secrets-only update as a separate script** (`deploy/ec2-single-box/update-secrets.sh`). Rationale: `deploy.sh` re-rsyncs all code — wasteful and touches more than needed for a token rotation. The new script reuses the exact `.env`-push mechanism (stdin, `chmod 600`) and then `systemctl restart discord-agent`. Alternative considered: a flag on `deploy.sh` (`--secrets-only`) — rejected for clarity; a dedicated script is simpler to invoke and reason about.
- **Restart service whenever `.env` is replaced.** Rationale: `systemctl enable --now` does not restart an already-active service, so today a rotated token never applies without a manual restart. `setup-app-remote.sh` already sets `Restart=always`, so a `systemctl restart discord-agent` after writing `.env` is idempotent and safe.
- **Push `.env` before `systemctl restart`, never argv.** Consistent with the existing deploy (secrets via stdin, not command line) to keep tokens out of process listings/history.
- **Set `GROQ_API_KEY=` in `deploy/discord-agent/.env`.** `.env.example` already documents it; this aligns the live config with the contract. The value is inserted manually (never committed), matching how other keys already live there.
- **Remove `DISABLE_VOICE=1` from the systemd unit.** Rationale: grep shows it is not honored anywhere in code; keeping it only signals "voice off" misleadingly. Alternative considered: honoring it in code — rejected, out of scope (no reason to add a disable switch we don't use). Note the app's `run.sh` also exports only `OPENROUTER_API_KEY` for the opencode subprocess; GROQ is consumed by the Node bridge directly from env/dotenv, so no export change is needed.
- **Local Docker smoke via existing `deploy/discord-agent/Dockerfile`.** Run the built image with `--env-file .env` and assert boot + `GROQ_API_KEY` in the process env (e.g., a small boot log line or an env check in `run.sh`/a one-off command), plus `/health`. Alternative: a full Discord + real STT run — deferred to the user-authorized cloud deploy (see Open Questions).

## Risks / Trade-offs

- **Service restart churn**: issuing a restart on every secrets update briefly drops connections. → Mitigation: single, quick restart; systemd `Restart=always` recovers; the box is a personal agent, downtime is a few seconds.
- **Token visible in `.env` on disk**: `.env` is plaintext at rest. → Mitigation: `chmod 600` (existing), never committed (gitignored), and only the `ubuntu` service user reads it.
- **Docker smoke vs real runtime**: the container runtime differs from the box (native Node + systemd). A successful Docker boot proves the config/env contract but not the live systemd path. → Mitigation: the cloud deploy itself verifies via the box's `/health` + a voice-note test after the user confirms.
- **Drift between `.env` and box**: if someone changes `.env` but doesn't run the update path, the box keeps the old token. → Mitigation: the secrets-only path is the documented way to rotate; full deploys also restart now.

## Migration Plan

1. Add `GROQ_API_KEY=` to `deploy/discord-agent/.env` locally.
2. Build + run the Docker image locally with `--env-file .env`; confirm boot, `/health`, and `GROQ_API_KEY` present.
3. Add `update-secrets.sh`; adjust `setup-app-remote.sh` (drop `DISABLE_VOICE=1`, restart on env change) and `deploy.sh` (restart after push).
4. On the box: run `update-secrets.sh` (or full `deploy.sh`) to push the new `.env` and restart.
5. Rollback: if voice regresses, revert the `.env` value or re-add the toggle; a re-deploy restores the prior state. Changes are low-risk and isolated to the box's deploy scripts + a local `.env` value.

## Open Questions

- Whether to also do a full real-StT voice-note test in the Docker smoke, or defer it to the post-deploy verification on the box. (Deferred — user chose a smoke test; the live box test happens after the user confirms cloud deploy.)
