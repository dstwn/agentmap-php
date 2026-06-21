# Phase 16: Integration & CLI - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase wires all v1.2 features into the CLI: `--packages`, `--types`, `--legacy`, `--any` package routing, PageRank edge merging for package→file boost, and SCHEMA_VERSION bump 3→4. Depends on Phases 13 (ComposerParser, LegacyDetector), 14 (TypeResolver MVP), and 15 (resolveChain, confidence levels). No new parsing logic — this phase is pure integration and output formatting.

</domain>

<decisions>
## Implementation Decisions

### New CLI Flag Design
- `--packages`: text output by default with `--json` override — matches all existing flags pattern
- `--types`: per-file by default (`--types src/Foo.php`); symbol-level via `--types ClassName::method`
- `--legacy`: list of files/dirs with issue type (classmap, files-entry, heuristic-dir) + suggested PSR-4 mapping for heuristic dirs
- `--any` router: package results appear after file matches, before symbol matches — low priority

### PageRank Edge Merging
- Add directed edges from each PHP file to vendor files of packages it depends on (require edges only) — capped at 1000 per dependency
- Merge happens in `map-builder.mjs` `build()` after ComposerParser runs, before `pagerank()`
- Cap enforcement: truncate to first 1000 files (alphabetical) + warn to stderr
- Edge weight: 0.1× direct file import weight — subtle boost per SC-5

### Schema Version & Backward Compatibility
- `SCHEMA_VERSION` bumped in `src/Core/constants.mjs`: 3 → 4
- Rebuild triggered automatically by existing `ensureFresh()` schema-version mismatch detection — no code change needed
- Old v3 map.json: auto-rebuild on first run (schema mismatch → silent rebuild)
- Schema v4 documents: `packages`, `legacyWarnings`, `assignedTypes`, `phpDocTypes`, `chainTypes` keys already present from earlier phases

### the agent's Discretion
- Exact output formatting for `--packages`, `--types`, `--legacy` (column widths, separators)
- `--any` package result entry format
- Exact edge weight constant value (0.1 is a guideline — agent may tune within "subtle" range)
- Test fixture design for CLI integration tests

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/Core/ComposerParser.mjs` — `packages` result with edge types and version constraints (Phase 13)
- `src/Core/LegacyDetector.mjs` — `legacyWarnings` result (Phase 13)
- `src/Core/TypeResolver.mjs` — `assignedTypes`, `phpDocTypes`, `chainTypes` per file (Phases 14-15)
- `src/Core/constants.mjs` — `SCHEMA_VERSION`, `MAP`, `HUBS_LIMIT` — bump SCHEMA_VERSION here
- `src/Core/map-builder.mjs` — `build()` integration point for edge merging
- `src/Core/graph.mjs` — `pagerank()` function — edges go in before this runs
- `agentmap.mjs` — CLI flag parsing at line ~1458, KNOWN set, output formatters
- `mcp.mjs` — 6 MCP tools — may need `--packages`, `--types`, `--legacy` tools added

### Established Patterns
- CLI flags: added to KNOWN set + flag parsing block + handler function in agentmap.mjs
- Output: `console.log()` for text, `JSON.stringify()` for `--json` mode
- `--any` router: file → symbol → feature → git grep fallback chain
- PageRank: `pagerank(edges, nodes, damping=0.85, 100 iterations)` — edges are `[from, to, weight]` triples

### Integration Points
- `agentmap.mjs` CLI flag parsing — add `--packages`, `--types`, `--legacy` to KNOWN set
- `agentmap.mjs` `--any` router — add package name lookup before symbol match
- `src/Core/map-builder.mjs` `build()` — add package→file edges before `pagerank()` call
- `src/Core/constants.mjs` — `SCHEMA_VERSION = 3` → `4`
- Existing test suite (199 tests) must remain green

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond REQUIREMENTS.md CMP-04, CMP-05, TYP-05, LEG-03 — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

- MCP tools for `--packages`, `--types`, `--legacy` (not in requirements — Phase 16 scope is CLI only)
- `--chain-depth N` CLI override (nice-to-have, not in requirements)
- `--all` confidence filter flag (already noted as Phase 16 but not in REQUIREMENTS.md explicitly — agent's discretion whether to include)

</deferred>
