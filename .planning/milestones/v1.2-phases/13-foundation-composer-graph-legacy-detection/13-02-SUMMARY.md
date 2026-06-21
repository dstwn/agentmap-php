---
phase: 13-foundation-composer-graph-legacy-detection
plan: "02"
subsystem: composer
tags: [legacy-detection, psr4, composer, node-test, unit-tests]

requires:
  - phase: 13-foundation-composer-graph-legacy-detection
    provides: ComposerParser, PSR4Resolver, constants (LEGACY_DIRS, COMPOSER_FILES) from plan 01

provides:
  - LegacyDetector class with detect(projectRoot, psr4Map, classmaps, autoFiles) → legacyWarnings[]
  - Full unit test suite covering CMP-01, CMP-02, CMP-03, LEG-01, LEG-02

affects:
  - plan 13-03 (integration — imports LegacyDetector and relies on test suite being green)
  - phase 16 (CLI flag wiring reads legacyWarnings shape)

tech-stack:
  added: []
  patterns:
    - "LegacyDetector: covered-dirs Set built from psr4Map values (both slash forms) to guard false positives"
    - "vendor/ prefix skip on classmap/autoFiles entries (Pitfall 6 guard)"
    - "node:test unit tests: dynamic import per describe block, mkdtempSync fixtures, rmSync cleanup"

key-files:
  created:
    - src/Core/LegacyDetector.mjs
    - test/composer-parser.test.mjs
  modified: []

key-decisions:
  - "LegacyDetector stores both 'src' and 'src/' forms in coveredDirs Set to handle trailing-slash variation in psr4Map values"
  - "vendor/ entries in classmaps/autoFiles silently skipped (no warning) per Pitfall 6 — only root composer.json is the source"

patterns-established:
  - "covered-dirs normalization: d.replace(/\\/+$/, '') + both forms added to Set"
  - "Test structure: three describe blocks (ComposerParser, PSR4Resolver, LegacyDetector), dynamic import in first it() of each block"

requirements-completed:
  - LEG-01
  - LEG-02

duration: 3min
completed: 2026-06-21
status: complete
---

# Phase 13 Plan 02: LegacyDetector + Full Unit Test Suite Summary

**LegacyDetector detecting uncovered legacy dirs (classes/, lib/, modules/, src/) and classmap/files non-PSR-4 entries, plus 22-test suite covering all 5 phase requirements**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-21T13:28:51Z
- **Completed:** 2026-06-21T13:31:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- LegacyDetector class with correct PSR-4 false-positive guard (both "src" and "src/" forms in covered set)
- vendor/ prefix skip on classmap/autoFiles entries (Pitfall 6)
- 22-test suite across 3 describe blocks (ComposerParser 12, PSR4Resolver 4, LegacyDetector 6) — all pass
- Full test suite regression check: 173/173 pass (no regressions)

## Task Commits

1. **Task 1: Implement LegacyDetector** — `b3a10a9` (feat)
2. **Task 2: Write full unit test suite** — `e73beb0` (test)

**Plan metadata:** *(docs commit below)*

## Files Created/Modified

- `src/Core/LegacyDetector.mjs` — detect() method: covered-dirs Set, heuristic legacy-dir check, classmap/autoFiles warnings, vendor/ skip
- `test/composer-parser.test.mjs` — 22 unit tests for ComposerParser, PSR4Resolver, LegacyDetector using node:test + mkdtempSync fixtures

## Decisions Made

- Stored both `"src"` and `"src/"` in `coveredDirs` Set to handle psr4Map values that may or may not have trailing slash — ensures Pitfall 5 false-positive guard works regardless of input form
- vendor/ entries in classmap/autoFiles silently skipped (produces empty warnings array for those entries) — consistent with plan Pitfall 6 spec

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — all 22 tests passed on first run; 173/173 full suite green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- LegacyDetector ready for plan 13-03 integration into map-builder.mjs
- Test suite green — plan 13-03 can rely on it as regression gate
- No blockers

---
*Phase: 13-foundation-composer-graph-legacy-detection*
*Completed: 2026-06-21*

## Self-Check: PASSED

- `src/Core/LegacyDetector.mjs` — FOUND
- `test/composer-parser.test.mjs` — FOUND
- commit b3a10a9 — FOUND (`git log --oneline` confirms)
- commit e73beb0 — FOUND (`git log --oneline` confirms)
- `node --test test/composer-parser.test.mjs` — 22/22 pass
- `node --test test/*.test.mjs` — 173/173 pass (no regressions)
