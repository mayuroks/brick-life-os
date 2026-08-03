#!/bin/sh
# Supervisor for the Discord agent deployable.
# 1) Render agent/opencode.json from env (never bake secrets).
# 2) Start the headless agent (skills + Jira MCP) warmed on its port.
# 3) Start the Discord bridge + /health.
set -e
cd "$(dirname "$0")"

# Export the LLM provider key from .env to the shell so `opencode serve` (a
# subprocess) can reach the model. The Node bridge reads .env itself; the
# headless agent inherits only exported shell vars.
if [ -n "$OPENROUTER_API_KEY" ]; then
  : # already set in the environment; keep it
elif [ -f .env ] && grep -q '^OPENROUTER_API_KEY=' .env; then
  export OPENROUTER_API_KEY="$(grep '^OPENROUTER_API_KEY=' .env | head -1 | cut -d= -f2-)"
fi

echo "[boot] rendering agent config..."
node scripts/bootstrap.js

echo "[boot] starting opencode serve (headless agent)..."
(cd agent && exec opencode serve --port 4096) &
AGENT_PID=$!
trap 'kill $AGENT_PID 2>/dev/null || true' TERM INT

echo "[boot] starting Discord bridge + /health..."
node src/index.js
