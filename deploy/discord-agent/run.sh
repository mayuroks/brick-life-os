#!/bin/sh
# Supervisor for the Discord agent deployable.
# opencode serve now runs as its OWN systemd unit (opencode-serve.service) with
# Restart=always, so a crash is auto-recovered by systemd — the service which
# waits here is supervised by the bridge. This script:
# 1) Waits for opencode serve to be healthy (systemd may still be starting it).
# 2) Render agent/opencode.json from env (never bake secrets).
# 3) Start the Discord bridge + /health.
set -e
cd "$(dirname "$0")"

# Extend PATH (systemd unit sets it too; double-defend for local/docker runs).
export PATH="$HOME/.opencode/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Export the LLM provider key from .env to the shell so child processes
# (bootstrap.js / node bridge) can reach the model. The opencode serve unit
# loads OPENROUTER_API_KEY from .env via its own EnvironmentFile.
if [ -n "$OPENROUTER_API_KEY" ]; then
  : # already set in the environment; keep it
elif [ -f .env ] && grep -q '^OPENROUTER_API_KEY=' .env; then
  export OPENROUTER_API_KEY="$(grep '^OPENROUTER_API_KEY=' .env | head -1 | cut -d= -f2-)"
fi

# Serve is supervised by systemd (opencode-serve.service, Restart=always).
# Just wait for it to come up (it may lag one boot behind this unit).
SERVE_URL="${OPENCODE_SERVE_URL:-http://127.0.0.1:4096}"
echo "[boot] waiting for opencode serve at $SERVE_URL..."
for i in $(seq 1 40); do
  if curl -s --max-time 2 -o /dev/null "$SERVE_URL/global/health" 2>/dev/null; then
    echo "[boot] opencode serve is healthy"
    break
  fi
  if [ "$i" = "40" ]; then
    echo "[boot] WARNING: opencode serve not healthy yet; continuing (it is supervised & will recover)" >&2
  fi
  sleep 0.5
done

echo "[boot] rendering agent config..."
node scripts/bootstrap.js

echo "[boot] starting Discord bridge + /health..."
node src/index.js