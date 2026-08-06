# Phase 0 — Test Infrastructure

Goal: give both packages a zero-dependency test runner and a CI gate so all
later phases have something to run against.

## 0.0 Why `node:test`

- Both `brick/package.json` and `deploy/discord-agent/package.json` are
  `"type": "module"` (ESM) on Node >= 20.
- `node:test` is built in: `import { test } from 'node:test'`,
  `import assert from 'node:assert/strict'`, run with `node --test`.
- No install = no supply-chain churn on a free-tier codebase.

## 0.1 Changes

**`brick/package.json`** — add script:
```json
"scripts": {
  "test": "node --test",
  ...
}
```

**`deploy/discord-agent/package.json`** — same:
```json
"scripts": {
  "test": "node --test",
  ...
}
```

**CI gate** — extend `.github/workflows/deploy-aws.yml` with a pre-build job
that installs dev deps (none new) and runs `npm test` in each package. Fail the
deploy on red.

## 0.2 Conventions for every phase

- One test file per source module, colocated: `src/xyz.js` →
  `test/xyz.test.js` (or colocated `xyz.test.js` beside source — pick one and
  stick to it; suggested: `test/` mirror dirs, since `deploy/discord-agent`
  already has a `test/` dir).
- Use `assert/strict`.
- Never import `.env`-dependent modules at test time unless env is injected.
  Watch `import 'dotenv/config'` side effects (present in several modules).

## 0.3 Acceptance

- `npm test` runs and reports "no tests" green in both packages.
- CI job blocks deploy on failure.
- Helper exports needed by later phases are decided now: prefer named exports
  (`export function ...`), never default-only, to keep DI clean.

## 0.4 Verify

- `cd brick && npm test`
- `cd deploy/discord-agent && npm test`
- Manually trigger the CI workflow to confirm the gate runs.
