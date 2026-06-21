# Research Summary: agentmap-php v1.2 — Composer Dependency Graph + PHP Type Resolution

**Domain:** Composer dependency graph parsing + full PHP type inference for a Node.js-based repo-mapping tool
**Researched:** 2026-06-21
**Overall confidence:** HIGH

## Executive Summary

agentmap-php v1.2 adds three new capabilities to the existing repo-mapping tool: Composer package-level dependency graph with version constraints, full PHP type inference (beyond the current declared-types-only approach), and legacy non-PSR-4 code detection. All three features integrate cleanly into the existing `build()` pipeline in `agentmap.mjs` with zero new npm dependencies.

The existing architecture is a monolith-in-miniature: `agentmap.mjs`'s `build()` function orchestrates everything, with `src/Core/` modules providing isolated components (LanguageParser hierarchy, PageRank, symbol ranking, Vue SFC extraction). The PHP parsing block is currently inline in `build()` (lines 649–740). The new modules follow the same pattern: standalone classes in `src/Core/` that produce data consumed by `build()`.

**Key architectural decisions:**
- Three new files in `src/Core/`: `composer-graph.mjs`, `type-resolver.mjs`, `psr4-resolver.mjs`
- Zero new npm dependencies — all use stdlib (readFileSync, JSON.parse, readdirSync) + tree-sitter AST objects
- Type resolution COMPLEMENTS (doesn't replace) `EnhancedLaravelParser.inferTypes()` — both write to `enhanced.types`
- Package→file edge merging uses weight factor 0.3 to subtly boost ranking without drowning out direct imports
- Graceful degradation when composer files are missing — warn, skip, never crash

## Key Findings

**Stack:** Zero new dependencies. Homegrown `parseConstraint()` for version display (7 operators, ~30 lines). No semver library.

**Architecture:** Three new `src/Core/` modules, 2 existing modules with minor modifications (PhpParser gets `setPsr4Resolver()`, constants.mjs SCHEMA_VERSION bumped 3→4), 8 modules unchanged. `agentmap.mjs` build() gets ~50 lines of new orchestration code.

**Critical pitfall:** Package→file edge explosion in PageRank — each package dependency maps to N_files_in_A × N_files_in_B edges, potentially millions for large projects. Mitigation: cap at 1000 edges per dependency or use a two-graph composite score approach.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **psr4-resolver.mjs + composer-graph.mjs (parallel)** — Foundation modules. No dependencies between them. Both testable with fixture files (no AST work needed). Quick wins that enable all downstream features.

2. **Wire PSR4Resolver into PhpParser** — Modify `PhpParser._resolvePsr4()` to delegate to PSR4Resolver. Minimal code change, high impact on import resolution accuracy for non-PSR-4 codebases.

3. **type-resolver.mjs (MVP)** — Assignment + `new` expression resolution. Defers method chain tracing to post-MVP. Requires understanding tree-sitter PHP AST node types for assignment_expression, object_creation_expression.

4. **PageRank integration** — Merge package dependency edges into file graph with weight cap. Test on laravel/framework benchmark to verify build time stays under 2s.

5. **CLI flags: --packages, --legacy, --types** — Connect new modules to existing CLI interface. Modify --any to search package names. Bump SCHEMA_VERSION 3→4.

**Phase ordering rationale:**
- Parallel phases 1+2 minimize total wall time (no dependencies block)
- Type resolution waits for PSR4Resolver because better import resolution → more accurate type tracing (TypeResolver needs to find file paths from FQCNs)
- PageRank integration waits for composer-graph because it consumes its output
- CLI handlers wait for everything (cosmetic dependency)

**Research flags for phases:**
- Phase 3 (TypeResolver): Needs deeper research on tree-sitter PHP grammar node types for assignment, `new`, and method call patterns — specifically the child node structure and field names. May need a spike to validate the AST walker.
- Phase 4 (PageRank): Needs laravel/framework benchmark to validate edge cap threshold. Currently 194 tests, no package-graph-specific tests yet.
- Phase 1 (composer-graph): Low risk — well-understood JSON format. Document the constraint parser edge cases (dev-master, aliases) but don't over-engineer.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new deps — all stdlib or existing tree-sitter. No platform risk. |
| Features | HIGH | Well-scoped to PROJECT.md requirements (ADV-01, ADV-04). Full PHP deep inference explicitly out of scope. |
| Architecture | HIGH | Clean plugin pattern extension. Three new modules, minimal changes to existing code (2 of 13 files modified). |
| Pitfalls | MEDIUM | Edge explosion is well-understood but untested at scale. Two-graph approach is a known fallback. Legacy directory detection needs real-world testing on non-Laravel PHP projects. |

## Gaps to Address

- **Method chain type resolution** is deferred to post-MVP — its complexity (cross-file lookup, optional method return declarations) requires dedicated research on tree-sitter PHP grammar patterns for member_call_expression → chained calls. The MVP handles only direct assignments and `new` expressions.
- **Package→file edge sampling strategy** needs a spike on laravel/framework to measure actual edge counts and validate the 1000-edge cap threshold. If the cap is too low (<0.1% of all edges kept), the package rank boost becomes negligible.
- **Non-PSR-4 detection on non-Laravel projects** is speculative — the heuristics (classes/, modules/, lib/ directories) are based on common PHP conventions but need validation against real-world projects like WordPress plugins, Drupal modules, and Symfony bundles.
