#!/usr/bin/env bash
# Publish deploy/discord-agent (the Life OS agent: opencode serve + skills +
# Jira MCP + Discord bridge) onto the single t3.micro box, then enable it as a
# always-on systemd service.
#
# Native install (no docker) on an EC2 box that already has 2GB swap — fits
# agent + MCP + bridge in 1GB RAM with swap (the $0 single-box path).
#
# Usage (run from repo root):
#   ./deploy/ec2-single-box/deploy.sh
#   BOX_IP=1.2.3.4 ./deploy/ec2-single-box/deploy.sh   # override public IP
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BOX_DIR="$ROOT/deploy/ec2-single-box"
BOX_IP="${BOX_IP:-54.242.7.113}"
PEM="$BOX_DIR/lifeos-box.pem"
APP_SRC="$ROOT/deploy/discord-agent"
REMOTE_APP="/home/ubuntu/discord-agent"

SSH=(ssh -i "$PEM" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
SCP=(scp -i "$PEM" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)

[[ -f "$PEM" ]] || { echo "!! missing $PEM"; exit 1; }
[[ -f "$APP_SRC/.env" ]] || { echo "!! missing $APP_SRC/.env (secrets)"; exit 1; }

echo "==> [1/4] rsync app source -> ubuntu@$BOX_IP:$REMOTE_APP (secrets excluded)"
"${SSH[@]}" ubuntu@"$BOX_IP" "mkdir -p $REMOTE_APP"
rsync -az --delete -e "ssh -i $PEM -o StrictHostKeyChecking=accept-new" \
  --exclude 'node_modules' --exclude '.env' --exclude '.git' \
  --exclude 'task-def.json' --exclude 'render.yaml' --exclude 'Dockerfile' \
  --exclude '.dockerignore' --exclude 'test' --exclude 'fixtures' \
  "$APP_SRC/" ubuntu@"$BOX_IP":"$REMOTE_APP/"

echo "==> [2/4] push .env (secrets) via stdin (not argv), chmod 600"
cat "$APP_SRC/.env" | "${SSH[@]}" ubuntu@"$BOX_IP" \
  "cat > $REMOTE_APP/.env && chmod 600 $REMOTE_APP/.env && wc -l $REMOTE_APP/.env"

echo "==> [3/4] push + run remote setup (installs deps, renders config, installs systemd unit)"
"${SCP[@]}" "$BOX_DIR/setup-app-remote.sh" ubuntu@"$BOX_IP":"/tmp/setup-app-remote.sh"
"${SSH[@]}" ubuntu@"$BOX_IP" "bash /tmp/setup-app-remote.sh 2>&1"

echo "==> [4/4] done. Service enabled; verify:"
echo "   ssh -i $PEM ubuntu@$BOX_IP 'systemctl status discord-agent --no-pager; swapon --show; curl -s localhost:3000/health'"
