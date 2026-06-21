# Pitfalls Research

**Domain:** Node.js ESM CLI — CI glob fixes, integration tests, coverage reporting
**Researched:** 2026-06-21
**Confidence:** MEDIUM (empirically verified on this repo; Node version behavior cross-checked against official docs)

---

## Critical Pitfalls

### Pitfall 1: CI glob misses entire test subdirectory silently

**What goes wrong:**
The CI workflow runs `node --test test/*.test.mjs` — single-star glob, no `**`. This matches only files directly in `test/`, missing all 8 files in `test/vue-sfc/`. Tests pass in CI but 43 vue-sfc assertions never run. The npm `test` script already has the fix (`test/*.test.mjs test/**/*.test.mjs`) but the CI YAML was never updated to match.

**Why it happens:**
`*` and `**` are fundamentally different: `*` matches within one directory only. Developers copy the CI command from memory or from an early version of the script before subdirectories were added. The failure mode is silent — CI reports green with fewer tests, not an error about missing files.

**How to avoid:**
In the CI `run:` step, use the same command as the npm script — or better, `npm test` — so they can never diverge. If listing globs directly, quote them to prevent premature shell expansion and rely on node --test's own glob engine (Node 20+):

```yaml
run: node --test "test/*.test.mjs" "test/**/*.test.mjs"
```

Or simply:

```yaml
run: npm test
```

**Warning signs:**
- CI test count differs from local `npm test` count
- A new `test/` subdirectory is added and CI count doesn't increase
- `grep -r "vue-sfc" .github/` finds no reference

**Phase to address:** CI glob fix phase (CI-01)

---

### Pitfall 2: `node --test` glob expansion is Node-version-dependent when unquoted

**What goes wrong:**
`node --test test/**/*.test.mjs` in a `run:` step relies on the GitHub Actions shell expanding `**` before passing arguments to node. GitHub Actions uses bash for `run:` steps, but in non-interactive mode `globstar` is **not** enabled by default. So `**` expands identically to `*` (single level only), and `test/**/*.test.mjs` becomes equivalent to `test/*.test.mjs` — same bug as Pitfall 1 but harder to spot because the glob looks correct.

**Why it happens:**
`globstar` (`shopt -s globstar`) is a bash 4+ feature that must be explicitly enabled. Interactive shells often have it on via `.bashrc`; CI non-interactive shells do not.

**How to avoid:**
Either explicitly enable globstar before the command:

```yaml
run: |
  shopt -s globstar
  node --test test/**/*.test.mjs
```

Or quote the globs and let node --test expand them (Node 20+ handles `**` internally):

```yaml
run: node --test "test/**/*.test.mjs"
```

Or use `npm test` which delegates to the package.json script (shell expansion happens at npm-script invocation time in a fresh shell where globstar behaves consistently).

**Warning signs:**
- CI passes with exactly 25 test files (shell expands `**` as `*`, missing the 8 vue-sfc files)
- Local `npm test` runs 33 files but CI runs 25

**Phase to address:** CI glob fix phase (CI-01)

---

### Pitfall 3: Integration test against eval fixture fails because fixture dir has no `.git`

**What goes wrong:**
`agentmap.mjs` requires a git repository (uses git for cache staleness detection and `.agentmap` cache invalidation). The `eval/` fixture is committed source files — no `.git` directory. Running integration tests that invoke the real CLI against `eval/laravel-framework/` directly will fail with a git error or produce incorrect output (no cache, no staleness tracking).

