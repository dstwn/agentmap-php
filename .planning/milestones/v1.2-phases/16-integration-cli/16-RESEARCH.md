# Phase 16: Integration & CLI - Research

**Researched:** 2026-06-21
**Domain:** Node.js CLI flag wiring, PageRank edge merging, schema versioning
**Confidence:** HIGH

## Summary

Phase 16 is a pure integration phase — no new parsing logic. All three upstream modules (ComposerParser, LegacyDetector, TypeResolver) are already wired into map.json via Phases 13–15. The data is there; this phase exposes it through CLI flags and merges package→file edges into PageRank.

The key architectural fact: PHP file enrichment (TypeResolver) lives in `agentmap.mjs` build(), NOT in `map-builder.mjs` build(). This matters for CMP-04 (PageRank edge merging) — package→file edges must be added in `agentmap.mjs` where `fileEdges` is built and `pagerank()` is called (lines 800–806), not in `map-builder.mjs` where only JS/TS files are processed.

The `--any` router (lines 1748–1800) currently chains: file match → symbol match → feature match → git-grep. Package name lookup must be injected between file-match and symbol-match per CONTEXT.md decision. The `data.packages` array (already in map.json from Phase 13) is the lookup source.

**Primary recommendation:** Three surgical integration points — (1) add flags to KNOWN set + handlers in agentmap.mjs, (2) add package→file edges in agentmap.mjs before `pagerank()` call, (3) bump SCHEMA_VERSION in constants.mjs.


<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- `--packages`: text output by default with `--json` override — matches all existing flags pattern
- `--types`: per-file by default (`--types src/Foo.php`); symbol-level via `--types ClassName::method`
- `--legacy`: list of files/dirs with issue type (classmap, files-entry, heuristic-dir) + suggested PSR-4 mapping for heuristic dirs
- `--any` router: package results appear after file matches, before symbol matches — low priority
- PageRank edge merging: directed edges from each PHP file to vendor files of packages it depends on (require edges only), capped at 1000 per dependency
- Merge happens in `map-builder.mjs` `build()` after ComposerParser runs, before `pagerank()` — **NOTE: actual location is agentmap.mjs, see Architecture Patterns**
- Cap enforcement: truncate to first 1000 files (alphabetical) + warn to stderr
- Edge weight: 0.1× direct file import weight — subtle boost per SC-5
- `SCHEMA_VERSION` bumped in `src/Core/constants.mjs`: 3 → 4
- Rebuild triggered automatically by existing `ensureFresh()` schema-version mismatch detection — no code change needed

### the agent's Discretion
- Exact output formatting for `--packages`, `--types`, `--legacy` (column widths, separators)
- `--any` package result entry format
- Exact edge weight constant value (0.1 is a guideline — agent may tune within "subtle" range)
- Test fixture design for CLI integration tests

