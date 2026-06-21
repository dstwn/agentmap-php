---
phase: 16-integration-cli
plan: "01"
subsystem: testing
tags: [node-test, tdd, red-tests, packages, types, legacy, pagerank, composer, php]

requires:
  - phase: 15-type-resolution-advanced
    provides: TypeResolver with resolveChain, enhanced.types backfilled in agentmap.mjs
provides:
  - RED test suite for --packages CLI output (CMP-05)
  - RED test suite for package PageRank edge merging (CMP-04)
  - RED test suite for --types CLI output with confidence filtering (TYP-05)
  - RED test suite for --legacy CLI output (LEG-03)
affects:
  - 16-02 (implementation plan that turns these RED tests GREEN)
  - 16-03 (integration plan depends on all CLI flags being wired)

tech-stack:
  added: []
  patterns:
    - "node:test + assert/strict with makeRepo/gitInit/run/cleanup subprocess pattern"
    - "RED-first TDD: tests scaffold before implementation exists"
    - "try/finally cleanup pattern for isolated tmp repos"

key-files:
  created:
    - test/packages-cli.test.mjs
    - test/types-cli.test.mjs
    - test/legacy-cli.test.mjs
    - test/pagerank-packages.test.mjs
  modified: []

key-decisions:
  - "Used plain string literals in all test descriptions (no template literals) to keep grep gates clean"
  - "test 4 in packages-cli (--any laravel) already passes — --any routing works; that is expected and correct"
  - "pagerank tests drive --print output shape; CMP-04 acceptance gate is packages[0].pagerank is a number"

requirements-completed:
  - CMP-04
  - CMP-05
  - TYP-05
  - LEG-03

duration: 2min
completed: 2026-06-21
status: complete
---

# Phase 16 Plan 01: RED Test Scaffold Summary

**4 RED test files scaffolded covering all phase-16 requirements: --packages text+JSON output, package PageRank field, --types per-file and confidence filtering, --legacy warnings and JSON shape**

## Performance

- **Duration:** 2 min
- **Started:** 2026-06-21T15:42:06Z
- **Completed:** 2026-06-21T15:44:29Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Scaffolded test/packages-cli.test.mjs: 4 tests for --packages text, --packages --json, empty-repo, --any routing (CMP-05)
- Scaffolded test/pagerank-packages.test.mjs: 2 tests verifying packages array presence and pagerank field (CMP-04)
- Scaffolded test/types-cli.test.mjs: 4 tests for --types no-arg, per-file, --json, LOW confidence hidden by default (TYP-05)
- Scaffolded test/legacy-cli.test.mjs: 4 tests for --legacy clean, legacy-dir warning, --json legacyWarnings, classmap entry (LEG-03)
- All 13 new tests fail RED (unknown flag / missing field); 243 pre-existing tests remain green

## Task Commits

Each task was committed atomically:

1. **Task 1: packages-cli and pagerank-packages RED tests** - `05812c5` (test)
2. **Task 2: types-cli and legacy-cli RED tests** - `cd6cbae` (test)

**Plan metadata:** see docs commit below

_Note: TDD plan — all commits are test-only (RED phase); implementation in Plan 16-02_

## Files Created/Modified

- `test/packages-cli.test.mjs` — 4 RED tests for --packages CLI and --any package routing (CMP-05)
- `test/pagerank-packages.test.mjs` — 2 RED tests for package nodes and pagerank field in --print (CMP-04)
- `test/types-cli.test.mjs` — 4 RED tests for --types per-file output and confidence filtering (TYP-05)
- `test/legacy-cli.test.mjs` — 4 RED tests for --legacy warnings, JSON shape, classmap (LEG-03)

## Decisions Made

- Plain string literals throughout all test descriptions — no template literals — keeps grep-based acceptance gates clean and deterministic
- `--any laravel` test (packages-cli test 4) passes today because --any routing already exists; this is correct behaviour and documents the routing contract
- PageRank acceptance gate (CMP-04) pinned to `typeof pkg.pagerank === "number"` — the specific numeric assertion is the integration boundary Plan 16-02 must satisfy
- try/finally cleanup pattern used in all tests (consistent with project conventions, more explicit than relying solely on process.on("exit") backstop)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 4 RED test files committed and passing syntax check
- 243 pre-existing tests remain green — no regressions introduced
- Plan 16-02 can now implement --packages, --types, --legacy, and package PageRank to turn these 13 RED tests GREEN

## Self-Check: PASSED

- [x] test/packages-cli.test.mjs exists on disk
- [x] test/types-cli.test.mjs exists on disk
- [x] test/legacy-cli.test.mjs exists on disk
- [x] test/pagerank-packages.test.mjs exists on disk
- [x] All 4 files pass node --check (valid JS)
- [x] 13 new tests fail RED (confirmed via npm test)
- [x] 243 pre-existing tests still pass (no regressions)
- [x] Commits 05812c5 and cd6cbae exist in git log

---
*Phase: 16-integration-cli*
*Completed: 2026-06-21*
