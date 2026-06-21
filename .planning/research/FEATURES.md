# Feature Research

**Domain:** Node.js CLI tool CI pipeline — test coverage, integration tests, glob fixes
**Researched:** 2026-06-21
**Confidence:** MEDIUM (glob/coverage from Node.js official docs; integration test patterns from existing codebase + community practice)

## Feature Landscape

### Table Stakes (Users Expect These)

Features any well-maintained Node.js CLI tool's CI pipeline must have. Missing these = CI is not credible.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| All test files actually run in CI | CI badge is meaningless if 43/299 tests are silently skipped | LOW | Current bug: `node --test test/*.test.mjs` misses `test/vue-sfc/` (9 files). Shell glob doesn't recurse. Fix is one line. |
| Exit code reflects real test outcome | CI must go red when tests fail | LOW | Already works correctly; only broken by missing files |
| Consistent results across Node matrix (18/20/22) | Maintainers and contributors need to trust the matrix | LOW | Already in place; fix must preserve matrix compatibility |
| Coverage number visible in CI | Developers expect to see what % of `src/Core/` is covered | MEDIUM | `--experimental-test-coverage` on Node 20/22 prints summary to stdout — zero new deps. Use `c8` for Node 18 compatibility or skip coverage step on Node 18 only. |
| Integration test against real CLI invocation | Unit tests prove module logic; integration tests prove the binary works end-to-end | MEDIUM | Existing tests already use `execFileSync`-based `run()` helper (see `helpers.mjs`). Pattern is established — add a new `integration.test.mjs` using the same helper against a pre-committed fixture. |

### Differentiators (Competitive Advantage)

Features that go beyond the minimum and signal a high-quality, trustworthy open-source tool.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Integration tests against real `laravel/framework` fixture | Proves PHP/Laravel support works on a canonical, large real-world repo — not just toy fixtures | MEDIUM | Fixture must either be committed (subset) or cloned at test time with a skip guard when absent. The `eval.mjs` already clones to `tmp/eval/`; test can reuse that path. |
| Assert on known-good output values from `--packages`, `--types`, `--legacy` | Guards against regressions in the three v1.2 CLI flags specifically | MEDIUM | Requires stable ground-truth values (e.g. `laravel/framework` always has `illuminate/support` as a package). Lock these as literal assertions. |
| Coverage report as PR annotation or CI artifact | Makes coverage regressions visible in code review without requiring a coverage service account | MEDIUM | `coverallsapp/github-action` or `codecov/codecov-action` both accept `lcov.info`. For a public MIT repo, both services have free tiers. Alternatively, `lcov-reporter-action` posts as a PR comment with zero external accounts. |
| `--test-coverage-lines` threshold enforced in CI | CI goes red if line coverage drops below a set floor | LOW | Add `--test-coverage-lines=80` (or chosen threshold) to the coverage step. Node 20+ only — gate behind `if: matrix.node-version != 18`. |
| Coverage excludes `test/` and `eval/` from report | Coverage number reflects only `src/Core/` and `agentmap.mjs`, not test helpers | LOW | `--test-coverage-exclude=test/**` `--test-coverage-exclude=eval/**` `--test-coverage-exclude=benchmark/**` |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Clone `laravel/framework` (full repo, ~60MB) during every CI run | "Real" fixture for integration tests | Adds 30-60s to every CI job; flaky on network failures; depends on GitHub availability; breaks offline dev | Commit a minimal fixture subset (10-20 PHP files covering the key patterns) to `test/fixtures/laravel-minimal/`. Same assertions, zero network dependency. |
| Use Jest or Vitest for test runner | Familiar API, watch mode, snapshot support | Project already uses `node --test` (194 tests passing); adding a second runner creates split context; Jest requires config + transform setup for `.mjs` ESM | Stay on `node:test`. It handles everything needed here. |
| Full coverage service (Codecov/Coveralls) with badge | Looks professional, tracks coverage over time | Requires secret token setup, external service account, maintenance; overkill for a focused tool fork | Start with `--experimental-test-coverage` summary in CI logs. Add coverage service only if the project attracts contributors who need trend tracking. |
| Integration tests that network-clone fixtures at test runtime in CI | "Always up to date" fixture | Slow, flaky, can't run locally without network, CI cache invalidation complexity | Pre-commit a pinned fixture snapshot. Repin manually when intentional fixture updates are needed. |
| 100% coverage threshold | Signals rigor | Tree-sitter parser wrappers and CLI entry paths are hard to cover without fixtures for every edge case; enforcing 100% causes test contortions | Set a realistic floor (70-80% lines) that excludes known-untestable branches. |

## Feature Dependencies

