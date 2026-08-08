#!/bin/sh
# Supervisor for the Discord agent deployable.
# 1) Start persistent opencode serve (kills ~9.4s per-message startup tax).
# 2) Render agent/opencode.json from env (never bake secrets).
# 3) Start the Discord bridge + /health.
set -e
cd "$(dirname "$0")"

# Extend PATH so `opencode serve` is found (systemd unit sets PATH too, but
# double-defend for local/docker runs where PATH may differ).
export PATH="$HOME/.opencode/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Export the LLM provider key from .env to the shell so `opencode serve` (a
# subprocess) can reach the model. The Node bridge reads .env itself; the
# headless agent inherits only exported shell vars.
if [ -n "$OPENROUTER_API_KEY" ]; then
  : # already set in the environment; keep it
elif [ -f .env ] && grep -q '^OPENROUTER_API_KEY=' .env; then
  export OPENROUTER_API_KEY="$(grep '^OPENROUTER_API_KEY=' .env | head -1 | cut -d= -f2-)"
fi

# --- Start persistent opencode serve (replaces per-message spawning) ---
# ONE long-lived opencode process instead of spawning a new one per Discord
# message. Eliminates ~9.4s startup tax per message.
# The subshell `(cd agent && ...)` isolates the directory change so the parent
# run.sh stays in discord-agent/ for the Node bridge below.
export OPENCODE_SERVER_PASSWORD="${OPENCODE_SERVER_PASSWORD:-opencode-agent}"

if ! pgrep -f "opencode serve" > /dev/null 2>&1; then
  echo "[boot] starting persistent opencode serve on port 4096..."
  (cd agent && nohup opencode serve --port 4096 --hostname 127.0.0.1 \
    --log-level WARN > "$HOME/.opencode/serve.log" 2>&1 & echo $! > /tmp/opencode-serve.pid)
  # Wait for health check (up to 10s)
  for i in $(seq 1 20); do
    if curl -sf "http://127.0.0.1:4096/global/health" > /dev/null 2>&1; then
      echo "[boot] opencode serve is healthy (pid=$(cat /tmp/opencode-serve.pid))"
      break
    fi
    sleep 0.5
  done
fi

echo "[boot] rendering agent config..."
node scripts/bootstrap.js

echo "[boot] starting Discord bridge + /health..."
node src/index.js