### Deferred Ideas (OUT OF SCOPE)
- MCP tools for `--packages`, `--types`, `--legacy` (not in requirements — Phase 16 scope is CLI only)
- `--chain-depth N` CLI override (nice-to-have, not in requirements)
- `--all` confidence filter flag (already noted as Phase 16 but not in REQUIREMENTS.md explicitly — agent's discretion whether to include)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMP-04 | Merge package dependency edges into file-level PageRank with configurable weight cap | Package→file edges added to `fileEdges` array in agentmap.mjs before `pagerank()` call at line 805; weight = 0.1× direct import weight; cap = 1000 edges per package |
| CMP-05 | Add `--packages` CLI flag to query package dependency graph, and integrate package names into `--any` router | `data.packages` array already in map.json from Phase 13; add to KNOWN set; handler reads `data.packages`; `--any` injection between file and symbol branches |
| TYP-05 | Add `--types` CLI flag to inspect resolved type information per symbol or file | `entry.assignedTypes`, `entry.phpDocTypes`, `entry.chainTypes`, `entry.enhanced.types` all present on PHP file entries in map.json |
| LEG-03 | Add `--legacy` CLI flag to report non-PSR-4 files, unregistered directories, and suggested PSR-4 mappings | `data.legacyWarnings` array already in map.json from Phase 13; each warning has `type`, `directory`/`entry`, `message` fields |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CLI flag parsing | agentmap.mjs (entry point) | — | All flags dispatched from top-level if/else chain in agentmap.mjs |
| --packages output formatting | agentmap.mjs handler | — | Reads data.packages from ensureFresh() output |
| --types output formatting | agentmap.mjs handler | — | Reads assignedTypes/phpDocTypes/chainTypes/enhanced.types per file entry |
| --legacy output formatting | agentmap.mjs handler | — | Reads data.legacyWarnings from ensureFresh() output |
| --any package injection | agentmap.mjs --any branch | — | Inject package name search between file and symbol branches |
| PageRank edge merging (CMP-04) | agentmap.mjs build() | — | PHP files + pagerank() both live in agentmap.mjs build(); map-builder.mjs build() only has JS/TS |
| SCHEMA_VERSION bump | src/Core/constants.mjs | — | Single source of truth; ensureFresh() detects mismatch automatically |


## Standard Stack

No new packages. Phase 16 uses only existing project dependencies. [VERIFIED: codebase grep]

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:test | built-in | Test runner | Used by all existing tests |
| tree-sitter + tree-sitter-php | installed | PHP parsing (used by TypeResolver) | Already wired in Phases 14-15 |

### No Installation Required
All data sources (ComposerParser, LegacyDetector, TypeResolver) are already imported and wired. This phase adds zero new npm dependencies.

## Package Legitimacy Audit

No new packages in this phase. All code uses existing project modules.

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious SUS:** none

## Architecture Patterns

### System Architecture Diagram

```
CLI args (process.argv)
        │
        ▼
  KNOWN set check ──── unknown flag → exit 2
        │
        ▼
  Flag dispatch (if/else chain ~line 1670+)
  ┌─────────────────────────────────────────────────┐
  │  --packages → handler → data.packages           │
  │  --types    → handler → data.files[path].*Types │
  │  --legacy   → handler → data.legacyWarnings     │
  │  --any      → file? → [packages?] → symbols?    │
  │               → feature? → git-grep             │
  │  (existing flags unchanged)                     │
  └─────────────────────────────────────────────────┘
        │
        ▼
  ensureFresh() → reads/builds map.json
        │
        ▼
  out(jsonObj, prosePrinter)  ← wantJson controls branch
        │
        ▼
  stdout (text or JSON)

BUILD PATH (bare invocation / cache miss):
  agentmap.mjs build()
    → JS/TS parsing (ts-morph)
    → PHP parsing (PhpParser family)
    → TypeResolver enrichment (assignedTypes/phpDocTypes/chainTypes)
    → fileEdges array built
    → [NEW] package→file edges appended (capped at 1000, weight 0.1×)
    → pagerank(nodes, fileEdges)   ← edges merged before this call
    → rankedSymbols, hubs
    → out object written to map.json (schema: 4)
```

### Critical Integration Point: CMP-04 PageRank Edge Merging

The CONTEXT.md says "merge in map-builder.mjs". The **actual correct location is agentmap.mjs**, lines 799–806. [VERIFIED: codebase read]

Evidence from Phase 14 SUMMARY.md:
> "Integration placed in agentmap.mjs (not map-builder.mjs) — PHP files are parsed and added to files{} in agentmap.mjs build(), not in map-builder.mjs build()"

The fileEdges array and pagerank() call are at:
```javascript
// agentmap.mjs lines 800–806
const nodes = Object.keys(files);
const fileEdges = [];
for (const [p, f] of Object.entries(files))
  for (const tp of f.imports)
    if (files[tp]) fileEdges.push({ from: p, to: tp, weight: (f.importedSymbols[tp] || []).length || 1 });
const fileRank = pagerank(nodes, fileEdges);
for (const p of nodes) files[p].pagerank = +(fileRank[p] || 0).toFixed(6);
```

Package→file edges must be inserted into `fileEdges` BEFORE the `pagerank()` call. The `composerResult` is already available in `agentmap.mjs` build scope (wired in Phase 15, lines 750–754).

### Pattern 1: Adding Package→File Edges (CMP-04)

**What:** After TypeResolver block, before fileEdges loop, add directed edges from PHP source files to vendor package files.
**Key constraint:** `vendor/` files are excluded from `files{}` (line 661 excludes vendor from PHP discovery). Package→file edges should target the PACKAGE NAME as a node, not actual vendor file paths. Alternatively, edges can be added as source-file → package-name synthetic nodes that boost the package's nominal rank.

**Practical approach:** Since vendor files are not in `files{}`, the package→file edge concept works as a synthetic boost — create edges from PHP files that depend on a package back to a notional "package node". But `pagerank()` only ranks nodes in `nodes[]` (Object.keys(files)). So the real implementation must either:

1. **Option A (simpler):** Add a small weight boost to the PHP source file's own outgoing weight by adding self-referential synthetic edges — but this doesn't model the intent.
2. **Option B (correct per CONTEXT.md):** Add `packages` as synthetic nodes to `nodes[]` with edges from dependent PHP files to those nodes, giving packages their own PageRank score visible via `--packages --json`. But this changes the map.json shape significantly.
3. **Option C (pragmatic, matches SC-5 "subtle boost"):** Add edges from PHP source files to OTHER PHP source files that import from the same package — cross-file boost within the project graph. Not useful.
4. **Option D (most faithful to CONTEXT.md):** The 1000-edge cap and 0.1× weight suggest edges FROM package-dependent files TO all vendor files of that package. Since vendor files aren't in `files{}`, add vendor files as lightweight nodes just for PageRank, then exclude them from output. This is complex.

**Simplest correct interpretation:** The edges boost PHP source files that are depended upon by files that use a given package — i.e., edges flow from PHP files using a package TOWARD the package's main files (if any exist in the non-vendor project graph). Since the project has no vendor PHP files in the graph, the practical implementation is: for each `require`-type package edge in `composerResult.packages`, find PHP source files that `use` classes from that package namespace (via their importedSymbols or psr4Map), then add synthetic edges between them weighted at 0.1×.

**However**, the simplest valid implementation that satisfies SC-5 ("subtle boost") and avoids over-engineering: add package name as a lightweight synthetic node, add edges from all PHP files that depend on that package → package node, and include packages in `nodes[]`. This gives packages their own PageRank and makes them searchable in `--any`. [ASSUMED — exact semantics need implementation judgment per agent's discretion]

### Pattern 2: CLI Flag Registration

**What:** Add new flags to KNOWN set and VALUE_FLAGS set; add value-consuming flags to VALUE_FLAGS.
**Exact location:** Lines 1616–1628 in agentmap.mjs.

```javascript
// Source: agentmap.mjs lines 1616-1628 [VERIFIED: codebase read]
const KNOWN = new Set([
  "--json", "--print",
  "--help", "-h", "--version", "-v", "--install-hooks", "--hook-status",
  "--doctor", "--install-skill", "--platform", "--project", "--global",
  "--dry-run", "--setup-mcp", "--mcp",
  "--any", "--find", "--relates", "--map", "--focus", "--tokens",
  "--symbols", "--feature", "--features", "--hubs",
  // ADD: "--packages", "--types", "--legacy"
]);

const VALUE_FLAGS = new Set([
  "--any", "--find", "--relates", "--feature", "--focus", "--tokens", "--symbols", "--platform",
  // ADD: "--types" (takes file path or ClassName::method as value)
  // "--packages" and "--legacy" take no value (or optional)
]);
```

`--packages` and `--legacy` take no argument (like `--hubs`). `--types` takes an optional argument (file path or symbol). Use same pattern as `--symbols [n]` — check `arg("--types")` and handle undefined.

### Pattern 3: Handler Structure (matches all existing handlers)

```javascript
// Source: agentmap.mjs lines 1953-1959 pattern [VERIFIED: codebase read]
} else if (has("--packages")) {
  const data = ensureFresh();
  const pkgs = data.packages || [];
  out({ command: "packages", count: pkgs.length, packages: pkgs }, () => {
    console.log(`packages (${pkgs.length}):`);
    for (const p of pkgs) console.log(`  ${p.from} → ${p.to} [${p.type}] ${p.constraint}${p.resolvedVersion ? ` (${p.resolvedVersion})` : ""}`);
  });
}
```

### Pattern 4: --any Package Injection (CMP-05)

**Exact injection point:** Between the `if (fileKey)` block and the `else if (symHits.length || featNames.length)` block (lines 1765–1779). Package name lookup checks if query matches any `p.from`, `p.to`, or package name substring in `data.packages`.

```javascript
// After fileKey block, before symHits block — insert:
const pkgMatches = (data.packages || []).filter(p =>
  p.to.toLowerCase().includes(q) || p.from.toLowerCase().includes(q)
);
// Then surface pkgMatches in the output alongside symHits
```

Per CONTEXT.md: "package results appear after file matches, before symbol matches — low priority". So when `fileKey` is resolved, package matches are included in that response. When no file match, package matches appear before symbol matches.

### Pattern 5: --types Handler

`--types` with no arg → show all PHP files with their type counts.
`--types path/to/File.php` → show full type detail for that file.
`--types ClassName::method` → filter to matching method-level types.

Data available per PHP file entry: [VERIFIED: codebase read, lines 769-783]
- `entry.assignedTypes[]` — `{ variable, type, confidence, source }` objects
- `entry.phpDocTypes[]` — `{ tag, name, type }` objects  
- `entry.chainTypes[]` — chain-resolved types with `confidence: "LOW"`
- `entry.enhanced.types[]` — declared types with `confidence: "HIGH", source: "declared"`

Default output (HIGH+MEDIUM only per Phase 15 SC-4): filter out LOW confidence unless `--all` flag present.

### Pattern 6: --legacy Handler

Data available: `data.legacyWarnings[]` — each has `{ type, directory?, entry?, message }`. [VERIFIED: codebase read LegacyDetector.mjs]

Types present:
- `"legacy-dir"` — heuristic directory detection; has `directory` field
- `"classmap"` — classmap autoload entry; has `entry` field
- `"autoload-file"` — files autoload entry; has `entry` field

PSR-4 suggestion for `legacy-dir` type: suggest `"namespace\\Prefix\\": "directory/"` — agent's discretion on namespace guessing heuristic.

### Pattern 7: SCHEMA_VERSION Bump

Single-line change in `src/Core/constants.mjs` line 3: [VERIFIED: codebase read]
```javascript
export const SCHEMA_VERSION = 3;  // → 4
```

`ensureFresh()` detects schema mismatch and triggers rebuild automatically. No other code change needed.

### Recommended Project Structure (no changes needed)
```
agentmap.mjs          — CLI entry: add --packages/--types/--legacy handlers + --any injection
src/Core/
  constants.mjs       — SCHEMA_VERSION 3 → 4
  map-builder.mjs     — NO CHANGES (JS/TS only; PHP+pagerank in agentmap.mjs)
  ComposerParser.mjs  — NO CHANGES (already complete)
  LegacyDetector.mjs  — NO CHANGES (already complete)
  TypeResolver.mjs    — NO CHANGES (already complete)
test/
  packages-cli.test.mjs    — new: --packages flag tests
  types-cli.test.mjs       — new: --types flag tests
  legacy-cli.test.mjs      — new: --legacy flag tests
  any-packages.test.mjs    — new: --any package routing test
```

### Anti-Patterns to Avoid

- **Putting pagerank edge merging in map-builder.mjs:** PHP files are NOT in `files{}` inside map-builder.mjs build(). That function only processes JS/TS. The correct location is agentmap.mjs build() after the TypeResolver block, before line 800. [VERIFIED: Phase 14 SUMMARY.md + codebase read]
- **Adding `--types` as a boolean flag:** It needs a value (file path or symbol) — must be in VALUE_FLAGS so `arg("--types")` works correctly. Handle undefined the same as `--symbols [n]`.
- **Forgetting `--types` in VALUE_FLAGS:** The unknown-flag guard (line 1743) uses `valueIdx` to exclude value positions. Without VALUE_FLAGS registration, `--types src/Foo.php` treats `src/Foo.php` as an unknown flag.
- **Vendor files in pagerank nodes:** `vendor/` is excluded from PHP discovery (line 661). Any package→file edge scheme must not assume vendor files exist in `files{}`.
- **Emitting prose in --json mode:** All handlers must use `out(jsonObj, prosePrinter)` — never `console.log()` directly. [VERIFIED: codebase pattern]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON output toggle | custom json mode | `out(obj, prose)` pattern + `wantJson` | Already wired at line 1611; consistent with all commands |
| Map freshness check | custom cache logic | `ensureFresh()` | Already handles schema mismatch, sha check, fingerprint |
| Flag value extraction | manual argv parsing | `arg("--flag")` + `has("--flag")` | Already handles `--flag --other-flag` edge case (returns undefined) |
| Schema-triggered rebuild | manual rebuild call | `SCHEMA_VERSION` bump in constants.mjs | `ensureFresh()` detects mismatch and calls `build()` automatically |
| Package data | custom parser | `data.packages` from `ensureFresh()` | Already in map.json from Phase 13 |
| Legacy warning data | custom detector | `data.legacyWarnings` from `ensureFresh()` | Already in map.json from Phase 13 |
| Type data per file | custom resolver | `entry.assignedTypes/phpDocTypes/chainTypes/enhanced.types` | Already in map.json from Phases 14-15 |

## Common Pitfalls

### Pitfall 1: Wrong PageRank Integration Point
**What goes wrong:** CMP-04 edges added in map-builder.mjs build() but PHP files aren't there — zero PHP→package edges get created.
**Why it happens:** CONTEXT.md says "map-builder.mjs" but Phase 14 discovered the actual correct location is agentmap.mjs. map-builder.mjs only builds the JS/TS graph.
**How to avoid:** Insert package→file edges in agentmap.mjs AFTER the TypeResolver block (line ~784) and BEFORE the fileEdges loop (line ~800). `composerResult` is already in scope (lines 750–754).
**Warning signs:** `--packages --json` shows packages but their pagerank is 0 or equal to dangling-node baseline.

### Pitfall 2: --types Missing from VALUE_FLAGS
**What goes wrong:** `--types src/Foo.php` causes exit 2 "unknown flag: src/Foo.php" because the value position isn't registered.
**Why it happens:** VALUE_FLAGS controls which argv positions are exempt from the unknown-flag guard.
**How to avoid:** Add `"--types"` to VALUE_FLAGS at line 1628.
**Warning signs:** `node agentmap.mjs --types src/Foo.php` exits 2 with "unknown flag: src/Foo.php".

### Pitfall 3: --any Package Injection Order
**What goes wrong:** Package matches shown after symbol matches instead of before — violates CONTEXT.md order requirement.
**Why it happens:** Injecting package lookup after the symHits block rather than before it.
**How to avoid:** Compute `pkgMatches` before the `if (fileKey)` check; surface in both the file-match branch (as extra field) AND the no-file-match branch before symbol hits.
**Warning signs:** `--any laravel/framework` shows symbols before packages.

### Pitfall 4: PageRank Edge Explosion
**What goes wrong:** Every PHP file gets edges to every file of every package it uses — potentially millions of edges on large projects.
**Why it happens:** Uncapped edge generation across many packages with many files each.
**How to avoid:** Cap at 1000 edges per package dependency (truncate alphabetically + warn to stderr). This is a locked decision from CONTEXT.md.
**Warning signs:** Build time grows from ~200ms to tens of seconds.

### Pitfall 5: Legacy PSR-4 Suggestion Complexity
**What goes wrong:** Attempting to generate accurate namespace suggestions requires knowing the root namespace — not always inferable from composer.json.
**Why it happens:** PSR-4 namespace prefix is arbitrary (e.g., `App\`, `MyProject\`) — can't be guessed from directory name.
**How to avoid:** For `legacy-dir` warnings, suggest format `"YourNamespace\\": "directory/"` with a placeholder, or skip suggestion if no psr4Map entries exist to infer from. Agent's discretion per CONTEXT.md.
**Warning signs:** Tests fail because suggested namespace doesn't match any real namespace.

### Pitfall 6: Confidence Filtering in --types
**What goes wrong:** All LOW confidence chain types shown by default, overwhelming output with speculative inferences.
**Why it happens:** Not filtering by confidence level.
**How to avoid:** Default to HIGH+MEDIUM only. LOW confidence types appear only if `--all` flag is present (Phase 15 SC-4 established this contract). Check `has("--all")` within the --types handler.
**Warning signs:** `--types` output contains dozens of LOW-confidence chain entries for simple files.

## Code Examples

### Exact data shapes already in map.json (verified via codebase read)

#### data.packages (from ComposerParser, Phase 13)
```javascript
// Source: src/Core/ComposerParser.mjs lines 25-48 [VERIFIED: codebase read]
// Each entry:
{ from: "vendor/name", to: "other/package", type: "require", constraint: "^1.0", resolvedVersion: "1.2.3" }
// type values: "require" | "require-dev" | "conflict" | "replace" | "provide" | "suggest"
```

#### data.legacyWarnings (from LegacyDetector, Phase 13)
```javascript
// Source: src/Core/LegacyDetector.mjs lines 34-52 [VERIFIED: codebase read]
{ type: "legacy-dir",    directory: "classes/", message: "Directory 'classes/' exists but is not registered as a PSR-4 namespace prefix" }
{ type: "classmap",      entry: "path/to/file.php", message: "classmap entry: path/to/file.php" }
{ type: "autoload-file", entry: "bootstrap/helpers.php", message: "autoload.files entry: bootstrap/helpers.php" }
```

#### PHP file entry type data (from TypeResolver, Phases 14-15)
```javascript
// Source: agentmap.mjs lines 769-783 [VERIFIED: codebase read]
entry.assignedTypes  // [{ variable, type, confidence: "MEDIUM", source: "assigned"|"new"|"static-call" }]
entry.phpDocTypes    // [{ tag: "@var"|"@return"|"@param"|"@property", name, type }]
entry.chainTypes     // [{ variable, type, confidence: "LOW", source: "chain" }]
entry.enhanced.types // [{ name, type, confidence: "HIGH", source: "declared" }]  (after Phase 15 backfill)
```

#### pagerank() signature (from graph.mjs)
```javascript
// Source: src/Core/graph.mjs lines 3-13 [VERIFIED: codebase read]
pagerank(nodes, edges, { personalization, damping, tol, maxIter } = {})
// edges: [{ from: string, to: string, weight: number }]
// nodes: string[] — must include all nodes referenced in edges
// returns: { [nodePath]: number }
```

#### out() + wantJson pattern (from agentmap.mjs)
```javascript
// Source: agentmap.mjs line 1611 [VERIFIED: codebase read]
const wantJson = has("--json");
const out = (obj, prose) => { if (wantJson) console.log(JSON.stringify(obj)); else prose(); };
// Usage:
out({ command: "packages", packages: [...] }, () => { console.log("packages:"); ... });
```

#### Full handler placement template
```javascript
// Source: agentmap.mjs lines 1953-1959 --hubs pattern [VERIFIED: codebase read]
} else if (has("--packages")) {
  const data = ensureFresh();
  // ...handler code...
} else if (has("--types")) {
  // ...
} else if (has("--legacy")) {
  // ...
}
// These go BEFORE the unknown-flag guard at line 1743 but AFTER --hook-status at line 1717
// Correct position: after existing command handlers, before --print and bare-build fallthrough
```

#### Test pattern (black-box subprocess)
```javascript
// Source: test/helpers.mjs + test/json.test.mjs [VERIFIED: codebase read]
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRepo, gitInit, run, cleanup } from "./helpers.mjs";

test("--packages emits package list", () => {
  const dir = makeRepo({
    "composer.json": JSON.stringify({
      name: "test/project",
      require: { "laravel/framework": "^10.0" }
    }),
    "src/Foo.php": "<?php\nclass Foo {}"
  });
  gitInit(dir, { commit: true });
  const r = run(dir, "--packages");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /laravel\/framework/);
  cleanup(dir);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| map.json schema v3 (no packages/types/legacy keys) | schema v4 (packages, legacyWarnings, assignedTypes, phpDocTypes, chainTypes) | Phase 16 | Auto-rebuild on first run after upgrade |
| No composer awareness in CLI | --packages flag + --any package routing | Phase 16 | Developers can query package graph directly |
| No PHP type visibility in CLI | --types flag with confidence filtering | Phase 16 | AI agents can inspect resolved types per file |
| No legacy code detection in CLI | --legacy flag with PSR-4 suggestions | Phase 16 | Hybrid codebase developers get actionable legacy warnings |

**Note:** `packages` and `legacyWarnings` keys are already present in map.json (added Phase 13). `assignedTypes/phpDocTypes/chainTypes` added Phases 14-15. Schema v4 is purely a signal to `ensureFresh()` to rebuild — not a data shape change.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Package→file edges target synthetic package nodes (not actual vendor files) because vendor/ is excluded from files{} | Architecture Patterns Pitfall 1 | If vendor files must be in graph, implementation complexity increases significantly |
| A2 | --types with no argument shows all PHP files with type count summary | Architecture Patterns Pattern 5 | If per-file detail is expected for all files, output becomes extremely verbose |
| A3 | PSR-4 suggestion uses placeholder namespace when root namespace can't be inferred | Common Pitfalls Pitfall 5 | If accurate suggestions are expected, additional composer.json parsing needed |

## Open Questions

1. **Package→file edge semantics for CMP-04**
   - What we know: vendor/ files excluded from files{}, so real vendor file paths can't be edge targets
   - What's unclear: Should packages be added as synthetic nodes to the PageRank graph, or should edges boost source files differently?
   - Recommendation: Add package names as synthetic nodes in `nodes[]`; add edges from each PHP source file that has a `require`-type dependency toward that package node; weight = 0.1× average direct import weight; cap at 1000 edges per package. This gives packages their own PageRank score usable in `--packages --json` and `--any` routing.

2. **--any package injection when fileKey matches**
   - What we know: CONTEXT.md says "package results appear after file matches" — ambiguous whether "after" means in same response or only when no file match
   - What's unclear: Should package matches appear alongside a file match, or only replace it?
   - Recommendation: Include package matches in all branches — as an additional field in the file-match JSON, and as a leading section before symbols in the no-file branch.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node:test | test runner | ✓ | built-in (Node 18+) | — |
| npm test script | test execution | ✓ | `node --test test/*.test.mjs test/**/*.test.mjs` | — |
| composer.json | CMP-04/05 data | optional | project-specific | graceful empty result (already implemented) |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in) |
| Config file | none — invoked directly |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMP-04 | Package→file edges appear in PageRank output | integration | `npm test` | ❌ Wave 0 |
| CMP-05 | --packages shows package graph in text + JSON | integration | `npm test` | ❌ Wave 0 |
| CMP-05 | --any with package name returns package results | integration | `npm test` | ❌ Wave 0 |
| TYP-05 | --types shows type info per file | integration | `npm test` | ❌ Wave 0 |
| TYP-05 | --types ClassName::method filters to symbol | integration | `npm test` | ❌ Wave 0 |
| LEG-03 | --legacy shows non-PSR-4 files and dirs | integration | `npm test` | ❌ Wave 0 |
| — | All existing 216+ tests remain green | regression | `npm test` | ✅ existing suite |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `test/packages-cli.test.mjs` — covers CMP-05 (--packages text + JSON + --any routing)
- [ ] `test/types-cli.test.mjs` — covers TYP-05 (--types per-file + symbol filter + confidence)
- [ ] `test/legacy-cli.test.mjs` — covers LEG-03 (--legacy text + JSON output)
- [ ] `test/pagerank-packages.test.mjs` — covers CMP-04 (package edges affect pagerank scores)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | `arg()` already rejects `--`-prefixed values; KNOWN set rejects unknown flags |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Flag injection via query string | Tampering | `arg()` returns undefined for `--`-prefixed values; already implemented |
| Path traversal via --types arg | Tampering | ensureFresh() reads pre-built map.json; --types reads from data not filesystem |
| Unknown flag as command | Elevation of privilege | KNOWN set guard at line 1743; already implemented |

## Sources

### Primary (HIGH confidence)
- agentmap.mjs — direct codebase read: KNOWN set (line 1616), VALUE_FLAGS (line 1628), --any router (1748-1800), build() PHP block (653-784), fileEdges+pagerank (800-806), out() pattern (1611)
- src/Core/constants.mjs — direct codebase read: SCHEMA_VERSION=3 at line 3
- src/Core/graph.mjs — direct codebase read: pagerank() signature lines 3-13
- src/Core/map-builder.mjs — direct codebase read: build() function, packages/legacyWarnings in out object (lines 345-363)
- src/Core/ComposerParser.mjs — direct codebase read: parse() return shape {packages, psr4Map, classmaps, autoFiles}
- src/Core/LegacyDetector.mjs — direct codebase read: detect() return shape [{type, directory?, entry?, message}]
- test/helpers.mjs — direct codebase read: run() pattern, makeRepo(), gitInit()
- .planning/phases/14-php-type-resolution-mvp/14-02-SUMMARY.md — confirmed TypeResolver in agentmap.mjs not map-builder.mjs
- .planning/phases/15-advanced-type-resolution/15-02-SUMMARY.md — confirmed chainTypes wiring and agentmap.mjs build() scope

### Secondary (MEDIUM confidence)
- .planning/phases/16-integration-cli/16-CONTEXT.md — user decisions and locked implementation choices
- .planning/REQUIREMENTS.md — requirement IDs and acceptance criteria

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing modules verified by codebase read
- Architecture: HIGH — all integration points verified by direct source reading; one ASSUMED claim on edge semantics
- Pitfalls: HIGH — Pitfall 1 verified by Phase 14 SUMMARY.md; others derived from direct code reading

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (stable codebase, no external dependencies)


