# agentmap-php

## What This Is

A fork of [agentmap](https://github.com/raymondchins/agentmap) that extends the repo-mapping tool to PHP and Laravel codebases — with docs, benchmarks, and eval data proving it works on real-world Laravel codebases.

## Core Value

Give PHP/Laravel developers (and their AI coding agents) the same repo-context superpower TS/JS projects get from agentmap — ranked import graphs, queryable code maps, and dramatically reduced token budgets for understanding a codebase.

## Current Milestone: v1.3 CI Integration Testing

**Goal:** Harden the test pipeline with working CI, full test subdirectory coverage, integration tests against real fixtures, and coverage reporting.

**Target features:**
- Fix CI glob bug (missing `test/vue-sfc/` — 43 tests uncovered)
- Keep Node 18/20/22 matrix
- Integration tests against existing `laravel/framework` eval fixture for `--packages`, `--types`, `--legacy`, and core flags
- Coverage reporting step in CI

## Current State (v1.2)

**Shipped:** 2026-06-21 (v1.2 PHP Type Resolution + Composer Dependency Graph)
**Previous:** v1.1 shipped 2026-06-19, v1.0 shipped 2026-06-19 via [PR #1](https://github.com/dstwn/agentmap-php/pull/1)

- 256/256 tests passing
- Modular `src/Core/` (16 modules) — ComposerParser, PSR4Resolver, LegacyDetector, TypeResolver added in v1.2
- All v1.0 requirements (30/30) satisfied; all v1.1 requirements (28/28) satisfied; all v1.2 requirements (13/13) satisfied
- Composer dependency graph: `--packages` flag, all 6 edge types (require/require-dev/conflict/replace/provide/suggest), version constraints
- PHP type resolution: assignment types, PHPDoc annotations, method chain tracing (depth 3), confidence levels (HIGH/MEDIUM/LOW)
- Legacy non-PSR-4 detection: `--legacy` flag, classmap/files entries, heuristic dir warnings
- Package→file PageRank edge merging with 1000-edge cap (0.1× weight)
- `--types` flag per file or symbol; `--any` surfaces package names
- SCHEMA_VERSION bumped 3→4 (auto-rebuild on stale caches)
- Available languages: TS/JS, Vue SFC, PHP, Laravel (full stack)

## Business Context

- **Customer:** PHP/Laravel developers using AI coding agents (Claude Code, Cursor, Copilot, etc.)
- **Revenue model:** Open-source (MIT), public fork
- **Success metric:** PHP/Laravel codebases pass all existing agentmap tests + new PHP-specific tests ✓ (achieved 194/194)
- **Strategy:** Public fork on GitHub; documented for the Laravel community

## Requirements

### Validated (v1.0)

- ✓ DECOMP-01: Decomposed `agentmap.mjs` into `src/Core/` with plugin interface — v1.0
- ✓ DECOMP-02: All existing CLI flags and output formats unchanged — v1.0
- ✓ PHP-01..04: Full PHP parsing (AST, imports, PSR-4, ranking) — v1.0
- ✓ PHP-05..07: PHP wired into all CLI commands — v1.0
- ✓ LARAV-01..04: Facade resolution, Eloquent, routes, providers — v1.0
- ✓ LARAV-05..15: Blade, Livewire, DDD, Artisan, middleware, migrations, types, call tracing — v1.0
- ✓ MIXED-01..02: Unified TS/JS+PHP graph, cross-language references — v1.0
- ✓ TEST-01..05: All test suites pass (194/194) — v1.0

### Validated (v1.1)

- ✓ README-01..08: README rewritten for PHP/Laravel positioning — v1.1
- ✓ SKILL-01..04, HOOK-01..02: Skills and hooks docs updated for PHP/Laravel — v1.1
- ✓ REL-01..02: CHANGELOG entry + package.json fork metadata — v1.1
- ✓ EVAL-01..06: Laravel eval fixture with PHP ground-truth resolver — v1.1 (100%/100%)
- ✓ BENCH-01..04: Laravel benchmark fixture — v1.1 (99.6% savings)
- ✓ TEST-01..02: All tests pass, reproducible numbers — v1.1

### Active (v1.3)

- [ ] **CI-01**: CI runs all test subdirectories (test/*.test.mjs + test/**/*.test.mjs)
- [ ] **CI-02**: Integration tests assert real CLI output against laravel/framework eval fixture
- [ ] **CI-03**: Coverage reporting step added to CI pipeline

### Future (post-v1.2)

Candidate themes deferred after v1.2:
- Python support (LANG-01)
- Go support (LANG-02)
- Rust support (LANG-03)

### Out of Scope

- Rewriting agentmap in PHP — core stays Node.js
- Deep static type inference engine (declared types only suffice)
- npm/Packagist publish (v1 ships as GitHub fork; publish later)

## Context

- **Tech stack:** Node.js >= 18, ESM modules (`.mjs`), tree-sitter (PHP + JS grammar families)
- **Tests:** 194 passing — 159 inherited TS/JS + hooks/install/integration, 8 PHP parser, 7 Laravel, 5 mixed, 15 enhanced Laravel
- **Architecture:** `src/Core/` plugin pattern — new languages add a parser module, no core changes
- **Current parser stack:** EnhancedLaravelParser (PHP) → LaravelParser → PhpParser → LanguageParser
- **v1.1 deliverables:** 99.6% token savings on laravel/framework; 100%/100% eval accuracy; all docs aligned

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Add PHP to existing Node.js codebase | Preserves all TS/JS functionality | ✓ Good |
| tree-sitter-php for parsing | Mature, no PHP runtime dependency | ✓ Good |
| Decompose monolith into `src/Core/` | Plugin architecture for future languages | ✓ Good |
| Public fork (not PR upstream) | agentmap is TS/JS-only by design | ✓ Good |
| Blade via regex (not tree-sitter-blade) | tree-sitter-blade unmaintained | ✓ Good |
| EnhancedLaravelParser extends PhpParser (not LaravelParser) | Avoid double-inheritance | ✓ Good |
| DDD detection by naming convention | Laravel community follows conventions strictly | ✓ Good — projects with custom names extend `DDD_MARKERS` |
| Type inference reads declared types only | Deep inference out-of-scope | ✓ Good |
| Static facade map (not runtime resolution) | Stable Laravel API | ⚠️ Revisit — may need updates for new Laravel versions |
| v1.1: docs + eval/bench only (no src/Core/ changes) | Focus on validation, not new features | ✓ Good — clean scope boundary |
| v1.1: laravel/framework as eval/bench target | Authoritative, largest PHP/Laravel repo | ✓ Good — 99.6% savings, 100% accuracy |
| v1.1: test count corrected 196→194 | Fabricated count caught during verification; 159 TS/JS + 35 PHP actual | ✓ Good — honesty over vanity |

## Constraints

- **Compatibility:** All existing CLI flags and output formats must remain unchanged (achieved ✓)
- **Performance:** PHP parsing comparable to TS/JS speed (achieved ✓)
- **Dependencies:** Minimize additions — only `tree-sitter` + `tree-sitter-php` added

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-21 after v1.3 milestone start*
