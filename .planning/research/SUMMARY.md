# Project Research Summary

**Project:** agentmap-php v1.3 — CI Integration Testing & Coverage
**Domain:** Node.js ESM CLI tool — CI pipeline hardening, integration tests, coverage reporting
**Researched:** 2026-06-21
**Confidence:** MEDIUM

## Executive Summary

agentmap-php is an existing, working Node.js ESM CLI tool with 256 passing tests — but the CI pipeline silently skips 43 of them due to a glob that doesn't recurse into `test/vue-sfc/`. The v1.3 milestone is not a new product; it's a focused CI credibility fix with three discrete deliverables: (1) correct the glob so all tests run, (2) add an integration test that exercises the real CLI against a laravel/framework fixture, and (3) surface a coverage report in CI logs. The work is surgical and low-risk — two files change (`ci.yml`, `package.json`), two files are created (`test/integration-laravel.test.mjs`, optional `test/fixtures/laravel-fixture.mjs`).

The recommended approach is: fix the glob first (one YAML line), then layer integration tests using the existing `run()`/`makeRepo()`/`gitInit()` helper pattern, then add a `c8`-based coverage step. The existing test infrastructure already supports everything needed — no new test framework, no new runner, no new patterns. The subprocess architecture (tests invoke `agentmap.mjs` via `execFileSync`) means `--experimental-test-coverage` alone won't cover `src/`; `c8` is required to collect V8 coverage across all spawned processes.

The primary risks are subtle and operational: unquoted globs silently expand wrong in CI's non-interactive bash; the `lcov` reporter silences all test output if it's the only reporter; integration tests against the laravel fixture need a `gitInit()` call or the CLI errors with "not a git repository"; and coverage threshold flags don't exist on Node 18/20, requiring a matrix condition. All five critical pitfalls are well-understood and have precise, low-cost fixes documented in research.

## Key Findings

### Recommended Stack

The project already has the right stack — no new runtime dependencies. The only additions are `c8@11.0.0` as a devDependency (for subprocess-aware V8 coverage collection) and the `coverallsapp/github-action@v2` GitHub Action (optional, for a coverage badge). Everything else — test runner, reporters, fixture helpers — is already in place and working.

The subprocess architecture is the key constraint to understand: `agentmap.mjs` is invoked via `execFileSync`, not imported. This means `--experimental-test-coverage` (Node built-in) only covers the test harness process, not `src/Core/`. Using `c8` as a wrapper resolves this — it sets `NODE_V8_COVERAGE` which V8 propagates into every spawned subprocess, including the CLI being tested.

**Core technologies:**
- `node --test` (built-in, Node 18/20/22): Test runner — already in use, no migration needed
- `c8@11.0.0` (devDep only): V8 coverage wrapping — only tool that captures subprocess coverage without modifying test files
- `coverallsapp/github-action@v2`: lcov upload — free for public OSS, auto PR comments, zero token setup
- `actions/checkout@v5` + `actions/setup-node@v5`: Already in CI matrix — unchanged

### Expected Features

The research defines three P1 deliverables for v1.3 and two P2/P3 items deferred to v1.4+.

**Must have (table stakes — v1.3):**
- CI glob fix (CI-01) — CI badge is meaningless if 43/256 tests are silently skipped; one YAML line
- Integration test against laravel/framework (CI-02) — proves `--packages`, `--types`, `--legacy` flags work end-to-end against a real PHP repo
- Coverage summary in CI log (CI-03) — developers expect to see a coverage number; no external service required

**Should have (competitive — v1.4):**
- Coverage threshold enforcement (`--test-coverage-lines=N` on Node 22 leg) — blocks regressions; safe only after baseline is measured
- Coverage upload to Coveralls or lcov PR annotation — useful once there are multiple contributors

**Defer (v2+):**
- Full laravel/framework integration suite (beyond the three core flags) — too slow, too broad for v1.3
- Test sharding (`--test-shard`) — not a bottleneck at current scale
- Full coverage service with trend tracking — overkill until contributor base grows

### Architecture Approach

The architecture is a three-layer CI pipeline: a test execution layer (`c8` wrapping `node --test` with a recursive glob), a coverage collection layer (`NODE_V8_COVERAGE` propagating through all subprocess levels into `agentmap.mjs`), and a fixture/helper layer (`test/helpers.mjs` providing `makeRepo`/`gitInit`/`run`/`cleanup`). Only `ci.yml` and `package.json` are modified; `test/helpers.mjs` and `eval/eval.mjs` are unchanged.

**Major components:**
1. `.github/workflows/ci.yml` — fix glob in Run tests step; add Clone fixture + Coverage steps
2. `test/integration-laravel.test.mjs` — new file; integration tests using existing `run()` helper against `tmp/eval/laravel-framework`; skips if fixture absent
3. `package.json` — add `c8@11.0.0` to devDependencies
4. `.gitignore` — add `coverage/` directory
5. `test/helpers.mjs` — unchanged; already provides the full harness

