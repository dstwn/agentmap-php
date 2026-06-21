# Phase 15: Advanced Type Resolution - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase extends TypeResolver with (1) fluent method chain tracing (`$a->b()->c()->d()` up to configurable depth), and (2) a confidence level system tagging every resolved type as HIGH/MEDIUM/LOW. Backfills Phase 14 types with MEDIUM confidence. Declared types from inferTypes() get HIGH. Chain-inferred types get LOW. Default output shows HIGH+MEDIUM only; `--all` flag (wired in Phase 16) reveals LOW. No new CLI flags wired in this phase.

</domain>

<decisions>
## Implementation Decisions

### Method Chain Tracing Architecture
- Extend `TypeResolver.mjs` with a `resolveChain()` method — keeps all type resolution in one module
- Default chain depth limit: 3 — captures most fluent builder patterns without runaway
- Algorithm: look up `b()` return type in PSR4Resolver-resolved `Foo` AST, then `c()` return in that result — depth-first walk
- Stop chain at first unknown type, emit `LOW` confidence for partial results

### Confidence Level System
- `confidence` field on each type entry: `{ type: "Foo", confidence: "HIGH", source: "declared" }`
- Backfill Phase 14 `assignedTypes` and `phpDocTypes` entries with `confidence: "MEDIUM"` in this phase
- Existing `enhanced.types` entries (from inferTypes()) get `confidence: "HIGH"` + `source: "declared"`
- Default output: HIGH+MEDIUM only; `--all` flag reveals LOW (flag wired in Phase 16)

### Depth Limit & Runaway Prevention
- `DEFAULT_CHAIN_DEPTH = 3` constant in `constants.mjs`, overridable via map.json config key `chainDepth`
- At depth limit: log warning to stderr + mark result `LOW` confidence
- Cycle prevention: Set of visited class+method pairs per resolution call — break with LOW on revisit
- PHP fixtures: 1-level, 2-level, 3-level, and >3-level chains to verify truncation behavior

### the agent's Discretion
- Internal AST traversal implementation for method return type lookup
- Exact shape of visited-pairs tracking (string key format for the Set)
- Warning message exact wording
- Fixture file structure and test case distribution

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/Core/TypeResolver.mjs` — extend with resolveChain(); already has PSR4Resolver integration from Phase 14
- `src/Core/PSR4Resolver.mjs` — FQCN-to-path resolution for finding class files in chain
- `src/Core/constants.mjs` — add DEFAULT_CHAIN_DEPTH constant
- `test/type-resolver.test.mjs` — extend with chain and confidence tests
- `test/fixtures/assignments.php`, `test/fixtures/phpdoc.php` — add chain fixtures alongside

### Established Patterns
- Phase 14 type entry shape: `{ type: "Foo", confidence: "MEDIUM" }` — extend source field
- TypeResolver.resolve() returns `{ assignedTypes, phpDocTypes }` — extend to include `chainTypes`
- Confidence: MEDIUM for assigned/PHPDoc (Phase 14), HIGH for declared (inferTypes), LOW for chain (Phase 15)
- All I/O synchronous, no new packages

### Integration Points
- `src/Core/TypeResolver.mjs` resolveChain() — new method on existing class
- `agentmap.mjs` TypeResolver integration block — add chainTypes to file entries, backfill confidence on existing entries
- `constants.mjs` — DEFAULT_CHAIN_DEPTH = 3, chainDepth config key
- Phase 16 will use confidence levels for `--all` flag filtering

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond REQUIREMENTS.md TYP-03 and TYP-04 — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

- `--all` CLI flag (Phase 16 wires all CLI flags)
- `--chain-depth N` CLI override (Phase 16)
- Control-flow type narrowing (v2 per REQUIREMENTS.md)
- Cross-file chain resolution beyond PSR4Resolver lookup

</deferred>
