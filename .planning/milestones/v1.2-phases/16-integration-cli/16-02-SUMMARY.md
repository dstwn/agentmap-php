---
phase: 16-integration-cli
plan: "02"
subsystem: cli
tags: [cli, packages, types, legacy, pagerank, composer, php, schema-version]

requires:
  - phase: 16-integration-cli
    provides: RED test suite for --packages, --types, --legacy, CMP-04 (Plan 16-01)
provides:
  - "--packages CLI flag: shows composer package dependency graph (text + --json)"
  - "--types CLI flag: per-file and symbol-level PHP type output with confidence filtering"
  - "--legacy CLI flag: non-PSR-4 warnings with PSR-4 suggestions (text + --json)"
  - "CMP-04: package nodes in PageRank graph with synthetic edges and pagerank field"
  - "SCHEMA_VERSION bumped 3→4 in constants.mjs and agentmap.mjs"
affects:
  - 16-03 (integration plan that uses all CLI flags being wired)

tech-stack:
  added: []
  patterns:
    - "out(jsonObj, prosePrinter) pattern for all new handlers (consistent with existing flags)"
    - "Synthetic package nodes in PageRank graph (capped at 1000 edges/pkg, weight 0.1x)"
    - "LegacyDetector wired into agentmap.mjs build() alongside map-builder.mjs"
    - "composerResult hoisted to build() scope for reuse by CMP-04 and LegacyDetector"

key-files:
  created: []
  modified:
    - src/Core/constants.mjs
    - agentmap.mjs
    - test/doctor.test.mjs

key-decisions:
  - "LegacyDetector called in agentmap.mjs build() (not only map-builder.mjs) so cache-miss path includes legacyWarnings"
  - "composerResult hoisted out of TypeResolver block scope to build() scope for CMP-04 reuse"
  - "Synthetic package nodes added to PageRank nodes[] array so packages get their own score"
  - "Package edge cap set at 1000 per package with stderr warning (per CONTEXT.md locked decision)"
  - "doctor.test.mjs SCHEMA constant bumped 3→4 (auto-fix Rule 1 — pre-existing test broke on schema bump)"

patterns-established:
  - "Handler placement: new command handlers go between --hubs and --print in the if/else chain"
  - "Confidence filtering: default HIGH+MEDIUM only; --all flag exposes LOW confidence types"
  - "PackagesWithRank: packages array always includes pagerank field for --print and --packages --json"

requirements-completed:
  - CMP-05
  - TYP-05
  - LEG-03

duration: 6min
completed: 2026-06-21
status: complete
---

# Phase 16 Plan 02: CLI Handlers & Schema Bump Summary

**--packages/--types/--legacy CLI handlers wired into agentmap.mjs with CMP-04 package PageRank edge merging and SCHEMA_VERSION bumped 3→4**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-21T15:45:39Z
- **Completed:** 2026-06-21T15:51:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Bumped SCHEMA_VERSION 3→4 in both `src/Core/constants.mjs` and `agentmap.mjs` local constant
- Added `--packages`, `--types`, `--legacy` to KNOWN set; `--types` to VALUE_FLAGS
- Implemented `--packages` handler: text list with `from → to [type] constraint` format, `--json` output
- Implemented `--types` handler: no-arg (per-file summary), file-path detail, `Class::method` symbol filter; confidence filtering (HIGH+MEDIUM default, `--all` shows LOW)
- Implemented `--legacy` handler: `[heuristic-dir]`, `[classmap]`, `[autoload-file]` warning types with PSR-4 suggestions
- CMP-04: hoisted `composerResult` to `build()` scope; added synthetic package nodes with directed edges from PHP source files, weight 0.1×, cap 1000 per package; packages carry `pagerank` field
- Wired `LegacyDetector` into `agentmap.mjs` `build()` so cache-miss path includes `legacyWarnings`
- Updated `--print` output to include `packages` array
- All 256 tests pass (13 RED tests from Plan 16-01 turned GREEN)

## Task Commits

Each task was committed atomically:

1. **Task 1: Bump SCHEMA_VERSION and register flags** - `ac8778b` (feat)
2. **Task 2: Implement --packages/--types/--legacy handlers + CMP-04** - `83ee493` (feat)

