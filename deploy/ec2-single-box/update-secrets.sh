#!/usr/bin/env bash
# Secrets-only update for the EC2 single box.
# Pushes deploy/discord-agent/.env (secrets) to the box and restarts the
# discord-agent service so a token rotation (e.g. GROQ_API_KEY, or any other
# .env secret) takes effect WITHOUT re-rsyncing the application source.
#
# Usage (run from repo root):
#   ./deploy/ec2-single-box/update-secrets.sh
#   BOX_IP=1.2.3.4 ./deploy/ec2-single-box/update-secrets.sh   # override public IP
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BOX_DIR="$ROOT/deploy/ec2-single-box"
BOX_IP="${BOX_IP:-15.252.6.196}"
PEM="$BOX_DIR/lifeos-box.pem"
APP_SRC="$ROOT/deploy/discord-agent"
REMOTE_APP="/home/ubuntu/discord-agent"

SSH=(ssh -i "$PEM" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)

[[ -f "$PEM" ]] || { echo "!! missing $PEM"; exit 1; }
[[ -f "$APP_SRC/.env" ]] || { echo "!! missing $APP_SRC/.env (secrets)"; echo "   aborting so a token is never silently dropped"; exit 1; }

echo "==> [1/2] push .env (secrets) via stdin (not argv), chmod 600"
cat "$APP_SRC/.env" | "${SSH[@]}" ubuntu@"$BOX_IP" \
  "cat > $REMOTE_APP/.env && chmod 600 $REMOTE_APP/.env && wc -l $REMOTE_APP/.env"

echo "==> [2/2] restart discord-agent so changed secrets apply"
"${SSH[@]}" ubuntu@"$BOX_IP" "sudo systemctl restart discord-agent && sudo systemctl is-active discord-agent"

echo "==> done. Service restarted with new secrets. Logs:"
"${SSH[@]}" ubuntu@"$BOX_IP" "sudo journalctl -u discord-agent --no-pager -n 15 || true"
