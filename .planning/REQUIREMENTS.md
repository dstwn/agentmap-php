# Requirements: agentmap-php

**Defined:** 2026-06-19
**Core Value:** Give PHP/Laravel developers (and their AI coding agents) the same repo-context superpower TS/JS projects get from agentmap.

## v1.1 Requirements

Milestone v1.1: Docs Sync + PHP Eval. Bring user-facing docs in line with v1.0 reality (PHP/Laravel as the fork's lead value) and produce real benchmark + retrieval-accuracy data for Laravel codebases.

### README

- [ ] **README-01**: README leads with PHP/Laravel positioning — top-of-README headline, tagline, and hero text describe PHP/Laravel as the fork's primary value
- [ ] **README-02**: TS/JS coverage is preserved but demoted — surfaces as "still works" / "inherited" rather than the headline
- [ ] **README-03**: Upstream credit retained — links to raymondchins/agentmap with explicit "fork" framing in the opening section
- [ ] **README-04**: Comparison table updated — "Languages" row shows TS/JS + PHP/Laravel, "Dependencies" row includes tree-sitter + tree-sitter-php
- [ ] **README-05**: PHP/Laravel feature list — Blade, Livewire, DDD, Artisan, middleware, migrations, type inference, call tracing called out as differentiators
- [ ] **README-06**: Install instructions for PHP projects — example commands (`agentmap --any`, `--map`, `--relates`) shown against a PHP/Laravel target
- [ ] **README-07**: Updated benchmark + EVAL references — table headers and prose mention PHP/Laravel benchmarks (filled by REQ-EVAL-* and REQ-BENCH-*)
- [ ] **README-08**: "Scope & limitations" section updated — multi-language support reflected, PHP-specific caveats noted (e.g. declared-types-only inference)

### Agent Skills

- [ ] **SKILL-01**: `skills/SKILL.md` description and "When to use" sections mention PHP, Laravel, Blade, Livewire, DDD/Action/Repository patterns
- [ ] **SKILL-02**: `skills/SKILL.md` Commands section shows PHP/Laravel example queries (e.g. `--find UserRepository`, `--relates app/Http/Controllers/UserController.php`)
- [ ] **SKILL-03**: `skills/guidance.md` mentions PHP/Laravel coverage so injected guidance steers agents toward PHP queries too
- [ ] **SKILL-04**: `skills/cursor-rule.mdc` updated to mention PHP/Laravel awareness

### Hooks & Install

- [ ] **HOOK-01**: `hooks/INSTALL.md` documents PHP project install — `composer.json` discovery, post-commit hook works for PHP-only repos
- [ ] **HOOK-02**: `hooks/INSTALL.md` includes Laravel-specific notes — `routes/`, `resources/views/`, `database/migrations/` discovery and what gets parsed

### Release Hygiene

- [ ] **REL-01**: `CHANGELOG.md` has a v1.0 release entry with full feature list (Phases 1-6 deliverables) and dependency additions
- [ ] **REL-02**: `package.json` fork metadata — repo URL points to `dstwn/agentmap-php`, description mentions PHP/Laravel, `keywords` includes `php`, `laravel`, `blade`, `livewire`

### EVAL — Retrieval Accuracy on Laravel

- [ ] **EVAL-01**: `eval/eval.mjs` has a Laravel fixture — clones `laravel/framework` at a pinned SHA, with `tmp/eval/` cache reused across runs
- [ ] **EVAL-02**: PHP symbol-definition ground truth derived live — regex-based detector finds `class|interface|trait|function X` declarations in the cloned repo
- [ ] **EVAL-03**: PHP dependents ground truth derived live — `use` / `require` / `include` resolved against PSR-4 from `composer.json`
- [ ] **EVAL-04**: `eval/eval.mjs` runs both tasks (symbol-definition top-1/top-3 and dependents recall/precision) on the Laravel fixture
- [ ] **EVAL-05**: `EVAL.md` updated with Laravel results — per-fixture row added; pooled-overall row updated; method section mentions PHP ground-truth resolver and PSR-4 caveats
- [ ] **EVAL-06**: `npm run eval` includes Laravel fixture by default; `--repo laravel-framework` runs it standalone

### BENCH — Token Savings on Laravel

- [ ] **BENCH-01**: `benchmark/bench.mjs` has a Laravel fixture — clones `laravel/framework` at a pinned SHA, runs the same 7 task scenarios as TS/JS fixtures
- [ ] **BENCH-02**: PHP symbol/feature/dependents queries selected appropriately — fixture-specific symbols and files chosen so scenarios are meaningful (not strawman or trivial)
- [ ] **BENCH-03**: `benchmark/RESULTS.md` updated with Laravel section — per-scenario table; combined savings figure; honest caveats (e.g. PHP files larger on average than TS files, or whatever the data shows)
- [ ] **BENCH-04**: `npm run bench` includes Laravel fixture; `--repo laravel-framework` runs it standalone

### Tests

- [ ] **TEST-01**: All existing 196 tests still pass (no regressions)
- [ ] **TEST-02**: New benchmark/eval scripts produce stable, reproducible numbers (pinned SHA, deterministic ordering)

## v2 Requirements

Deferred from v1.0 review and v1.1 scoping.

### Additional Languages

- **LANG-01**: Python support (tree-sitter-python)
- **LANG-02**: Go support (tree-sitter-go)
- **LANG-03**: Rust support (tree-sitter-rust)

### Advanced Analysis

- **ADV-01**: Full PHP type resolution (assignment/return flow, not just declared types)
- **ADV-04**: Composer package dependency graph

### Cross-Language

- **XLANG-01**: Livewire-Volt cross-language references (currently only Inertia)
- **XLANG-02**: Filament cross-language references

## Out of Scope

| Feature | Reason |
|---------|--------|
| Renaming package to `@dstwn/agentmap-php` | Fork preserves upstream attribution; package name stays `@raymondchins/agentmap` |
| Top-of-README rewrite that drops upstream credit | Explicit decision — upstream credit retained in opening section |
| New PHP source-code features | v1.1 is docs + validation only; no `src/Core/` changes |
| Live Laravel app fixture (Next.js-style `--feature` task) | Out of scope for v1.1; would need a different fixture and feature detector |
| Publishing to npm/Packagist | Deferred — fork ships via GitHub for now |
| Rewriting upstream-inherited TS/JS docs | v1.1 only updates docs to add PHP/Laravel; existing TS/JS prose preserved |

## Traceability

Filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| README-01 | Phase 7 | Pending |
| README-02 | Phase 7 | Pending |
| README-03 | Phase 7 | Pending |
| README-04 | Phase 7 | Pending |
| README-05 | Phase 7 | Pending |
| README-06 | Phase 7 | Pending |
| README-07 | Phase 7 | Pending |
| README-08 | Phase 7 | Pending |
| SKILL-01 | Phase 8 | Pending |
| SKILL-02 | Phase 8 | Pending |
| SKILL-03 | Phase 8 | Pending |
| SKILL-04 | Phase 8 | Pending |
| HOOK-01 | Phase 8 | Pending |
| HOOK-02 | Phase 8 | Pending |
| REL-01 | Phase 9 | Pending |
| REL-02 | Phase 7 | Pending |
| EVAL-01 | Phase 10 | Pending |
| EVAL-02 | Phase 10 | Pending |
| EVAL-03 | Phase 10 | Pending |
| EVAL-04 | Phase 10 | Pending |
| EVAL-05 | Phase 10 | Pending |
| EVAL-06 | Phase 10 | Pending |
| BENCH-01 | Phase 11 | Pending |
| BENCH-02 | Phase 11 | Pending |
| BENCH-03 | Phase 11 | Pending |
| BENCH-04 | Phase 11 | Pending |
| TEST-01 | Phase 12 | Pending |
| TEST-02 | Phase 10, Phase 11 | Pending |

**Coverage:**
- v1.1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-19*
*Last updated: 2026-06-19 — v1.1 milestone scoping*
