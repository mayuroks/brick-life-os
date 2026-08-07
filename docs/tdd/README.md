# TDD-Readiness Plan — Index

Adversarial system-design assessment of the app code (`brick/` +
`deploy/discord-agent/`), split into phase plan files. Today: **zero test
infrastructure** (no runner, no test script, no test files; only manual stubs
in `deploy/discord-agent/test/stub/` and `fixtures/`).

## Phase map

| Plan file | Scope | Nature |
|---|---|---|
| `phase-0.md` | Test infra setup | `node:test`, scripts, CI gate |
| `phase-1.md` | Pure modules, test now | Zero refactor |
| `phase-2.md` | Extract buried pure helpers | Move code, then test |
| `phase-3.md` | DI refactor + test core network/spawn | Refactor for seams |
| `phase-4.md` | Turn-path + HTTP integration tests | Light fakes + factory |

## Guiding decisions (carry into every phase)

- **Runner:** Node built-in `node:test` (both packages are ESM,
  `"type":"module"`). Zero new deps — free-tier aligned.
- **Never** break the single-slot queue / never-drop semantics or the exact
  user-visible message strings (see `phase-2.md`/`phase-4.md` for the 3
  duplicated "empty input" strings that must be preserved).
- Tests must never hit a real provider/Discord; every seam is injected.
- `/health` 200/503 contract and `{agentUp,bridgeUp}` shape are public
  (external pings) — keep stable.

## Full analysis

The architectural/narrative assessment that produced these plans lives in the
design discussion (state ownership, dataflow, one-shot event lifecycle,
failure mechanics).
