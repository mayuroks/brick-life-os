# WU-02 — Serve-crash supervisor

> ✅ **COMPLETED (2026-08-08).** Run.sh respawn loop implemented and verified live in
> local docker (commits `a52a283`). Caveat: under amd64-in-qemu emulation `opencode serve`
> itself crash-loops regardless of this unit (see WU-01 verification); the respawn loop is
> working. Confirm serve stability on the native EC2 box.

**Change size:** medium · **Savings:** availability (unblocks WU-01)
**Depends on:** nothing · **Standalone:** yes
**Rollback:** revert `run.sh` edit

## Goal

Today if `opencode serve :4096` dies, nothing respawns it (only the foreground bridge
death triggers a systemd restart, and the stale `run.sh:22-24` has only a TERM trap, no
respawn loop). Because WU-01 makes every reply depend on the serve worker, a solo serve
crash would be a hard outage. This unit adds a tiny respawn loop for the serve process.

## Current behaviour / code

`deploy/discord-agent/run.sh:20-24`:

```sh
echo "[boot] starting opencode serve (headless agent)..."
(cd agent && exec opencode serve --port 4096) &
AGENT_PID=$!
trap 'kill $AGENT_PID 2>/dev/null || true' TERM INT
```

## Edits (exact)

**File:** `deploy/discord-agent/run.sh`

Replace the single background launch with a bounded respawn loop. Keep the existing
foreground `node src/index.js` (which systemd supervises) unchanged:

```sh
echo "[boot] starting opencode serve (headless agent)..."
SERVER_PID=0
start_serve() {
  (cd agent && exec opencode serve --port 4096) &
  SERVER_PID=$!
}
start_serve
while true; do
  wait "$SERVER_PID"
  echo "[boot] opencode serve exited (code=$?); restarting in 2s..."
  sleep 2
  start_serve
done &
SUPERVISOR_PID=$!
trap 'kill $SUPERVISOR_PID $SERVER_PID 2>/dev/null || true' TERM INT

echo "[boot] starting Discord bridge + /health..."
node src/index.js
```

Notes:
- The `wait "$SERVER_PID"` blocks until serve exits, then respawns. The loop itself runs
  as a background job owned by `run.sh`, so it dies with the bridge (systemd respawns the
  whole unit → both come back, matching current semantics).
- Replace the old `AGENT_PID=$!` / trap lines entirely (the new `start_serve` +
  `SUPERVISOR_PID` replace them).

## Verify

```sh
sh -n deploy/discord-agent/run.sh          # syntax check
# Local docker rebuild + boot smoke test:
docker build -t lifeos-agent:latest deploy/discord-agent
# In the container: kill the serve pid, confirm it comes back within ~2-3s and /health recovers.
```

Manual: after boot confirm `curl -s http://127.0.0.1:4096/` returns 200 (serve alive), then
`kill <serve_pid>` and re-curl after 3s — expect 200 again.

## Deploy

`./deploy/ec2-single-box/deploy.sh`, then `sudo systemctl restart discord-agent`.

## Accepted edge cases (keep simple)

- Rapid serve crash-loop is unbounded (sleep 2s each retry) — acceptable for a personal bot.
- Two `run.sh` supervisors are never active because systemd manages one unit (the loop is
  a child of the unit's `run.sh`, killed with it).
