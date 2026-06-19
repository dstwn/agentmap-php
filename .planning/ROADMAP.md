# Roadmap: agentmap-php

## Milestones

- ✅ **v1.0 PHP/Laravel Support** — Phases 1-6 (shipped 2026-06-19)
- 🚧 **v1.1 Docs Sync + PHP Eval** — Phases 7-12 (in progress)

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

### 🚧 v1.1 Docs Sync + PHP Eval (Phases 7-12)

- [ ] Phase 7: README & Branding (2 plans)
- [ ] Phase 8: Skills & Hooks Docs (2 plans)
- [ ] Phase 9: Release Hygiene (1 plan)
- [ ] Phase 10: Laravel EVAL Fixture (2 plans)
- [ ] Phase 11: Laravel BENCH Fixture (2 plans)
- [ ] Phase 12: Verification & Polish (1 plan)

## Phase Details

### Phase 7: README & Branding
**Goal**: README leads with PHP/Laravel as the fork's primary value while preserving upstream credit; `package.json` reflects fork metadata.
**Depends on**: v1.0 milestone
**Requirements**: README-01, README-02, README-03, README-04, README-05, README-06, README-07, README-08, REL-02
**Success Criteria**:
1. README headline + tagline mention PHP/Laravel first; TS/JS demoted to secondary positioning
2. Upstream `raymondchins/agentmap` credited in opening section with explicit "fork" framing
3. Comparison table "Languages" row shows PHP+Laravel; "Dependencies" includes tree-sitter-php
4. PHP/Laravel feature list (Blade, Livewire, DDD, Artisan, middleware, migrations) called out as differentiators
5. PHP install + usage examples shown in Quickstart
6. `package.json` repo URL points to `dstwn/agentmap-php`; keywords include `php`, `laravel`, `blade`, `livewire`

Plans:
- [ ] 07-01: Top-of-README rewrite (headline, tagline, hero, fork credit, Quickstart PHP examples)
- [ ] 07-02: Comparison table + Why-it's-different + Scope-and-limitations updates + package.json fork metadata

### Phase 8: Skills & Hooks Docs
**Goal**: Agent skills and install docs mention PHP/Laravel so AI agents in user repos know the fork supports PHP and Laravel.
**Depends on**: Phase 7
**Requirements**: SKILL-01, SKILL-02, SKILL-03, SKILL-04, HOOK-01, HOOK-02
**Success Criteria**:
1. `skills/SKILL.md` description + Commands sections include PHP/Laravel queries
2. `skills/guidance.md` and `skills/cursor-rule.mdc` mention PHP/Laravel awareness
3. `hooks/INSTALL.md` documents PHP project install (composer.json, post-commit hook for PHP repos)
4. Laravel-specific notes added (`routes/`, `resources/views/`, `database/migrations/` discovery)

Plans:
- [ ] 08-01: Update `skills/SKILL.md`, `skills/guidance.md`, `skills/cursor-rule.mdc`
- [ ] 08-02: Update `hooks/INSTALL.md` with PHP/Laravel install + post-commit notes

### Phase 9: Release Hygiene
**Goal**: CHANGELOG documents v1.0 PHP/Laravel release.
**Depends on**: Phase 7 (final package.json), Phase 8 (final docs)
**Requirements**: REL-01
**Success Criteria**:
1. `CHANGELOG.md` v1.0 entry lists all shipped features grouped by category (PHP parsing, Laravel awareness, mixed projects, enhanced Laravel)
2. Dependency additions (`tree-sitter`, `tree-sitter-php`) noted with versions
3. Migration notes for upstream agentmap users

Plans:
- [ ] 09-01: Write `CHANGELOG.md` v1.0 entry from MILESTONES.md and v1.0-MILESTONE-AUDIT.md

### Phase 10: Laravel EVAL Fixture
**Goal**: Real retrieval-accuracy data for `laravel/framework` proves PHP support actually works.
**Depends on**: Phase 9 (no doc churn during eval runs)
**Requirements**: EVAL-01, EVAL-02, EVAL-03, EVAL-04, EVAL-05, EVAL-06, TEST-02 (partial)
**Success Criteria**:
1. `eval/eval.mjs` clones `laravel/framework` at a pinned SHA; `tmp/eval/` cache reused
2. PHP symbol-definition ground truth derived live (regex over `class|interface|trait|function X` declarations)
3. PHP dependents ground truth derived live (`use`/`require`/`include` resolved against PSR-4 from `composer.json`)
4. `npm run eval` runs Laravel fixture by default; `--repo laravel-framework` runs standalone
5. `EVAL.md` updated with per-fixture row, pooled overall, and PHP method/caveats section
6. Numbers reproducible (pinned SHA, deterministic ordering)

Plans:
- [ ] 10-01: Implement PHP ground-truth resolver and Laravel fixture runner in `eval/eval.mjs`
- [ ] 10-02: Run eval, populate `EVAL.md` with results, write PHP-specific method/caveats prose

### Phase 11: Laravel BENCH Fixture
**Goal**: Real token-savings data for `laravel/framework` validates the fork's value claim.
**Depends on**: Phase 10 (eval already validated PHP retrieval works)
**Requirements**: BENCH-01, BENCH-02, BENCH-03, BENCH-04, TEST-02 (partial)
**Success Criteria**:
1. `benchmark/bench.mjs` runs the same 7-scenario suite against `laravel/framework` at pinned SHA
2. Fixture-specific PHP symbols, files, and features chosen so scenarios are meaningful (not strawman)
3. `benchmark/RESULTS.md` Laravel section: per-scenario table, combined savings, honest caveats
4. `npm run bench` runs Laravel fixture; `--repo laravel-framework` standalone works

Plans:
- [ ] 11-01: Implement Laravel fixture and PHP scenario picks in `benchmark/bench.mjs`
- [ ] 11-02: Run benchmark, populate `benchmark/RESULTS.md` with Laravel section, honest caveats

### Phase 12: Verification & Polish
**Goal**: All 196 v1.0 tests still pass; docs are internally consistent.
**Depends on**: Phases 7-11
**Requirements**: TEST-01, plus cross-cutting verification
**Success Criteria**:
1. `node --test` reports 196/196 pass (no regression from doc/eval/bench changes)
2. Cross-references between README, RESULTS.md, and EVAL.md show consistent numbers
3. No broken links or stale numbers in committed docs
4. README claims match actual fixture results (no over-promising)

Plans:
- [ ] 12-01: Full test run, cross-doc consistency check, fix any drift

## Progress

**Execution Order:** Phases execute in numeric order: 7 → 8 → 9 → 10 → 11 → 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Codebase Decomposition | v1.0 | retroactive | Complete | 2026-06-19 |
| 2. PHP Parsing Engine | v1.0 | retroactive | Complete | 2026-06-19 |
| 3. PHP Commands | v1.0 | retroactive | Complete | 2026-06-19 |
| 4. Laravel Awareness | v1.0 | retroactive | Complete | 2026-06-19 |
| 5. Mixed Projects | v1.0 | retroactive | Complete | 2026-06-19 |
| 6. Enhanced Laravel | v1.0 | 4/4 | Complete | 2026-06-19 |
| 7. README & Branding | v1.1 | 0/2 | Not started | - |
| 8. Skills & Hooks Docs | v1.1 | 0/2 | Not started | - |
| 9. Release Hygiene | v1.1 | 0/1 | Not started | - |
| 10. Laravel EVAL Fixture | v1.1 | 0/2 | Not started | - |
| 11. Laravel BENCH Fixture | v1.1 | 0/2 | Not started | - |
| 12. Verification & Polish | v1.1 | 0/1 | Not started | - |