```
CI glob fix (CI-01)
    └──enables──> Integration tests run in CI (CI-02)
                      └──requires──> Fixture available on disk
                                         └──option A──> Committed minimal fixture (test/fixtures/laravel-minimal/)
                                         └──option B──> Clone guard (skip if tmp/eval/laravel-framework absent)

Coverage reporting step (CI-03)
    └──requires──> All tests run (CI-01 fixed)
    └──requires──> Node version awareness (--experimental-test-coverage = Node 20+ only)
                      └──option A──> c8 devDep covers Node 18 too
                      └──option B──> matrix.node-version != 18 condition in workflow

Integration tests (CI-02)
    └──reuses──> helpers.mjs run() / makeRepo / cleanup (already exists)
    └──reuses──> eval fixture cloning logic (already in eval.mjs)
    └──does NOT require──> new test framework (node:test is sufficient)

--test-coverage-lines threshold
    └──requires──> Coverage reporting step (CI-03)
    └──conflicts──> Node 18 matrix entry (threshold flag not available on 18)
```

### Dependency Notes

- **CI-01 must land before CI-02/CI-03:** Integration tests running against a broken glob would pass only partially, giving false confidence. Fix the glob first.
- **Fixture strategy gates CI-02 complexity:** Committed minimal fixture = simple, reliable, fast. Cloned fixture = flexible but fragile. Choose before writing the test.
- **Coverage on Node 18 is a known gap:** `--experimental-test-coverage` is Node 20+. Either add `c8` as a devDep (covers all three matrix versions uniformly) or conditionally skip the coverage step on Node 18. The `c8` approach is cleaner.

## MVP Definition

This is a subsequent milestone on an existing, working project. "MVP" here means: minimum changes to make CI fully correct and credible.

### Launch With (v1.3)

- [x] **CI glob fix** — one-line change to `ci.yml`; unblocks all other work. Change `test/*.test.mjs` to `test/*.test.mjs test/vue-sfc/*.test.mjs` (or use `--test` flag with auto-discovery).
- [x] **Integration test file** — `test/integration.test.mjs` using existing `run()` helper against a committed minimal fixture or the `tmp/eval/` guard pattern. Asserts exit 0, known package names, known type output for `--packages`, `--types`, `--legacy`.
- [x] **Coverage step in CI** — single new step in `ci.yml` using `node --experimental-test-coverage` on Node 20/22, or `c8` across all three versions. Summary printed to CI log; no external service required.

### Add After Validation (v1.x)

- [ ] **Coverage threshold enforcement** — `--test-coverage-lines=N` once a stable baseline is measured. Don't guess the number before running coverage once.
- [ ] **Coverage upload to Codecov or lcov PR comment** — add only if contributors start asking "did I break coverage?". Zero value until there are multiple contributors.

### Future Consideration (v2+)

- [ ] **Full `laravel/framework` integration test suite** — broader assertion set against the full eval fixture. Useful once the project has multiple contributors and a release cadence. Too slow for v1.3.
- [ ] **Test sharding** (`--test-shard`) — relevant only if the matrix run time becomes a bottleneck. Currently fast enough.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| CI glob fix (CI-01) | HIGH | LOW | P1 |
| Integration tests — `--packages`/`--types`/`--legacy` (CI-02) | HIGH | MEDIUM | P1 |
| Coverage summary in CI log (CI-03) | MEDIUM | LOW | P1 |
| Coverage threshold enforcement | MEDIUM | LOW | P2 |
| Coverage upload / PR annotation | LOW | MEDIUM | P3 |
| Full laravel/framework integration suite | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.3 launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

Comparable Node.js CLI tools with CI pipelines (zx, ts-node, tsx):

| Feature | zx / ts-node / tsx pattern | agentmap-php current | v1.3 target |
|---------|----------------------------|----------------------|-------------|
| Test glob | `node --test "**/*.test.mjs"` or Vitest | `node --test test/*.test.mjs` (flat only) | `node --test test/*.test.mjs test/vue-sfc/*.test.mjs` |
| Integration tests | Subprocess invocation of CLI binary | Exists for flags; missing real-fixture tests | Add `integration.test.mjs` |
| Coverage | `c8` or `--experimental-test-coverage` + lcov upload | None | `--experimental-test-coverage` summary; optional c8 for Node 18 |
| Node matrix | 18/20/22 or LTS+current | 18/20/22 ✓ | Keep as-is |

## Sources

- Node.js v22 CLI docs (`--experimental-test-coverage`, `--test-coverage-*`, `--test`): https://nodejs.org/docs/latest-v22.x/api/cli.html — MEDIUM confidence (official docs)
- Node.js v22 Test runner docs (glob behavior, `--test` auto-discovery, lcov reporter): https://nodejs.org/docs/latest-v22.x/api/test.html — MEDIUM confidence (official docs)
- Existing codebase: `test/helpers.mjs`, `test/packages-cli.test.mjs`, `.github/workflows/ci.yml`, `eval/eval.mjs` — HIGH confidence (direct inspection)
- c8 / coverage integration patterns: community practice — LOW confidence (websearch)

---
*Feature research for: agentmap-php v1.3 CI Integration Testing*
*Researched: 2026-06-21*
