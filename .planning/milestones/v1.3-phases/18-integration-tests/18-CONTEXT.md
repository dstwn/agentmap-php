# Phase 18: Integration Tests - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a new integration test file `test/integration-laravel.test.mjs` that runs the real CLI against the existing `tmp/eval/laravel-framework/` fixture and asserts structural invariants on `--packages`, `--types`, and `--legacy` output. Tests skip gracefully when the fixture is absent. The file lives in `test/` root so the Phase 17 fixed glob picks it up automatically.

</domain>

<decisions>
## Implementation Decisions

### Test Structure
- Test file: `test/integration-laravel.test.mjs` in test/ root (picked up by fixed glob automatically)
- Fixture path constant: `LARAVEL = join(HERE, "..", "tmp/eval/laravel-framework")` — matches where eval.mjs clones it
- Skip guard: `existsSync(LARAVEL)` → `test.skip` with descriptive message (not a CI env check)
- Timeout: 30_000ms on each `execFileSync` call via options to prevent CI hang

### Assertions
- `--packages`: assert exit 0 + stdout matches `laravel/framework` (package name present) — structural invariant, not exact count
- `--types`: assert exit 0 + stdout non-empty (types exist in large repo) — avoid brittle counts or specific class names
- `--legacy`: assert exit 0 + graceful exit (may or may not have warnings — don't assert specific count or directory names)
- CI fixture setup: add clone step to `.github/workflows/ci.yml` conditioned on `matrix.node-version == 20` only (avoid triple-cloning); step runs `node eval/eval.mjs --clone-only` or equivalent

### the agent's Discretion
- Exact `eval.mjs` clone command syntax (check eval.mjs for the right invocation)
- Whether `--types` needs a specific file argument or works on whole repo
- JSON vs text output format for assertions (text is simpler, avoids JSON parsing in test)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `test/helpers.mjs` — exports `makeRepo`, `gitInit`, `run`, `cleanup`, `AGENTMAP`, `writeFiles`
- `run(dir, ...args)` — runs `node agentmap.mjs <args>` as subprocess, returns `{stdout, stderr, status}`
- `tmp/eval/laravel-framework/` — existing fixture clone with `.git`, full composer.json, PHP source
- `test/packages-cli.test.mjs` — reference pattern for `--packages` assertions
- `test/types-cli.test.mjs` — reference pattern for `--types` assertions
- `test/legacy-cli.test.mjs` — reference pattern for `--legacy` assertions

### Established Patterns
- All tests use `import { test } from "node:test"` + `import assert from "node:assert/strict"`
- Tests always call `run(dir, flag)` and assert on `r.status` and `r.stdout`
- No test framework beyond node:test — no Jest, no Mocha
- Timeout passed as `{ timeout: N }` to `test()` call, not to `execFileSync`

### Integration Points
- `test/integration-laravel.test.mjs` picked up by `npm test` glob (`test/**/*.test.mjs`) automatically after Phase 17 fix
- CI `Clone laravel fixture` step needed before `Run tests` step in ci.yml, scoped to node 20 matrix leg

</code_context>

<specifics>
## Specific Ideas

- Check `eval/eval.mjs` for the correct clone-only invocation before writing the CI step
- The `run()` helper in helpers.mjs does NOT add a timeout to execFileSync — for integration tests against a large repo, pass `{ timeout: 30000 }` in a custom wrapper or pass it directly
- Fixture path: `tmp/eval/laravel-framework` is relative to repo root; use `fileURLToPath` + `dirname` + `join` to resolve it safely from the test file

</specifics>

<deferred>
## Deferred Ideas

- Full integration suite covering all CLI flags beyond --packages/--types/--legacy (deferred to v1.4)
- Asserting specific class/type names (too brittle for a large evolving fixture)

</deferred>
