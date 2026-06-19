# Roadmap: agentmap-php

## Overview

Extend agentmap v0.9.0 to support PHP/Laravel codebases by: decomposing the monolith into a language-agnostic plugin architecture, adding tree-sitter-php parsing, integrating PHP import graphs and symbol ranking into all existing CLI commands, adding Laravel-specific awareness, and supporting mixed TS/JS + PHP projects.

## Phases

- [ ] **Phase 1: Codebase Decomposition** — Extract monolith into modular architecture with language plugin interface
- [ ] **Phase 2: PHP Parsing Engine** — Add tree-sitter-php parser, import graph, symbol ranking for PHP files
- [ ] **Phase 3: PHP Commands** — Wire PHP into all CLI commands (--any, --map, --digest, --relates, --find, etc.)
- [ ] **Phase 4: Laravel Awareness** — Facade resolution, Eloquent hierarchy, route parsing, service provider recognition
- [ ] **Phase 5: Mixed Projects** — Cross-language graph merging and mixed TS/JS + PHP support
- [x] **Phase 6: Enhanced Laravel** — Blade templates, Livewire, DDD/Actions/Repository patterns, Artisan commands, middleware tracing, migrations, deeper static analysis

## Phase Details

### Phase 1: Codebase Decomposition
**Goal**: agentmap.mjs monolith is decomposed into `src/Core/` modules with a language-agnostic plugin interface that new language backends can implement
**Depends on**: Nothing (first phase)
**Requirements**: DECOMP-01, DECOMP-02, TEST-01
**Success Criteria** (what must be TRUE):
  1. `src/Core/` contains extracted modules (build, graph, rank, cli, hooks, doctor)
  2. `agentmap.mjs` re-exports from `src/Core/` — all CLI flags and output unchanged
  3. All existing tests pass
  4. A `LanguageParser` interface/contract exists that new languages can implement
**Plans**: TBD

Plans:
- [ ] 01-01: Extract build/graph modules into src/Core/ with language parser interface
- [ ] 01-02: Extract CLI/rank/output modules and wire them through new interface
- [ ] 01-03: Add tests for the new module structure and verify no regression

### Phase 2: PHP Parsing Engine
**Goal**: PHP files are parsed with tree-sitter-php, import graph is built, symbols are ranked — all behind the new LanguageParser interface
**Depends on**: Phase 1
**Requirements**: PHP-01, PHP-02, PHP-03, PHP-04, TEST-02
**Success Criteria** (what must be TRUE):
  1. PHP files parsed: classes, interfaces, traits, enums, functions, namespaces extracted
  2. `use` statements and `require`/`include` resolve to import graph edges
  3. PSR-4 namespace resolution works via `composer.json`
  4. PageRank and symbol ranking include PHP symbols
  5. PHP-specific test suite passes
**Plans**: TBD

Plans:
- [ ] 02-01: Implement PhpParser class using tree-sitter-php — AST extraction for all PHP constructs
- [ ] 02-02: Implement PHP import resolution (use statements, PSR-4, composer.json)
- [ ] 02-03: Implement PHP symbol ranking and integration with existing PageRank pipeline
- [ ] 02-04: Write PHP test suite with fixtures (plain PHP and Composer projects)

### Phase 3: PHP Commands
**Goal**: All agentmap CLI commands work with PHP files — --any, --map, --digest, --relates, --find, --hub, --symbols all include PHP results
**Depends on**: Phase 2
**Requirements**: PHP-05, PHP-06, PHP-07, TEST-01
**Success Criteria** (what must be TRUE):
  1. `--any` with a PHP file/symbol returns correct results
  2. `--map` and `--digest` include PHP files in token-budgeted output
  3. `--relates`, `--find`, `--hub`, `--symbols` all surface PHP results
  4. All existing TS/JS tests still pass unchanged
**Plans**: TBD

