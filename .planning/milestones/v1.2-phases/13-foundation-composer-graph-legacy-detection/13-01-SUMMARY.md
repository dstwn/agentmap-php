---
phase: 13-foundation-composer-graph-legacy-detection
plan: "01"
subsystem: composer
tags: [composer, psr4, dependency-graph, php, node-fs]

requires: []
provides:
  - COMPOSER_FILES and LEGACY_DIRS constants in src/Core/constants.mjs
  - PSR4Resolver class (resolve FQCN to absolute path) in src/Core/PSR4Resolver.mjs
  - ComposerParser class (parse composer.json + composer.lock) in src/Core/ComposerParser.mjs
affects:
  - phase 13 plan 02 (LegacyDetector imports LEGACY_DIRS and PSR4Resolver)
  - phase 14 (type resolution imports PSR4Resolver)
  - phase 16 (CLI wiring reads packages + psr4Map from ComposerParser output)

tech-stack:
  added: []
  patterns:
    - "readJsonSafe helper: existsSync + JSON.parse in try-catch + stderr warning on failure"
    - "Standalone ESM class (not LanguageParser subclass) for non-source-file parsers"
    - "Object.freeze() for shared constant arrays"
    - "TDD RED/GREEN commit sequence for new modules"

key-files:
  created:
    - src/Core/PSR4Resolver.mjs
    - src/Core/ComposerParser.mjs
    - test/composer-parser.test.mjs
  modified:
    - src/Core/constants.mjs

key-decisions:
  - "PSR4Resolver algorithm extracted verbatim from PhpParser._resolvePsr4() — no PhpParser refactor in this phase (A5)"
  - "ComposerParser merges autoload + autoload-dev for psr4Map/classmaps/autoFiles (Pitfall 4)"
  - "resolvedVersion field on each edge — null when lock absent, string when found in packages or packages-dev"
  - "readJsonSafe is module-private (not exported) — internal implementation detail"

patterns-established:
  - "Pattern: readJsonSafe(filePath, label) — graceful JSON read with stderr warning, never throw"
  - "Pattern: ComposerParser.parse() returns {packages, psr4Map, classmaps, autoFiles}"
  - "Pattern: PSR4Resolver.resolve(fqcn, projectRoot, psr4Map) — stateless, per-call map"

requirements-completed:
  - CMP-01
  - CMP-02
  - CMP-03

duration: 3min
completed: 2026-06-21
status: complete
---

# Phase 13 Plan 01: Foundation — Composer Graph + Legacy Detection Summary

**ComposerParser parsing all 6 composer.json link types with raw constraints + lock-resolved versions; PSR4Resolver extracting PhpParser._resolvePsr4 as standalone utility; COMPOSER_FILES and LEGACY_DIRS constants added — 17 new tests, 168/168 suite passing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-21T13:24:17Z
- **Completed:** 2026-06-21T13:27:18Z
- **Tasks:** 3
- **Files modified:** 4 (constants.mjs modified; PSR4Resolver.mjs, ComposerParser.mjs, composer-parser.test.mjs created)

## Accomplishments

- Extended `src/Core/constants.mjs` with `COMPOSER_FILES` and `LEGACY_DIRS` frozen arrays
- Implemented `PSR4Resolver` — extracts prefix-match algorithm from `PhpParser._resolvePsr4()`, handles trailing backslash normalization and array-valued dirs
- Implemented `ComposerParser` — parses all 6 link types, merges `composer.lock` resolved versions from both `packages` and `packages-dev`, extracts psr4Map/classmaps/autoFiles with graceful degradation on missing/corrupt files
- 17 new unit tests; no regressions in 168-test suite

## Task Commits

Each task was committed atomically:

1. **Task 1: Add COMPOSER_FILES and LEGACY_DIRS constants** — `6a06a9f` (feat)
2. **Task 2 RED: Add failing tests for PSR4Resolver and ComposerParser** — `e552aea` (test)
3. **Task 2+3 GREEN: Implement PSR4Resolver and ComposerParser** — `a0219b1` (feat)

## Files Created/Modified

- `src/Core/constants.mjs` — added `COMPOSER_FILES` and `LEGACY_DIRS` frozen arrays
- `src/Core/PSR4Resolver.mjs` — new; `resolve(fqcn, projectRoot, psr4Map)` → absolute path or null
- `src/Core/ComposerParser.mjs` — new; `parse(projectRoot)` → `{packages, psr4Map, classmaps, autoFiles}`
- `test/composer-parser.test.mjs` — new; 17 tests covering PSR4Resolver (5) and ComposerParser (12)

## Decisions Made

- PSR4Resolver algorithm extracted verbatim from `PhpParser._resolvePsr4()` — `PhpParser` not refactored (Assumption A5: avoids breaking 194 existing tests; delegation is Phase 14's concern)
- `readJsonSafe` module-private (not exported) — internal implementation detail per plan spec
- `autoload-dev` merged into psr4Map, classmaps, autoFiles — dev namespaces needed by PSR4Resolver for test file resolution in Phase 14 (Pitfall 4 guard)
- `resolvedVersion: null` default on each edge — null when lock absent or package not in lock

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `LEGACY_DIRS` constant ready for Plan 02 (`LegacyDetector`)
- `PSR4Resolver` exported and tested; Phase 14 can import directly
- `ComposerParser` exports `{packages, psr4Map, classmaps, autoFiles}` — shape Phase 16 CLI will consume
- All 168 tests green; no regressions

## Self-Check

- `src/Core/constants.mjs` — exists ✓, COMPOSER_FILES/LEGACY_DIRS verified by node assertion ✓
- `src/Core/PSR4Resolver.mjs` — exists ✓, exports `PSR4Resolver` class ✓
- `src/Core/ComposerParser.mjs` — exists ✓, exports `ComposerParser` class ✓
- `test/composer-parser.test.mjs` — exists ✓, 17/17 pass ✓
- Commits `6a06a9f`, `e552aea`, `a0219b1` — all present ✓

## Self-Check: PASSED

---
*Phase: 13-foundation-composer-graph-legacy-detection*
*Completed: 2026-06-21*
