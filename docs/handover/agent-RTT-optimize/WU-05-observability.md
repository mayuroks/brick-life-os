# WU-05 — Boot-time + webfetch-fail observability

> ✅ **COMPLETED (2026-08-08).** `run.boot` (bootMs) + webfetch counters added in
> `ops.js`/`client.js` (commits `a52a283`). Emits `run.boot` / webfetch on `run.done`
> /`run.failed` /`run.timeout`; verified via `node --check`. Note the source path is
> `src/agent/` (not `agent/` as this doc originally stated).

**Change size:** minor · **Savings:** none directly — it *measures* the others (boot tax, webfetch waste)
**Depends on:** nothing · **Standalone:** yes
**Rollback:** revert edits (logging only, no behavior change)

## Goal

Today it is hard to prove WU-01 (attach) and WU-03 (webfetch guard) actually cut latency:
`run.start` doesn't capture the boot gap, and webfetch failures aren't counted. This unit
adds (a) a boot-time measurement at the first model signal and (b) a webfetch success/fail
counter, without changing reply behavior.

## Current behaviour / code

- `deploy/discord-agent/agent/ops.js` — `parseOp()` regexes for `model|jira|tool` + duration,
  and `track()` records them; emits `run.op` events. It does **not** parse `stream
  providerID=openrouter` or failure counts.
- `deploy/discord-agent/src/agent/client.js` — `run.start` logged at spawn; `run.chunk` per
  chunk. No explicit boot-gap or fetch-count metric.

## Edits (exact)

**File 1:** `deploy/discord-agent/agent/ops.js` — extend `parseOp`/`track` to count webfetch
outcomes. Add a helper and wire into `add`:

```js
export function track() {
  const ops = [];
  const counters = { model: 0, webfetch: 0, webfetchFail: 0 };
  return {
    add(text, ctx = {}) {
      const rec = parseOp(text);
      if (rec) {
        ops.push(rec);
        if (rec.op === 'model') counters.model += 1;
        log('info', 'run.op', ctx, 'Operation completed', rec);
      }
      if (/WebFetch/.test(text)) {
        counters.webfetch += 1;
        if (/(failed|Error|non 2xx|Transport error)/i.test(text)) counters.webfetchFail += 1;
      }
      return rec;
    },
    counters() { return { ...counters }; },
    summary() { return ops.slice(); },
  };
}
```

**File 2:** `deploy/discord-agent/src/agent/client.js` — record the boot gap once we see the
first model signal, and include counters on `run.done`/`run.failed`.

- Add a module-level `let firstModelSeen = false; let bootMs = 0;` (reset inside `runAgent`).
- In `onData('stderr')`, after appending, if the chunk contains `stream providerID=openrouter`
  and `!firstModelSeen`:
  ```js
  if (!firstModelSeen && /stream providerID=openrouter/.test(chunk)) {
    firstModelSeen = true;
    bootMs = Date.now() - t0;
    log('info', 'run.boot', ctx, 'First model signal reached', { bootMs });
  }
  ```
- In the `run.done`/`run.failed`/`run.timeout` fields, add `bootMs` and
  `webfetch: tracker.counters()`.

## Verify

```sh
node --check deploy/discord-agent/agent/ops.js
node --check deploy/discord-agent/src/agent/client.js
docker build -t lifeos-agent:latest .
# Trigger a couple of turns; grep logs for:
#   event=run.boot           -> bootMs appears and is small after WU-01 attach
#   event=run.op             -> still populated under attach
#   "webfetch" in run.done   -> counters show fetch vs fail counts
docker logs lifeos-agent 2>&1 | grep -E 'run.boot|webfetch' | tail -20
```

## Deploy

`./deploy/ec2-single-box/deploy.sh`, then `sudo systemctl restart discord-agent`. Compare
`run.boot.bootMs` before (fresh spawn ~5s) vs after (attach ~1-2s) to prove WU-01.

## Accepted edge cases (keep simple)

- Under attach, agent output arrives via the serve process; if `run.chunk` stops receiving
  `stream providerID=openrouter` lines, `bootMs` may stay 0 — log it as `-1` and rely on
  `run.start`→`run.done` total as the fallback signal. Add `bootMs: firstModelSeen ? bootMs : -1`.
- Counter regex is heuristic; may under/over-count on unusual log text. Acceptable.