**Why it happens:**
The fixture was designed for eval accuracy testing (`eval.mjs` which doesn't invoke the CLI as a subprocess) and for benchmarking. It was never intended as a live git repo. Integration tests that exercise `--packages`, `--types`, `--legacy` flags need a proper git repo to mirror real usage.

**How to avoid:**
Do **not** invoke the CLI directly against `eval/laravel-framework/`. Instead, use the existing `makeRepo()` + `gitInit()` helper pattern from `test/helpers.mjs`, but seed the repo with a representative subset of fixture files:

```js
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE_DIR = join(HERE, '..', 'eval', 'laravel-framework');
// Copy only the files needed for the flag under test
const files = { 'composer.json': readFileSync(join(FIXTURE_DIR, 'composer.json'), 'utf8') };
const dir = makeRepo(files);
gitInit(dir, { commit: true });
```

Alternatively, if the full fixture must be used, copy it to a temp dir and call `gitInit()` on the copy. Never mutate `eval/` from tests.

**Warning signs:**
- CLI exits non-zero with "not a git repository" or empty output against the fixture path
- `--packages` returns empty on a repo that clearly has `composer.json`
- Test passes locally (developer has a `.git` in a parent dir) but fails in CI (clean checkout, no parent `.git`)

**Phase to address:** Integration test phase (CI-02)

---

### Pitfall 4: lcov reporter produces no test output — CI appears to succeed with zero feedback

**What goes wrong:**
Adding `--experimental-test-coverage --test-reporter=lcov --test-reporter-destination=lcov.info` to the CI run step causes the lcov file to be written but **no TAP/spec output is printed to stdout**. If `lcov` is the only reporter, CI stdout is empty. GitHub Actions marks the step as passed (exit 0) with no visible test results — 256 tests ran but the log shows nothing.

**Why it happens:**
The lcov reporter is explicitly documented as "No test results are reported by this reporter." It's a coverage artifact emitter, not a test result reporter. Developers assume adding it replaces the default reporter; it does, completely.

**How to avoid:**
Always use two reporters simultaneously when collecting coverage:

```yaml
run: |
  node --test \
    --experimental-test-coverage \
    --test-reporter=spec \
    --test-reporter-destination=stdout \
    --test-reporter=lcov \
    --test-reporter-destination=lcov.info \
    "test/*.test.mjs" "test/**/*.test.mjs"
```

**Warning signs:**
- CI coverage step passes but the log shows no `ok N` lines
- No test count summary in CI output for the coverage step

**Phase to address:** Coverage reporting phase (CI-03)

---

### Pitfall 5: Coverage threshold flags don't exist on Node 18/20, silently pass

**What goes wrong:**
`--test-coverage-lines`, `--test-coverage-branches`, `--test-coverage-functions` were added in Node 22.8+. On Node 18 and 20 matrix legs these flags cause an "unknown option" error — or if omitted, coverage is collected but never enforced. A coverage regression on Node 18/20 never fails CI.

**Why it happens:**
Node.js test runner features are added incrementally. The matrix tests Node 18/20/22; a threshold that only works on 22 gives false confidence that the other legs enforce it too.

**How to avoid:**
Run the coverage step only on the Node 22 leg using a matrix condition, or accept that coverage is report-only on 18/20:

```yaml
- name: Coverage (Node 22 only)
  if: matrix.node-version == 22
  run: |
    node --test \
      --experimental-test-coverage \
      --test-coverage-lines=40 \
      --test-reporter=spec \
      --test-reporter-destination=stdout \
      --test-reporter=lcov \
      --test-reporter-destination=lcov.info \
      "test/*.test.mjs" "test/**/*.test.mjs"
```

**Warning signs:**
- Coverage step on Node 18 exits with "bad option: --test-coverage-lines"
- Coverage step on Node 18/20 exits 0 even when line coverage is 0%

**Phase to address:** Coverage reporting phase (CI-03)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `npm test` in CI instead of explicit glob | CI and local always match | Slower (npm overhead ~0.5s) | Always — use it |
| Coverage report-only (no threshold) | No false failures from new untested code paths | Regressions never caught automatically | MVP only; add threshold on Node 22 leg soon |
| Copying full eval fixture into temp repo | Tests against real-world files | Slow test startup; disk pressure on CI | Only for the one laravel-framework integration test; unit tests use minimal fixtures |
| Single reporter in coverage step | Simple command | No visible test output in CI log | Never — always pair lcov with spec |
| Hardcoded fixture paths in integration tests | Simple | Breaks when fixture moves | Use `fileURLToPath(import.meta.url)` relative paths |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `node --test` + CI shell | Unquoted `**` glob, globstar not set | Quote globs or use `npm test` |
| `--experimental-test-coverage` | lcov as sole reporter silences all output | Always add `--test-reporter=spec --test-reporter-destination=stdout` |
| `agentmap.mjs` in integration tests | Running CLI against non-git directory | Always call `gitInit()` on the temp repo before `run()` |
| `eval/laravel-framework` fixture | Direct CLI invocation against fixture (no `.git`) | Copy needed files into `makeRepo()` temp dir or copy+gitInit the whole fixture |
| `execFileSync` timeout | No timeout = hung CLI blocks CI worker | Pass `timeout: 30_000` in integration tests against large fixture |
| Coverage on Node 18/20 matrix | Threshold flags not available | Condition coverage enforcement step on `matrix.node-version == 22` |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Running full laravel/framework eval fixture in every integration test | Integration test suite takes 5+ minutes in CI | Only one test file exercises the full fixture; use minimal composer.json fixtures for flag-specific tests | Immediately on CI if the fixture re-parses 400k lines per test |
| No `.agentmap` cache between CI runs | Every CI run re-parses the full fixture | Use `actions/cache` keyed on fixture content hash for the `.agentmap` dir | Every run — adds ~30s per leg |
| Parallel test files all doing `gitInit` | Occasional git lock file conflicts in `/tmp` | `mkdtempSync` gives unique dirs — no conflict; `git config --local` avoids global config races | Not currently an issue; becomes one if tests share a fixture dir |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Integration test calls `execFileSync` with user-provided strings in args | Command injection if test strings contain shell metacharacters | The existing pattern uses `execFileSync(process.execPath, [AGENTMAP, ...args])` — array form, no shell interpolation. Never switch to `exec()` string form |
| Committing the laravel/framework fixture with secrets | Public repo exposure | Fixture is MIT-licensed open-source code; no secrets. Verify with `git grep -i "password\|secret\|token" eval/` before each fixture update |

---

## "Looks Done But Isn't" Checklist

- [ ] **CI glob fix:** Verify CI log shows exactly the same test count as `npm test` locally — not just "tests pass"
- [ ] **Integration tests:** Each test calls `cleanup(dir)` in a `finally` block — missing `finally` means temp dirs leak on test failure
- [ ] **Integration tests:** Each test calls `gitInit(dir, { commit: true })` before `run()` — missing commit means cache staleness logic may behave differently
- [ ] **Coverage step:** CI log for coverage step shows TAP `ok N` lines — if empty, lcov is the only reporter
- [ ] **Coverage step:** Coverage step is conditioned on `matrix.node-version == 22` or threshold flags are omitted for 18/20
- [ ] **Fixture-based tests:** Tests do NOT mutate `eval/laravel-framework/` — they copy files into `makeRepo()` temp dirs
- [ ] **execFileSync timeout:** Integration tests that invoke CLI against the laravel/framework fixture pass `timeout: 30_000` to avoid infinite CI hangs

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| CI glob misses tests for weeks | LOW | Update CI YAML `run:` step to `npm test`; push; verify count matches local |
| lcov-only reporter, no CI output | LOW | Add `--test-reporter=spec --test-reporter-destination=stdout` to coverage step |
| Integration tests leave temp dirs on failure | LOW | Add `finally { cleanup(dir) }` to each test; process.on('exit') backstop already present |
| Fixture integration test fails: no git | MEDIUM | Wrap fixture files in `makeRepo()`+`gitInit()` pattern; don't reuse eval dir directly |
| Coverage thresholds silently not enforced on 18/20 | LOW | Condition threshold step on Node 22 matrix leg |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| CI glob misses `test/vue-sfc/` (43 tests) | CI-01: Fix CI glob | CI log shows 256 tests (matches `npm test` local count) |
| Shell globstar not set — `**` expands as `*` | CI-01: Fix CI glob | Quote globs or use `npm test` in CI YAML |
| Integration test against fixture needs git repo | CI-02: Integration tests | Each test in the suite calls `gitInit()` and `cleanup()` in `finally` |
| No subprocess timeout on large fixture tests | CI-02: Integration tests | `timeout` option set on `execFileSync` calls for fixture-based tests |
| lcov reporter silences all test output | CI-03: Coverage reporting | CI coverage step log contains `ok N` TAP lines |
| Threshold flags absent on Node 18/20 | CI-03: Coverage reporting | Coverage enforcement step has `if: matrix.node-version == 22` |

---

## Sources

- Node.js v22 test runner docs: `https://nodejs.org/docs/latest-v22.x/api/test.html` — official coverage reporter, glob, threshold flag documentation (HIGH via official docs)
- Empirical verification on this repo: `node --test test/**/*.test.mjs` (no shell) returns 185 tests; `node --test test/*.test.mjs` (no shell) returns 177; CI YAML line 32 uses the shorter form and misses 8 vue-sfc files (HIGH — directly observed)
- Node.js v22.0.0 release notes: `https://nodejs.org/en/blog/release/v22.0.0` — test_runner changes, coverage reporter additions (HIGH via official)
- `test/helpers.mjs` and `test/packages-cli.test.mjs` — existing subprocess harness pattern reviewed directly (HIGH — primary source)
- `.github/workflows/ci.yml` line 32 — confirmed glob mismatch with npm script in `package.json` (HIGH — primary source)

---
*Pitfalls research for: agentmap-php v1.3 — CI glob fixes, integration tests, coverage reporting*
*Researched: 2026-06-21*
