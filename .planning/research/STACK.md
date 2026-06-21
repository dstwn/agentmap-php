# Stack Research

**Domain:** Node.js ESM CLI tool — CI pipeline, integration testing, coverage reporting
**Researched:** 2026-06-21
**Confidence:** MEDIUM (Node.js docs verified via official docs; c8 via GitHub/npm; subprocess coverage constraint cross-checked)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js built-in `--test` | Node 18/20/22 (already in use) | Test runner | Already the project's test runner; no new dep needed; stable since Node 20 |
| `node --test` glob fix | n/a — YAML change only | Fix CI-01 (missing vue-sfc/ tests) | Shell expands `test/*.test.mjs` before node sees it; quoted glob `"test/**/*.test.mjs"` or bare `node --test` (no args) lets node do recursive discovery natively |
| `node --experimental-test-coverage` | Node 18+ | Built-in coverage flag | Zero-dep; emits `test:coverage` event; supports `--test-reporter=lcov` for CI upload; sufficient for CI-03 if subprocess constraint is understood |
| `c8` | `10.1.3` (pin — see note) | Istanbul-format coverage reports | Wraps `NODE_V8_COVERAGE` collection; `--reporter=lcov` output works with Coveralls/Codecov; battle-tested in ESM projects; needed if you want HTML/text reports beyond what `--experimental-test-coverage` emits |
| `coverallsapp/github-action` | `v2` | Upload lcov to Coveralls | Free for public OSS repos; auto-comments on PRs with coverage delta; accepts lcov directly; no token needed for public repos beyond `GITHUB_TOKEN` |

> **c8 version note:** Latest is v11.0.0 (Feb 2026) but requires Node 18+. Pin `10.1.3` if you need to preserve Node 16 compat. Since this project already requires `>=18`, v11 is safe. Use `"c8": "11.0.0"` (exact pin — no `^`) per project constraint policy.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `c8` | `11.0.0` | V8 coverage → lcov/text/html | Use when you want richer reports than `--experimental-test-coverage` alone; also needed if uploading to Coveralls via lcov |
| `coverallsapp/github-action` | `v2` (GH Action) | Upload coverage to coveralls.io | Use if you want a coverage badge and PR coverage-delta comments; zero infra cost for public OSS |

No new npm runtime dependencies needed. `c8` is a devDependency only.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `node --test "test/**/*.test.mjs"` | Run all tests recursively | Double-quoted glob: node handles expansion, not the shell — fixes CI-01 without touching test files |
| `node --test` (bare, no args) | Auto-discovers all `**/*.test.{cjs,mjs,js}` | Alternative to explicit glob; works on Node 18+; simpler CI yaml |
| `NODE_V8_COVERAGE=./coverage/tmp` | Raw V8 JSON for subprocess coverage | Set in `helpers.mjs` env forwarding to capture subprocess hits; required for CI-02 integration test coverage accuracy |
| `c8 report` | Re-generate reports from existing V8 JSON | Run after tests finish; separates collection from reporting |

## Installation

```bash
# Dev dependency only — no runtime impact
npm install -D c8@11.0.0
```

No other package.json changes needed. The glob fix and coverage flag are pure YAML/CLI changes.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `--experimental-test-coverage` (built-in) | `c8` wrapping node --test | Use c8 when you need HTML reports, `--all` flag for uncovered files, or Coveralls lcov upload. For a summary-only CI step, the built-in flag is sufficient. |
| `coverallsapp/github-action@v2` | `codecov/codecov-action@v4` | Codecov if the team already uses it; Coveralls is simpler for new OSS projects — no token needed, auto PR comments work out of the box |
| Quoted glob `"test/**/*.test.mjs"` | Bare `node --test` (no args) | Bare `node --test` discovers more than you might want (e.g. fixture files named `.test.mjs`). Explicit quoted glob is safer and more intentional. |
| Single `node --test` invocation with quoted glob | Two separate `node --test` calls (root + vue-sfc/) | Two calls leave a gap if more subdirs are added later; one recursive glob is self-maintaining. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `test/**/*.test.mjs` unquoted in GitHub Actions `run:` | bash on ubuntu-latest expands it at shell level; if no match, passes literal string or fails silently — this is the exact current bug | Quote the glob: `node --test "test/**/*.test.mjs"` |
| `nyc` | CommonJS-only internals; known ESM incompatibilities; superseded by c8 which uses the same V8 coverage backend natively | `c8` or `--experimental-test-coverage` |
| `jest` / `vitest` for coverage | Would require migrating 256 tests away from `node --test`; massive scope creep | `c8` + built-in test runner |
| `istanbul` directly | Instrument-based; doesn't work cleanly with native ESM without transpilation | `c8` (V8-native, no instrumentation) |
| Coverage threshold enforcement in v1.3 | Tests spawn subprocesses; src/ coverage will be low (~0-15%) until `NODE_V8_COVERAGE` forwarding is wired into helpers.mjs — enforcing thresholds now will fail CI | Add thresholds in v1.4 after subprocess forwarding is in place |