### Critical Pitfalls

1. **Unquoted glob in CI `run:` step** — bash on GitHub Actions does not enable `globstar` in non-interactive mode; `**` expands as `*`. Fix: quote the glob (`"test/**/*.test.mjs"`) or use `npm test`. This is the root cause of the current bug.

2. **`lcov` as sole reporter silences all test output** — the lcov reporter emits no TAP/spec lines by design. CI step passes with empty log. Fix: always pair with `--test-reporter=spec --test-reporter-destination=stdout`.

3. **Integration test against fixture without `gitInit()`** — `agentmap.mjs` requires a git repo for cache staleness detection. Running CLI directly against `eval/laravel-framework/` (no `.git`) fails or produces empty output. Fix: copy fixture files into `makeRepo()` temp dir and call `gitInit(dir, { commit: true })` before invoking `run()`.

4. **Coverage threshold flags absent on Node 18/20** — `--test-coverage-lines` etc. were added in Node 22.8+. On 18/20 matrix legs they cause an error or silently don't enforce. Fix: condition the threshold coverage step on `if: matrix.node-version == 22`.

5. **No `execFileSync` timeout on large-fixture tests** — CLI invoked against the full laravel/framework clone with no timeout can hang the CI worker indefinitely. Fix: pass `timeout: 30_000` in all `execFileSync` calls in integration tests.

## Implications for Roadmap

Based on research, the dependency chain is strictly linear: glob fix unblocks integration tests, which must exist before coverage numbers are meaningful. Three phases, in order.

### Phase 1: Fix CI Glob (CI-01)

**Rationale:** This is the root bug — it makes 43 tests invisible to CI. It is a one-line change with zero risk and unblocks everything else. Must land first so CI is green and trustworthy before adding new tests.
**Delivers:** CI runs all 256 tests on every push; test count in CI matches `npm test` locally; no silent skip.
**Addresses:** Table stakes feature "all test files actually run in CI"; "exit code reflects real test outcome".
**Avoids:** Pitfall 1 (unquoted glob) and Pitfall 2 (globstar not set in non-interactive bash) — fix both simultaneously by quoting the glob or using `npm test`.
**Research flag:** Standard pattern — no additional research needed. Change is: `node --test test/*.test.mjs` → `node --test "test/*.test.mjs" "test/**/*.test.mjs"` (or `npm test`).

### Phase 2: Integration Tests Against laravel/framework (CI-02)

**Rationale:** Once CI is green with all 256 tests, add the integration test file. It lives in `test/` root (caught by the fixed glob automatically) and reuses the existing `run()`/`makeRepo()`/`gitInit()` helpers — no new patterns needed. The laravel/framework clone is already produced by `eval/eval.mjs`; a CI step to ensure it exists is the only new infrastructure.
**Delivers:** `test/integration-laravel.test.mjs` with assertions on `--packages`, `--types`, `--legacy` exit codes and structural output invariants against the real laravel/framework repo.
**Uses:** Existing `test/helpers.mjs` harness; `tmp/eval/laravel-framework` clone; conditional skip pattern.
**Implements:** Subprocess Black-Box Testing pattern (Architecture Pattern 1) and Conditional Skip on Missing Fixture pattern (Architecture Pattern 3).
**Avoids:** Pitfall 3 (gitInit required), Pitfall 5 (timeout on large fixture), Anti-Pattern 3 (no exact line count assertions — assert structural invariants only), Anti-Pattern 4 (scope clone step to one matrix leg or cache it).
**Research flag:** Moderate complexity — the fixture git-init requirement and skip-guard pattern need careful implementation. The plan should reference `test/helpers.mjs` directly and verify the `tmp/eval/laravel-framework` path matches what `eval.mjs` produces.

### Phase 3: Coverage Reporting (CI-03)

**Rationale:** With all tests running and an integration test in place, coverage numbers become meaningful. Add `c8` and a new CI step. The subprocess architecture means `--experimental-test-coverage` alone gives misleading results — `c8` is required for accurate `src/` coverage.
**Delivers:** Coverage summary (text + lcov) in every CI run on Node 20/22; `coverage/lcov.info` artifact available for optional upload; optional Coveralls badge.
**Uses:** `c8@11.0.0` (devDep); `coverallsapp/github-action@v2` (optional); dual-reporter pattern (`spec` to stdout + `lcov` to file).
**Implements:** c8 Coverage Wrapping pattern (Architecture Pattern 2) and coverage data flow through subprocess chain.
**Avoids:** Pitfall 4 (lcov-only reporter), Pitfall 5 (threshold flags conditioned on Node 22 only), Anti-Pattern 1 (`--experimental-test-coverage` instead of `c8`).
**Research flag:** One nuance needs a plan-time decision: whether to enforce a threshold in v1.3 or defer to v1.4. Research recommends deferring (baseline unknown; subprocess coverage will be low until `NODE_V8_COVERAGE` forwarding is confirmed working). Plan should document the expected low coverage number and why it's correct.

