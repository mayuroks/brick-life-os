# WU-03 — webfetch schema + URL-validity guard

> ✅ **COMPLETED (2026-08-08).** Tooling contract + research fetch budget added to the
> agent docs (commits `a52a283`). Ships as image/docs; functional fetch reduction pending
> a live research-turn observation.

**Change size:** minor · **Savings:** ~30s / research run (14 `SchemaError` + 32 dangling 404/DNS fetches)
**Depends on:** nothing · **Standalone:** yes
**Rollback:** revert the two doc edits

## Goal

The agent frequently calls `webfetch` with a missing `url` (14 observed `SchemaError`
calls) and fetch-tests nonexistent domains (11×404, 6×DNS/transport timeouts), wasting
real seconds. This unit (a) states the webfetch argument contract so the model stops
building bad calls, and (b) tells the research skill to validate URLs and bound fetching.

## Current behaviour / code

- `deploy/discord-agent/agent/AGENTS.md` — the same file the agent reads every turn
  (surface routing + persona). No webfetch contract today.
- `deploy/discord-agent/agent/skill/research/SKILL.md:28-30` — "Run focused background
  research… Keep it bounded and answer-oriented" — **no call/URL cap, no validity check.**

## Edits (exact)

**File 1:** `deploy/discord-agent/agent/AGENTS.md` — add a "Tooling contract" section:

```md
## Tooling contract
- `webfetch` REQUIRES a real, well-formed `url` argument (e.g. `https://example.com/path`). Never call it without `url` — that errors and wastes a step.
- Before fetching, confirm the URL looks like a real public site. If a subject/domain is unknown or likely nonexistent, do NOT burn fetches guessing — say so and stop.
- Keep tool calls minimal and purposeful.
```

**File 2:** `deploy/discord-agent/agent/skill/research/SKILL.md` — replace the research
looping line (`:28-30`) with a bounded version:

```md
Run focused background research on the open question(s). **Fetch budget: max 5 web fetches
total. Validate each URL is a real public site before fetching; if the subject or domain is
unknown, stop and report "could not find a reliable source" instead of guessing URLs.
Keep it bounded and answer-oriented.**
```

## Verify

```sh
cd deploy/discord-agent
# Rebuild so the docs ship
docker build -t lifeos-agent:latest .
grep -n "webfetch REQUIRES" agent/AGENTS.md        # contract present
grep -n "max 5 web fetches" agent/skill/research/SKILL.md
# Functional: send a message that triggers research (e.g. "research <some-key>") and
# count in logs that (a) no SchemaError("url") appears, (b) fetch count stays <=5 even
# when the subject is nonexistent.
```

## Deploy

`./deploy/ec2-single-box/deploy.sh`, then `sudo systemctl restart discord-agent`.

## Accepted edge cases (keep simple)

- The model may occasionally still miscall webfetch — the contract reduces but does not
  guarantee zero errors; acceptable.
- URL "validity" is a heuristic (looks like a domain) — it is not a resolver check; a
  plausible-but-dead domain may still 404 once; acceptable.
