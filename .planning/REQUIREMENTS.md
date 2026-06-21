# Requirements: agentmap-php

**Defined:** 2026-06-21
**Core Value:** Give PHP/Laravel developers (and their AI coding agents) the same repo-context superpower TS/JS projects get from agentmap — ranked import graphs, queryable code maps, and dramatically reduced token budgets for understanding a codebase.

## v1 Requirements

Requirements for v1.2 milestone. Each maps to roadmap phases.

### Composer Dependency Graph

- [ ] **CMP-01**: Parse `composer.json` for package metadata (name, version, description) and dependency edges (require, require-dev, conflict, replace, provide)
- [ ] **CMP-02**: Parse `composer.lock` for resolved dependency graph with exact installed versions
- [ ] **CMP-03**: Display version constraints with operator semantics (caret ^, tilde ~, exact, wildcard *, branch-name, stability flags @dev)
- [ ] **CMP-04**: Merge package dependency edges into file-level PageRank with configurable weight cap to prevent edge explosion
- [ ] **CMP-05**: Add `--packages` CLI flag to query package dependency graph, and integrate package names into `--any` router

### PHP Type Resolution

- [ ] **TYP-01**: Track types through assignment expressions (`$x = new Foo()` → type `Foo`, `$x = $y->method()` → return type)
- [ ] **TYP-02**: Parse PHPDoc annotations (`@var`, `@return`, `@param`, `@property`) from docblocks using line-number-based comment attachment
- [ ] **TYP-03**: Trace types through method chains (`$a->b()->c()->d()`) with configurable depth limit
- [ ] **TYP-04**: Tag every resolved type with confidence level — HIGH (declared), MEDIUM (assigned/new/PHPDoc), LOW (inferred through chains)
- [ ] **TYP-05**: Add `--types` CLI flag to inspect resolved type information per symbol or file

### Legacy Non-PSR-4 Detection

- [ ] **LEG-01**: Parse `autoload.classmap` and `autoload.files` from `composer.json` for non-PSR-4 file registration
- [ ] **LEG-02**: Detect source directories via heuristic patterns (`classes/`, `lib/`, `modules/`, `src/` without PSR-4 namespace prefix)
- [ ] **LEG-03**: Add `--legacy` CLI flag to report non-PSR-4 files, unregistered directories, and suggested PSR-4 mappings

## v2 Requirements

Deferred to future milestones.

### Additional Language Support

- **LANG-01**: Python support via tree-sitter-python
- **LANG-02**: Go support via tree-sitter-go
- **LANG-03**: Rust support via tree-sitter-rust

### Advanced Type Inference

- **ADV-01**: Full control-flow-aware type inference (PHPStan/Psalm-level SSA)
- **ADV-02**: Type narrowing through conditionals and instanceof checks

## Out of Scope

| Feature | Reason |
|---------|--------|
| Deep SSA-based type inference (PHPStan level) | Complexity vastly exceeds code-map needs; declared + assignment + PHPDoc covers ~90% of use cases |
| SAT version constraint resolver | composer.lock provides resolved graph; SAT solver is over-engineering for a code-map tool |
| PHP runtime type checking | Agentmap is a static analysis tool; runtime type information is not available |
| Full PHP parser replacement | tree-sitter-php covers all needed AST nodes; no benefit from replacing it |
| Vendor directory parsing | Vendor files explicitly excluded to prevent PageRank pollution |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CMP-01 | | Pending |
| CMP-02 | | Pending |
| CMP-03 | | Pending |
| CMP-04 | | Pending |
| CMP-05 | | Pending |
| TYP-01 | | Pending |
| TYP-02 | | Pending |
| TYP-03 | | Pending |
| TYP-04 | | Pending |
| TYP-05 | | Pending |
| LEG-01 | | Pending |
| LEG-02 | | Pending |
| LEG-03 | | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 0
- Unmapped: 13 ⚠️

---
*Requirements defined: 2026-06-21*
*Last updated: 2026-06-21 after initial definition*
