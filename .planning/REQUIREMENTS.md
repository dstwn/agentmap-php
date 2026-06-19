# Requirements: agentmap-php

**Defined:** 2026-06-19
**Core Value:** Give PHP/Laravel developers (and their AI coding agents) the same repo-context superpower that TS/JS projects get from agentmap.

## v1 Requirements

### Codebase Decomposition

- [ ] **DECOMP-01**: Extract monolith `agentmap.mjs` into `src/Core/` modules with a language-agnostic plugin interface
- [ ] **DECOMP-02**: All existing CLI flags and output formats remain unchanged after decomposition

### PHP Parsing (General)

- [ ] **PHP-01**: Parse PHP files — extract classes, interfaces, traits, enums, functions, namespaces
- [ ] **PHP-02**: Resolve `use` statements and `require`/`include` to build import graph
- [ ] **PHP-03**: PSR-4 namespace-to-filepath resolution via `composer.json`
- [ ] **PHP-04**: Symbol ranking (PageRank, identifier graph) for PHP code

### PHP Commands

- [ ] **PHP-05**: `--any` router works with PHP files (file → symbol → feature → grep)
- [ ] **PHP-06**: `--map` and `--digest` include PHP files with correct token budget
- [ ] **PHP-07**: `--relates`, `--find`, `--hub`, `--symbols` all include PHP results

### Laravel Awareness

- [ ] **LARAV-01**: Resolve Laravel facades to their underlying classes for symbol ranking
- [ ] **LARAV-02**: Recognize Eloquent model class hierarchy
- [ ] **LARAV-03**: Parse route files (web.php, api.php) and link route handlers
- [ ] **LARAV-04**: Recognize service providers and their bindings

### Mixed Projects

- [ ] **MIXED-01**: Same repo with `.ts`/`.js` and `.php` files — both parsed and merged into one graph
- [ ] **MIXED-02**: Cross-language references detected (e.g., Inertia pages linking TS/JS components to PHP controllers)

### Testing & CI

- [ ] **TEST-01**: All existing 15+ test suites continue to pass unchanged
- [ ] **TEST-02**: PHP-specific test suite covering parsing, graph, ranking, commands
- [ ] **TEST-03**: Mixed-project test suite (TS + PHP)
- [ ] **TEST-04**: Laravel-specific fixture tests

## v2 Requirements

### Additional Languages

- **LANG-01**: Python support (tree-sitter-python)
- **LANG-02**: Go support (tree-sitter-go)
- **LANG-03**: Rust support (tree-sitter-rust)

### Advanced Analysis

- **ADV-01**: Full PHP type resolution (not just AST-level)
- **ADV-02**: Laravel Blade template parsing
- **ADV-03**: Livewire component recognition
- **ADV-04**: Composer package dependency graph

## Out of Scope

| Feature | Reason |
|---------|--------|
| PHP rewrite of agentmap | Core stays Node.js; PHP support via tree-sitter plugin |
| Deep static analysis | Import graph + symbols only; no type inference engine |
| Non-PHP languages in v1 | PHP first; Python/Go/Rust deferred to v2 |
| Packagist/npm publish | v1 ships as GitHub fork; publish later |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DECOMP-01 | Phase 1 | Pending |
| DECOMP-02 | Phase 1 | Pending |
| PHP-01 | Phase 2 | Pending |
| PHP-02 | Phase 2 | Pending |
| PHP-03 | Phase 2 | Pending |
| PHP-04 | Phase 2 | Pending |
| PHP-05 | Phase 3 | Pending |
| PHP-06 | Phase 3 | Pending |
| PHP-07 | Phase 3 | Pending |
| LARAV-01 | Phase 4 | Pending |
| LARAV-02 | Phase 4 | Pending |
| LARAV-03 | Phase 4 | Pending |
| LARAV-04 | Phase 4 | Pending |
| MIXED-01 | Phase 5 | Pending |
| MIXED-02 | Phase 5 | Pending |
| TEST-01 | Phase 1-5 | Pending |
| TEST-02 | Phase 2 | Pending |
| TEST-03 | Phase 5 | Pending |
| TEST-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-19*
*Last updated: 2026-06-19 after initial definition*
