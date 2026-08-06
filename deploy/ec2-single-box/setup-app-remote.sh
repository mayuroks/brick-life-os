#!/usr/bin/env bash
# Remote provisioning for the Life OS agent on the EC2 box.
# Run as the 'ubuntu' user via:  sudo bash /tmp/setup-app-remote.sh  (see deploy.sh)
# Installs toolchain, deps; renders opencode.json; installs+starts systemd unit.
set -euo pipefail

APP_DIR="${1:-/home/ubuntu/discord-agent}"
LOCAL_BIN="$HOME/.local/bin"
OPENCODE_BIN="$HOME/.opencode/bin"

export PATH="$OPENCODE_BIN:$LOCAL_BIN:/usr/local/bin:/usr/bin:/bin"

echo "==> [1/6] Node 24 (NodeSource, idempotent)"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null)" != v24* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "    node: $(node -v)  npm: $(npm -v)"

echo "==> [2/6] opencode CLI (user-level)"
if ! command -v opencode >/dev/null 2>&1; then
  OPENCODE_INSTALL_DIR="$LOCAL_BIN" bash <(curl -fsSL https://opencode.ai/install) >/dev/null
fi
opencode --version

echo "==> [3/6] uv + pre-warm mcp-atlassian (so Jira MCP doesn't cold-download)"
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null
  export PATH="$LOCAL_BIN:$PATH"
fi
uv --version
if ! uv tool list 2>/dev/null | grep -q '^mcp-atlassian'; then
  echo "    installing mcp-atlassian (one-time)..."
  uv tool install mcp-atlassian
fi

echo "==> [4/6] npm deps + render agent config"
cd "$APP_DIR"
npm ci --omit=dev
node scripts/bootstrap.js

echo "==> [5/6] install systemd unit"
sudo tee /etc/systemd/system/discord-agent.service >/dev/null <<EOF
[Unit]
Description=Life OS agent (opencode serve + skills + Jira MCP + Discord bridge)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
Environment=PATH=$OPENCODE_BIN:$LOCAL_BIN:/usr/local/bin:/usr/bin:/bin
Environment=OPENCODE_SERVE_URL=http://127.0.0.1:4096
Environment=PORT=3000
ExecStart=$APP_DIR/run.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now discord-agent
# enable --now starts a stopped service but does NOT restart an already-running
# one, so a pushed .env (e.g. a rotated token) would otherwise not apply.
# Restart explicitly so changed secrets take effect on every full deploy.
sudo systemctl restart discord-agent

echo "==> [6/6] status"
sleep 8
sudo systemctl is-active discord-agent || echo "!! not active (see journal below)"
sudo journalctl -u discord-agent --no-pager -n 25 || true
