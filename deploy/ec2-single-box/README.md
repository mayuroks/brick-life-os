# EC2 single-box deploy (Life OS agent + Jira MCP)

Deploys `deploy/discord-agent/` natively (no Docker) onto a single t3.micro box.
All commands run from the repo root.

## Quick reference

| Task | Command |
|------|---------|
| Provision / launch the box | `./deploy/ec2-single-box/provision.sh` |
| Full deploy (code + secrets) | `./deploy/ec2-single-box/deploy.sh` |
| **Secrets-only update (rotate a token)** | `./deploy/ec2-single-box/update-secrets.sh` |

## Full deploy vs secrets-only update

- **Full deploy — `deploy.sh`**: rsyncs the application source, pushes `.env`
  (via stdin, `chmod 600`), then runs the remote setup which installs deps and
  the systemd unit. The remote setup **restarts** the `discord-agent` service
  after writing `.env`, so any changed token applies without a manual restart.
  Use this when application code changed.

- **Secrets-only update — `update-secrets.sh`**: pushes just `deploy/discord-agent/.env`
  to the box and restarts `discord-agent`. Use this when **only** a secret/token
  changed (e.g. rotating `GROQ_API_KEY`) — no need to re-rsync all code.

  ```sh
  # rotate a token: edit deploy/discord-agent/.env, then
  ./deploy/ec2-single-box/update-secrets.sh
  ```

Aborts with a clear error if `deploy/discord-agent/.env` is missing, so a token
is never silently dropped.

## Secrets

- Secrets live in `deploy/discord-agent/.env` (git-ignored, `chmod 600` on the
  box). The `discord-agent` systemd unit loads it via `EnvironmentFile`.
- `GROQ_API_KEY` (Groq STT for voice notes) is read from the environment/`.env`;
  it is optional at boot and validated lazily on the first voice note.
- Never commit the real `.env`.

## Verify on the box

```sh
ssh -i deploy/ec2-single-box/lifeos-box.pem ubuntu@<BOX_IP> \
  'systemctl is-active discord-agent; printenv GROQ_API_KEY; curl -s localhost:3000/health'
```

Box IP: `54.242.7.113` (override with `BOX_IP=...` on any of the scripts).
