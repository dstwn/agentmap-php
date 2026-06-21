# Roadmap: agentmap-php

## Milestones

- ✅ **v1.0 PHP/Laravel Support** — Phases 1-6 (shipped 2026-06-19)
- ✅ **v1.1 Docs Sync + PHP Eval** — Phases 7-12 (shipped 2026-06-19)
- ✅ **v1.2 PHP Type Resolution + Composer Dependency Graph** — Phases 13-16 (shipped 2026-06-21)
- 🔄 **v1.3 CI Integration Testing** — Phases 17-19 (active)

## Phases

<details>
<summary>✅ v1.0 PHP/Laravel Support (Phases 1-6) — SHIPPED 2026-06-19</summary>

- [x] Phase 1: Codebase Decomposition (retroactive) — completed 2026-06-19
- [x] Phase 2: PHP Parsing Engine (retroactive) — completed 2026-06-19
- [x] Phase 3: PHP Commands (retroactive) — completed 2026-06-19
- [x] Phase 4: Laravel Awareness (retroactive) — completed 2026-06-19
- [x] Phase 5: Mixed Projects (retroactive) — completed 2026-06-19
- [x] Phase 6: Enhanced Laravel (4/4 plans) — completed 2026-06-19

See: [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) · [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) · [v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v1.1 Docs Sync + PHP Eval (Phases 7-12) — SHIPPED 2026-06-19</summary>

- [x] Phase 7: README & Branding (2/2 plans) — completed 2026-06-19
- [x] Phase 8: Skills & Hooks Docs (2/2 plans) — completed 2026-06-19
- [x] Phase 9: Release Hygiene (1/1 plans) — completed 2026-06-19
- [x] Phase 10: Laravel EVAL Fixture (2/2 plans) — completed 2026-06-19
- [x] Phase 11: Laravel BENCH Fixture (2/2 plans) — completed 2026-06-19
- [x] Phase 12: Verification & Polish (1/1 plans) — completed 2026-06-19

See: [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) · [v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md) · [v1.1-MILESTONE-AUDIT.md](milestones/v1.1-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v1.2 PHP Type Resolution + Composer Dependency Graph (Phases 13-16) — SHIPPED 2026-06-21</summary>

- [x] Phase 13: Foundation — Composer Graph + Legacy Detection (3/3 plans) — completed 2026-06-21
- [x] Phase 14: PHP Type Resolution (MVP) (2/2 plans) — completed 2026-06-21
- [x] Phase 15: Advanced Type Resolution (2/2 plans) — completed 2026-06-21
- [x] Phase 16: Integration & CLI (3/3 plans) — completed 2026-06-21

See: [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) · [v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md) · [v1.2-MILESTONE-AUDIT.md](milestones/v1.2-MILESTONE-AUDIT.md)

</details>

#### v1.3 CI Integration Testing (Phases 17-19)

- [ ] **Phase 17: CI Glob Fix** - Fix glob so all 256 tests run in CI
- [ ] **Phase 18: Integration Tests** - Integration tests against real laravel/framework fixture
- [ ] **Phase 19: Coverage Reporting** - Coverage summary visible in CI logs on every run

#### Phase 13: Foundation — Composer Graph + Legacy Detection

**Goal**: Users can view the project's complete package dependency graph and identify legacy non-PSR-4 code
**Depends on**: Nothing (first v1.2 phase)
**Requirements**: CMP-01, CMP-02, CMP-03, LEG-01, LEG-02
**Success Criteria** (what must be TRUE):

  1. User can view all packages from `composer.json`/`composer.lock` with version constraints displayed correctly (caret `^`, tilde `~`, exact, wildcard `*`, branch-name, stability flags)
  2. User sees separate edge types for `require`, `require-dev`, `conflict`, `replace`, `provide`, `suggest` in package graph output
  3. User can identify files registered via `autoload.classmap` or `autoload.files` in composer.json
  4. User sees heuristic warnings for directories with non-PSR-4 structure (`classes/`, `lib/`, `modules/`, `src/` without namespace prefix)
  5. User gets graceful warning messages (not crashes) when composer files are missing or corrupt

**Plans**: 3/3 plans complete
Plans:
**Wave 1**

- [x] 13-01-PLAN.md — constants + PSR4Resolver + ComposerParser (Wave 1)
- [x] 13-02-PLAN.md — LegacyDetector + unit test suite (Wave 1, parallel)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 13-03-PLAN.md — map-builder.mjs integration + full regression gate (Wave 2)

#### Phase 14: PHP Type Resolution (MVP)

**Goal**: Types are resolved from variable assignments and PHPDoc annotations, complementing existing declared-type inference
**Depends on**: Phase 13 (needs PSR4Resolver for FQCN-to-file-path resolution)
**Requirements**: TYP-01, TYP-02
**Success Criteria** (what must be TRUE):

  1. User sees types resolved through `$x = new Foo()` assignment expressions in type output
  2. User sees PHPDoc `@var`, `@return`, `@param`, `@property` annotations reflected in resolved type information
  3. Type resolution complements (doesn't replace) existing `EnhancedLaravelParser.inferTypes()` — both sets appear merged with declared types as baseline
  4. User observes no significant performance regression on laravel/framework benchmark (type resolution adds <200ms)

**Plans**: 2/2 plans complete

Plans:
**Wave 1**

- [x] 14-01-PLAN.md — TypeResolver class + TDD test suite (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 14-02-PLAN.md — map-builder.mjs integration + smoke test (Wave 2)

#### Phase 15: Advanced Type Resolution

**Goal**: Types are traced through fluent method chains and every resolved type carries a confidence level
**Depends on**: Phase 14 (builds on assignment tracking and PHPDoc parsing)
**Requirements**: TYP-03, TYP-04
**Success Criteria** (what must be TRUE):

  1. User sees types resolved through fluent method chains (`$a->b()->c()->d()`) up to a configurable depth limit
  2. Every resolved type displays a confidence level: HIGH (declared), MEDIUM (assigned/new/PHPDoc), LOW (inferred through chains)
  3. Method chain resolution respects configurable depth limit without runaway recursion (warning logged at limit)
  4. Default type output shows only HIGH+MEDIUM confidence types; `--all` flag reveals LOW confidence

**Plans**: 2/2 plans complete

Plans:
**Wave 1**

- [x] 15-01-PLAN.md — DEFAULT_CHAIN_DEPTH constant + chains.php fixture + RED tests (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 15-02-PLAN.md — resolveChain() implementation + agentmap.mjs chainTypes/backfill wiring (Wave 2)

#### Phase 16: Integration & CLI

**Goal**: All new features accessible via CLI; package edges merged into file-level PageRank; schema version bumped 3→4
**Depends on**: Phase 13, Phase 14, Phase 15 (consumes all module outputs)
**Requirements**: CMP-04, CMP-05, TYP-05, LEG-03
**Success Criteria** (what must be TRUE):

  1. User can run `--packages` to see the package dependency graph in text or JSON format
  2. User can run `--types` to inspect resolved type information per symbol or per file
  3. User can run `--legacy` to see non-PSR-4 files, unregistered directories, and suggested PSR-4 mappings
  4. Package names appear in `--any` search results alongside file-level results
  5. Package-to-file PageRank edge merging respects configurable cap (default 1000 edges per dependency) and subtly boosts vendor-related file rank without drowning out direct imports
  6. All existing CLI flags (`--map`, `--relates`, `--hubs`, `--symbols`, `--find`, etc.) work identically with no behavior changes
  7. `SCHEMA_VERSION` bumps from 3 to 4, triggering automatic rebuild on existing caches

**Plans**: 3/3 plans complete

Plans:
**Wave 1** *(parallel)*

- [x] 16-01-PLAN.md — CLI test scaffolding: 4 RED test files for all new flags (Wave 1)
- [x] 16-02-PLAN.md — SCHEMA_VERSION 3→4 + --packages/--types/--legacy handlers (Wave 1, parallel)

**Wave 2** *(blocked on 16-02)*

- [x] 16-03-PLAN.md — PageRank package edge merging + --any package injection (Wave 2)

#### Phase 17: CI Glob Fix

**Goal**: CI reliably runs all 256 tests on every push and PR
**Depends on**: Nothing (first v1.3 phase)
**Requirements**: CI-01, CI-02
**Success Criteria** (what must be TRUE):
  1. CI log shows 256 tests (not 213) on every push and PR across Node 18/20/22 matrix
  2. `test/vue-sfc/` tests appear in CI output — no silent skip
  3. CI exit code is non-zero when any test fails (glob expansion cannot silently drop files)
  4. Local `npm test` and CI test count match
**Plans**: TBD

#### Phase 18: Integration Tests

**Goal**: Users can verify core CLI flags work end-to-end against a real Laravel repo in CI
**Depends on**: Phase 17 (fixed glob picks up the new test file automatically)
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04
**Success Criteria** (what must be TRUE):
  1. CI runs `--packages` against laravel/framework fixture and asserts non-empty package graph output
  2. CI runs `--types` against laravel/framework fixture and asserts type entries present
  3. CI runs `--legacy` against laravel/framework fixture and asserts legacy warning output
  4. Integration tests skip gracefully (not fail) when laravel/framework fixture is absent
  5. All 256 existing tests still pass after integration test file is added
**Plans**: TBD
**UI hint**: no

#### Phase 19: Coverage Reporting

**Goal**: Coverage summary appears in CI logs on every run, capturing src/Core/ module coverage via subprocess boundary
**Depends on**: Phase 17 (all tests must run before coverage numbers are meaningful); Phase 18 (integration tests contribute to coverage)
**Requirements**: COV-01, COV-02, COV-03
**Success Criteria** (what must be TRUE):
  1. CI log shows a coverage summary table (text) on every run — lines, branches, functions visible
  2. `src/Core/` modules appear in coverage report (not just test harness process)
  3. Coverage step does not block CI on a threshold — run passes regardless of coverage %
  4. `coverage/` directory excluded from git; `coverage/lcov.info` available as CI artifact
**Plans**: TBD

## Progress

**Execution Order:** Phases execute in numeric order: 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Codebase Decomposition | v1.0 | retroactive | Complete | 2026-06-19 |
| 2. PHP Parsing Engine | v1.0 | retroactive | Complete | 2026-06-19 |
| 3. PHP Commands | v1.0 | retroactive | Complete | 2026-06-19 |
| 4. Laravel Awareness | v1.0 | retroactive | Complete | 2026-06-19 |
| 5. Mixed Projects | v1.0 | retroactive | Complete | 2026-06-19 |
| 6. Enhanced Laravel | v1.0 | 4/4 | Complete | 2026-06-19 |
| 7. README & Branding | v1.1 | 2/2 | Complete | 2026-06-19 |
| 8. Skills & Hooks Docs | v1.1 | 2/2 | Complete | 2026-06-19 |
| 9. Release Hygiene | v1.1 | 1/1 | Complete | 2026-06-19 |
| 10. Laravel EVAL Fixture | v1.1 | 2/2 | Complete | 2026-06-19 |
| 11. Laravel BENCH Fixture | v1.1 | 2/2 | Complete | 2026-06-19 |
| 12. Verification & Polish | v1.1 | 1/1 | Complete | 2026-06-19 |
| 13. Foundation — Composer Graph + Legacy Detection | v1.2 | 3/3 | Complete   | 2026-06-21 |
| 14. PHP Type Resolution (MVP) | v1.2 | 2/2 | Complete   | 2026-06-21 |
| 15. Advanced Type Resolution | v1.2 | 2/2 | Complete   | 2026-06-21 |
| 16. Integration & CLI | v1.2 | 3/3 | Complete   | 2026-06-21 |
| 17. CI Glob Fix | v1.3 | 0/? | Not started | - |
| 18. Integration Tests | v1.3 | 0/? | Not started | - |
| 19. Coverage Reporting | v1.3 | 0/? | Not started | - |
