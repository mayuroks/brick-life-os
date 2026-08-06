## 1. Provision the Groq key in config

- [x] 1.1 Add `GROQ_API_KEY=` to `deploy/discord-agent/.env` (insert value manually, never commit; `.gitignore` already excludes `.env`)
- [x] 1.2 Confirm `.env.example` already documents `GROQ_API_KEY` (lazy/optional at boot); update comment only if inaccurate

## 2. Local Docker smoke validation

- [x] 2.1 Build the `deploy/discord-agent` image: `docker build -t discord-agent dev deploy/discord-agent`
- [x] 2.2 Run the image with the `.env`: `docker run --rm -d -p 3000:3000 --env-file deploy/discord-agent/.env --name discord-agent-smoke discord-agent`
- [x] 2.3 Assert boot: `curl -s localhost:3000/health` returns ok/liveness
- [x] 2.4 Assert `GROQ_API_KEY` is present in the runtime env (`docker exec discord-agent-smoke printenv GROQ_API_KEY` non-empty)
- [x] 2.5 Tear down the smoke container and clean up

## 3. EC2 deploy: secrets-only update + restart

- [x] 3.1 Add `deploy/ec2-single-box/update-secrets.sh`: push `deploy/discord-agent/.env` to the box via stdin (`cat .env | ssh 'cat > .env && chmod 600'`), then `systemctl restart discord-agent`; reuse PEM/IP from `deploy.sh`; abort if `.env` missing
- [x] 3.2 Update `deploy/ec2-single-box/setup-app-remote.sh`: remove `Environment=DISABLE_VOICE=1` from the systemd unit so voice is enabled on the box
- [x] 3.3 Update `deploy/ec2-single-box/deploy.sh` (or the remote setup) so a full deploy also restarts the `discord-agent` service after pushing `.env` (so changed tokens apply)
- [x] 3.4 Update `deploy/ec2-single-box/README` or deploy comments to document secret rotation via `update-secrets.sh` vs full deploy

## 4. Verify

- [ ] 4.1 Run `update-secrets.sh` against the box; confirm service is active (`systemctl is-active discord-agent`), logs show no "Missing GROQ_API_KEY", and `printenv GROQ_API_KEY` on the box is set
- [ ] 4.2 (Post user confirmation) Full cloud deploy + live voice-note test that Groq STT returns a transcript (user-authorized step)