**Plan metadata:** see docs commit below

## Files Created/Modified

- `src/Core/constants.mjs` — SCHEMA_VERSION 3 → 4
- `agentmap.mjs` — local SCHEMA_VERSION bump; LegacyDetector import; three new handlers; CMP-04 package PageRank; legacyWarnings + packagesWithRank in build() output; --print includes packages; USAGE updated
- `test/doctor.test.mjs` — SCHEMA constant 3 → 4 (auto-fix: broken by schema bump)

## Decisions Made

- `composerResult` hoisted out of TypeResolver block scope (was `const` inside `{}`) to `let _composerResultForBuild` in `build()` scope — enables CMP-04 and LegacyDetector reuse without re-parsing composer.json
- `LegacyDetector` must be called in `agentmap.mjs` `build()` not just `map-builder.mjs` — tests use subprocess with no pre-existing cache, so cache-miss path must include `legacyWarnings`
- Synthetic package nodes named `__pkg__{packageName}` added to `pagerank()` nodes array; edges from all PHP source files to each required package node; excluded from `files{}` output
- `--all` flag added to KNOWN set for `--types` confidence override (within Phase 16 scope, agent's discretion per RESEARCH.md)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] doctor.test.mjs SCHEMA constant not updated after schema bump**
- **Found during:** Task 2 (npm test run)
- **Issue:** `test/doctor.test.mjs` line 46 had `const SCHEMA = 3` with comment "keep in sync with SCHEMA_VERSION in agentmap.mjs" — the test creates a map.json with schema=3 and expects "--doctor: fresh map cache" to report "ok", but the bumped SCHEMA_VERSION=4 caused the doctor to report "stale"
- **Fix:** Changed `SCHEMA = 3` to `SCHEMA = 4` in doctor.test.mjs
- **Files modified:** test/doctor.test.mjs
- **Verification:** npm test — test 24 passes GREEN
- **Committed in:** `83ee493` (Task 2 commit)

**2. [Rule 2 - Missing Critical] LegacyDetector not wired into agentmap.mjs build()**
- **Found during:** Task 2 (npm test run — tests 74, 76 failed with "legacy warnings (0): (none)")
- **Issue:** `data.legacyWarnings` came from `map-builder.mjs` build() via map.json cache. When `agentmap.mjs` build() ran (cache miss in tests), it returned no `legacyWarnings` — handlers couldn't see them
- **Fix:** Imported `LegacyDetector` in `agentmap.mjs`; added call to `detect()` in build() using the already-hoisted `_composerResultForBuild`; added `legacyWarnings` to the build() output object
- **Files modified:** agentmap.mjs
- **Verification:** tests 74 and 76 pass GREEN
- **Committed in:** `83ee493` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing critical)
**Impact on plan:** Both fixes required for correctness. No scope creep. doctor.test.mjs fix is a one-line sync. LegacyDetector wiring was implicit in plan intent but not explicit in task instructions.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 3 CLI handlers operational and tested (256/256 pass)
- SCHEMA_VERSION = 4 in both constants.mjs and agentmap.mjs
- CMP-04 package PageRank edges in place with pagerank field on packages
- Plan 16-03 (integration) can proceed — all CLI flags wired

## Self-Check: PASSED

- [x] `src/Core/constants.mjs` exports SCHEMA_VERSION = 4
- [x] `agentmap.mjs` local SCHEMA_VERSION = 4
- [x] KNOWN set contains --packages, --types, --legacy, --all
- [x] VALUE_FLAGS contains --types
- [x] --packages handler present (grep: `has("--packages")`)
- [x] --types handler present (grep: `has("--types")`)
- [x] --legacy handler present (grep: `has("--legacy")`)
- [x] npm test: 256/256 pass, 0 failures
- [x] node agentmap.mjs --packages exits 0
- [x] node agentmap.mjs --types exits 0
- [x] node agentmap.mjs --legacy exits 0
- [x] node agentmap.mjs --packages --json emits JSON with command="packages"
- [x] node agentmap.mjs --hubs still works (no regression)
- [x] node agentmap.mjs --map still works (no regression)
- [x] Commits ac8778b and 83ee493 exist in git log

---
*Phase: 16-integration-cli*
*Completed: 2026-06-21*