### Phase Ordering Rationale

- CI-01 must precede CI-02: adding integration tests to a CI that skips existing tests would give false confidence
- CI-01 must precede CI-03: coverage of a partial test run is misleading
- CI-02 can be developed locally in parallel with CI-01, but should not be merged until CI-01 lands
- CI-03 depends on CI-01 (glob fix ensures all tests are included in coverage run); CI-02 is independent of CI-03 but benefits from being in place first so integration test hits are included in the coverage report

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (CI-02):** Verify the exact path `eval.mjs` writes the laravel/framework clone to (`tmp/eval/laravel-framework` vs `tmp/laravel-framework`); confirm `makeRepo()` + `gitInit()` signature in `helpers.mjs` before writing the test file; check whether `run()` already forwards env vars or needs modification for coverage.
- **Phase 3 (CI-03):** Confirm `c8@11.0.0` lcov output path default (`coverage/lcov.info`) matches what `coverallsapp/github-action@v2` expects; verify Node 18 matrix leg behavior when coverage step is conditioned out.

Phases with standard patterns (skip research-phase):
- **Phase 1 (CI-01):** The fix is a one-line YAML change. Pattern is fully documented and verified against the actual `ci.yml` and `package.json`. No research needed during planning.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | `c8` and `coverallsapp` docs fetched via webfetch (LOW individual), but cross-checked against codebase and npm — net MEDIUM. Node built-in flags verified from official docs. |
| Features | MEDIUM | Table stakes derived from direct codebase inspection (HIGH) + community practice for comparable tools (LOW). Differentiator features validated against Node.js official docs. |
| Architecture | MEDIUM | Subprocess coverage constraint cross-checked between Node docs and c8 README. Component responsibilities derived from direct codebase read (HIGH). c8 lcov output behavior: MEDIUM. |
| Pitfalls | HIGH | Four of five pitfalls empirically verified on this exact repo (glob count mismatch confirmed; `ci.yml` line 32 inspected directly). Threshold flag availability confirmed via Node 22 release notes. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Actual subprocess coverage %:** Research predicts low `src/` coverage until `NODE_V8_COVERAGE` is confirmed propagating through `helpers.mjs` → `agentmap.mjs`. Run the coverage step once and measure before setting any threshold. Document the number in the Phase 3 plan.
- **laravel/framework clone path:** `eval.mjs` writes to a path that should be verified during Phase 2 planning. The integration test's `LARAVEL` constant must match exactly or the skip guard fires silently.
- **`run()` env forwarding:** `test/helpers.mjs`'s `run()` function may or may not forward `NODE_V8_COVERAGE` to the child process. Needs a read during Phase 2 planning — if it doesn't forward, coverage of the CLI subprocess will be zero even with `c8`.
- **Coveralls token for public repo:** Research suggests `coverallsapp/github-action@v2` works with only `GITHUB_TOKEN` for public repos, but this should be verified against the actual action docs before Phase 3 planning.

## Sources

### Primary (HIGH confidence)
- `agentmap-php/.github/workflows/ci.yml` — confirmed glob mismatch; line 32 uses `test/*.test.mjs`
- `agentmap-php/test/helpers.mjs` — confirmed `run()`, `makeRepo()`, `gitInit()`, `cleanup()` harness
- `agentmap-php/package.json` — confirmed existing deps, `>=18` engine requirement, npm test script
- `agentmap-php/test/` directory — confirmed 256 tests, `vue-sfc/` subdirectory with 8 files, 43 assertions
- Node.js v22 release notes — threshold flag availability (`--test-coverage-lines` added in 22.8+)

### Secondary (MEDIUM confidence)
- Node.js v22.23.0 test runner docs (`nodejs.org/docs/latest-v22.x/api/test.html`) — glob behavior, `--experimental-test-coverage`, subprocess model, lcov reporter
- `npm show c8 version` — confirmed v11.0.0 is current latest
- `eval/eval.mjs` — laravel/framework clone logic and target path

### Tertiary (LOW confidence)
- c8 GitHub README (`github.com/bcoe/c8`) — `NODE_V8_COVERAGE` propagation, subprocess coverage, lcov reporter — webfetch only
- `coverallsapp/github-action` README — input reference, token requirements for public repos — webfetch only
- Community practice for comparable Node.js CLI tools (zx, ts-node, tsx) — coverage and CI patterns

---
*Research completed: 2026-06-21*
*Ready for roadmap: yes*