Plans:
- [ ] 03-01: Wire PHP parser output into --any router and --map/digest generators
- [ ] 03-02: Wire PHP data into --relates, --find, --hub, --symbols commands
- [ ] 03-03: End-to-end tests for all PHP CLI commands

### Phase 4: Laravel Awareness
**Goal**: Laravel-specific patterns are recognized — facades resolved to underlying classes, Eloquent model hierarchy traced, route files parsed, service provider bindings understood
**Depends on**: Phase 3
**Requirements**: LARAV-01, LARAV-02, LARAV-03, LARAV-04, TEST-04
**Success Criteria** (what must be TRUE):
  1. Laravel facades resolve to their underlying classes in the import graph
  2. Eloquent model inheritance chain is traced (Model → BaseModel → User, etc.)
  3. Route files (web.php, api.php) are parsed and route handlers linked to controllers
  4. Service provider `$bindings`/`$singletons` are recognized
  5. Laravel fixture tests pass
**Plans**: TBD

Plans:
- [ ] 04-01: Implement Laravel facade resolution and Eloquent hierarchy tracing
- [ ] 04-02: Implement route file parsing and service provider recognition
- [ ] 04-03: Write Laravel fixture tests (real Laravel scaffold)

### Phase 5: Mixed Projects
**Goal**: Repos with both TS/JS and PHP files are fully supported — both languages are parsed and merged into a single graph, cross-language references detected
**Depends on**: Phase 4
**Requirements**: MIXED-01, MIXED-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. Same repo with .ts/.js and .php files: both parsed, one unified graph
  2. Cross-language references recognized (e.g., Inertia links)
  3. Mixed-project test suite passes
  4. All existing and PHP-specific tests pass
**Plans**: TBD

Plans:
- [ ] 05-01: Implement cross-language graph merging in the LanguageParser pipeline
- [ ] 05-02: Add Inertia-style cross-reference detection (configurable)
- [ ] 05-03: Write mixed-project fixture tests

### Phase 6: Enhanced Laravel
**Goal**: Comprehensive Laravel awareness — Blade templates linked to controllers, Livewire components with bindings, DDD/Actions/Repository pattern recognition, Artisan command definitions, middleware tracing, migration/schema parsing, and basic static analysis (type inference, method call tracing)
**Depends on**: Phase 5
**Requirements**: LARAV-05 through LARAV-15
**Success Criteria** (what must be TRUE):
  1. `.blade.php` files parsed — directives (@if, @foreach, @component, @livewire, etc.) extracted and linked
  2. Livewire components recognized — class methods, `wire:model`/`wire:click` bindings traced
  3. DDD structure detected — Domains, Actions, Repositories, Services, DTOs identified in import graph
  4. Artisan commands parsed — `$signature`, arguments, options extracted
  5. Middleware traced — route middleware assignments, middleware class resolution
  6. Migration files parsed — table schemas, column types, foreign keys extracted
  7. Basic type inference — method return types, parameter types, property types resolved
  8. Method call tracing — controller→service→repository call chains visible in graph
  9. All existing tests (139) still pass
**Plans**: 4 plans

Plans:
- [x] 06-01: Blade template parser + Livewire component recognition
- [x] 06-02: DDD/Actions/Repository pattern detection + Artisan commands
- [x] 06-03: Middleware tracing + migration/schema parsing
- [x] 06-04: Static analysis engine (type inference, call tracing) + tests

## Progress

**Execution Order:** Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Codebase Decomposition | 3/3 | Complete | 2026-06-19 |
| 2. PHP Parsing Engine | 4/4 | Complete | 2026-06-19 |
| 3. PHP Commands | 3/3 | Complete | 2026-06-19 |
| 4. Laravel Awareness | 3/3 | Complete | 2026-06-19 |
| 5. Mixed Projects | 3/3 | Complete | 2026-06-19 |
| 6. Enhanced Laravel | 4/4 | Complete | 2026-06-19 |
