# Milestones

## v1.1 Docs Sync + PHP Eval

**Shipped:** 2026-06-19
**Phases:** 7-12 (all complete)
**Plans:** 10 (2+2+1+2+2+1)
**Tests:** 194/194 pass
**Audit:** ✅ passed (`milestones/v1.1-MILESTONE-AUDIT.md`)

### Delivered

Brought all user-facing docs in line with v1.0's PHP/Laravel capabilities — README rewritten to lead with PHP/Laravel, agent skills and hooks updated, CHANGELOG populated. Produced real benchmark/eval data for `laravel/framework`: 99.6% token savings, 100%/100% symbol-def/dependents accuracy.

### Key Accomplishments

1. Rewrote README to lead with PHP/Laravel positioning while preserving upstream fork credit — demoted TS/JS to "inherited" status
2. Updated agent skills, guidance, Cursor rules, and install hooks for PHP/Laravel awareness
3. CHANGELOG v1.0 entry with full feature list grouped by category; package.json fork metadata set
4. Extended eval/eval.mjs with PHP ground-truth resolver (declaration regex, PSR-4 `use` resolver) and Laravel fixture — 100%/100% accuracy
5. Extended benchmark/bench.mjs with `--repo` fixture support and PHP-aware grep — 99.6% token savings on laravel/framework
6. Verified 194/194 tests pass; corrected fabricated test count (196→194) and restored cross-doc consistency

### Stats

- **Commits:** 7 (aa5038f → 5045b6c)
- **Git range:** `aa5038f` → `5045b6c`
- **Timeline:** 2026-06-19 (single day)
- **Constraint:** Zero changes to `src/Core/` — docs + eval/bench only

### Notes

All 6 phases executed with GSD workflow (discuss → plan → execute → verify). No per-phase directories archived since phases were executed inline without SUMMARY.md files. See milestone archive for full phase details.

## v1.0 PHP/Laravel Support

**Shipped:** 2026-06-19
**Phases:** 1-6 (all complete)
**Plans:** 4 (Phase 6 only; Phases 1-5 retroactive)
**Tests:** 194/194 pass
**Audit:** ✅ passed (`milestones/v1.0-MILESTONE-AUDIT.md`)

### Delivered

Extended agentmap to support PHP/Laravel codebases with the same repo-mapping superpower TS/JS projects get — modular `src/Core/` architecture with a `LanguageParser` plugin interface, full tree-sitter-php parsing, Laravel awareness (facades, Eloquent, routes, providers), Blade/Livewire/DDD/Artisan/middleware/migration support, declared-type inference, method-call tracing, and unified TS/JS+PHP graphs with Inertia cross-references.

### Key Accomplishments

1. Decomposed monolithic `agentmap.mjs` into modular `src/Core/` with `LanguageParser` plugin interface
2. Added tree-sitter-php parser with full AST extraction and PSR-4 resolution
3. Wired PHP into all CLI commands (`--any`, `--map`, `--digest`, `--relates`, `--find`, `--hub`, `--symbols`) with zero new flags
4. Laravel awareness — facade resolution, Eloquent relations, route parsing, service providers
5. Mixed-language graphs — TS/JS + PHP unified, Inertia cross-references detected
6. Enhanced Laravel — Blade, Livewire, DDD/Repository, Artisan, middleware, migrations, type inference, call tracing

### Stats

- **LOC added:** 2065 in `src/Core/` + ~600 LOC tests
- **Dependencies:** `tree-sitter@0.22.4`, `tree-sitter-php@0.22.6`
- **Git range:** `25ad25f` → `6083081` + `a6d3de9` retroactive docs
- **PR:** [#1](https://github.com/dstwn/agentmap-php/pull/1) (merged 2026-06-19)

### Notes

This milestone shipped via direct commits without per-phase GSD artifacts. Phase SUMMARYs and VERIFICATIONs were backfilled retroactively from source code, test results, and commit history. Future milestones should run the discuss → plan → execute → verify → ship loop per phase.