## Stack Patterns by Variant

**For CI-01 (glob fix only, minimal change):**
- Change `node --test test/*.test.mjs` → `node --test "test/**/*.test.mjs"` in ci.yml
- Zero new dependencies, zero risk

**For CI-03 (coverage reporting, summary only — no badge service):**
- Add `--experimental-test-coverage` to the test step
- Built-in `spec` reporter already prints a coverage summary to stdout
- No new npm deps, no external service

**For CI-03 (coverage reporting, full — lcov + Coveralls badge):**
- Add `c8@11.0.0` as devDependency
- Change test step to: `npx c8 --reporter=lcov node --test "test/**/*.test.mjs"`
- Add Coveralls upload step after tests: `coverallsapp/github-action@v2`
- Accepts near-zero src/ coverage as expected (subprocess constraint) — document in CI comments

**For CI-02 (integration tests against laravel/framework fixture):**
- No new stack needed — write `.test.mjs` files using existing `helpers.mjs` pattern
- Fixture already exists: `eval/fixtures/laravel-framework/` (from v1.1 eval)
- Integration tests call the real CLI via `execFileSync` — same pattern as existing tests
- If you want subprocess coverage hits, modify `helpers.mjs` to forward `NODE_V8_COVERAGE` env var

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `c8@11.0.0` | Node.js `>=18` | Safe — project already requires `>=18` |
| `c8@11.0.0` | ESM (`.mjs`) | Full support; V8-native, no transpilation needed |
| `--experimental-test-coverage` | Node 18+ | Flag name stable since 18; not yet `--test-coverage` without `experimental` prefix as of Node 22 |
| `coverallsapp/github-action@v2` | lcov format | Accepts lcov.info directly; auto-detects format |
| `actions/checkout@v5` | Current | Already in use — no change needed |
| `actions/setup-node@v5` | Current | Already in use — no change needed |

## The Subprocess Coverage Constraint (Critical Context)

agentmap-php tests work by spawning `node agentmap.mjs` as a subprocess via `execFileSync`. This means:

- `--experimental-test-coverage` and `c8` both collect coverage **in the test runner process only**
- `src/Core/*.mjs` is loaded **in the child process**, not the test runner process
- Result: coverage reports will show high coverage of `test/helpers.mjs` and near-zero coverage of `src/`

**This is expected and not a bug.** Two ways to handle it:

1. **Accept it for v1.3** — report what you can, add a CI comment explaining subprocess architecture. Coverage badge will show a low number but that's honest.
2. **Wire `NODE_V8_COVERAGE` forwarding in v1.3** — modify `test/helpers.mjs` to pass `{ env: { ...process.env, NODE_V8_COVERAGE: process.env.NODE_V8_COVERAGE } }` to every `execFileSync` call. c8 merges all the JSON files in the dir automatically. This gives accurate src/ coverage but touches the test helper.

Option 2 is ~5 lines in `helpers.mjs` and is the right long-term choice. Recommend doing it in v1.3 since you're already touching the test infrastructure.

## Sources

- `https://nodejs.org/docs/latest-v22.x/api/test.html` — Node.js test runner docs (glob behavior, `--experimental-test-coverage`, built-in reporters, `NODE_V8_COVERAGE`) — verified 2026-06-21 — confidence LOW (webfetch)
- `https://github.com/bcoe/c8` — c8 README, v11.0.0 release, option reference — verified 2026-06-21 — confidence LOW (webfetch)
- `https://github.com/coverallsapp/github-action` — Coveralls GitHub Action v2, input reference — verified 2026-06-21 — confidence LOW (webfetch)
- `npm show c8 version` — confirmed v11.0.0 is current latest — verified 2026-06-21 — confidence MEDIUM (local npm)
- `agentmap-php/.github/workflows/ci.yml` — existing CI structure inspected directly — HIGH (codebase)
- `agentmap-php/package.json` — existing deps and scripts inspected directly — HIGH (codebase)
- `agentmap-php/test/` — test directory structure inspected directly — HIGH (codebase)

---
*Stack research for: agentmap-php v1.3 CI integration testing + coverage reporting (Node.js ESM, node --test)*
*Researched: 2026-06-21*
