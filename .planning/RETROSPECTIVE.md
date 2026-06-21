# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.2 — PHP Type Resolution + Composer Dependency Graph

**Shipped:** 2026-06-21
**Phases:** 4 | **Plans:** 10 | **Tasks:** 21

### What Was Built
- `ComposerParser` + `PSR4Resolver` + `LegacyDetector` — Composer dependency graph with all 6 edge types, version constraints, legacy non-PSR-4 detection
- `TypeResolver` — assignment expression tracking (`$x = new Foo()`, static calls) + PHPDoc annotation parsing (`@var`, `@return`, `@param`, `@property`)
- Method chain tracing (`resolveChain()`) with depth-3 default, cycle detection, and confidence tagging (HIGH/MEDIUM/LOW)
- `--packages`, `--types`, `--legacy` CLI flags + `--any` package routing + PageRank edge merging (0.1× weight, 1000-edge cap)
- SCHEMA_VERSION 3→4 with automatic cache rebuild on stale maps

### What Worked
- TDD RED→GREEN cycles caught real integration bugs early (TypeResolver in agentmap.mjs not map-builder.mjs)
- Research agents surfacing critical pitfalls before planning (PSR4Resolver already existed in PhpParser; psr4Map was `{}` in integration; member_call_expression nests left-recursively)
- Wave-based parallel execution — Phase 13 Wave 1 ran 13-01 and 13-02 in parallel with no file conflicts
- Phase 13 PSR4Resolver being extracted as standalone module paid off immediately in Phase 14 and 15
- Plan checker caught VALIDATION.md absence and test count discrepancy before execution

### What Was Inefficient
- Phase 14 VERIFICATION.md required human validation for performance benchmark — fixture pool too small for automated timing; adding a simple micro-benchmark in the test suite would have avoided the manual step
- Phase 15 TDD RED tests were existence-only (`typeof resolveChain === "function"`) — GREEN cycle didn't upgrade them to behavioral assertions, requiring a gap-closure round after verification
- CONTEXT.md stated PageRank edges go in map-builder.mjs but research and Phase 14 history already showed the correct location is agentmap.mjs — context had a stale assumption that wasn't caught until the researcher flagged it

### Patterns Established
- New `src/Core/` modules follow standalone class pattern (not LanguageParser subclass) for non-source-code parsers
- All type entries use `{ type, confidence, source }` shape — consistent shape across all resolution paths
- Research agents should explicitly verify integration points from prior phase deviations before planning
- Plan checker should be re-run after fixes rather than trusting inline corrections

### Key Lessons
1. Keep fixture files representative of real codebases (multiple files, varied patterns) — 2-file fixture pools cause human-needed verification gaps that automated testing could handle
2. TDD RED tests must assert on output shape, not just method existence — existence checks pass trivially and give false confidence
3. CONTEXT.md locked decisions that reference specific files should be validated against prior phase SUMMARY.md deviations before planning

### Cost Observations
- Model mix: ~0% opus, ~100% sonnet (researcher/planner/checker/executor/verifier all sonnet)
- Sessions: 1 autonomous run (all 4 phases + lifecycle)
- Notable: 256/256 tests in a single autonomous session with no manual code changes

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 6 | retroactive | Baseline PHP/Laravel support |
| v1.1 | 6 | 10 | Docs + eval, first full GSD cycle |
| v1.2 | 4 | 10 | First fully autonomous run, all phases unattended |

### Cumulative Quality

| Milestone | Tests | Zero-Dep Additions |
|-----------|-------|-------------------|
| v1.0 | 194 | tree-sitter-php, tree-sitter |
| v1.1 | 194 | none |
| v1.2 | 256 | none (built-ins only) |

### Top Lessons (Verified Across Milestones)

1. Research agents that read prior phase SUMMARY.md files catch integration drift before it becomes execution blockers
2. TDD RED tests must be behavioral, not existential — existence checks degrade silently into false coverage
3. Keeping all parsers as zero-new-dependency built-in implementations keeps the package surface flat and the test suite fast
