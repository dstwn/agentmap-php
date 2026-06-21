# Architecture Patterns: Composer Graph + PHP Type Resolution

**Domain:** PHP code-map tooling — agentmap-php v1.2
**Researched:** 2026-06-21

---

## Extended Architecture Overview

The v1.2 features add three new modules to `src/Core/` while extending two existing modules. The core file-level graph architecture (build pipeline, PageRank, caching, CLI dispatch) remains unchanged.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLI Layer (agentmap.mjs → cli.mjs)                  │
│  Existing: --any --find --relates --map --hubs --symbols --print --features  │
│  NEW:      --packages [--json] --dependencies <pkg> [--dev] [--json]         │
│  ENHANCED: --relates (now also queries package names, shows package edges)    │
│  ENHANCED: --doctor (adds legacy code checks, content-hash staleness)         │
└────────────────────────────────┬──────────────────────────────────────────────┘
                                 │ queries map.json
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Cached Map Layer (map.json v3 + extensions)         │
│                                                                               │
│  Existing: schema, files, edges, pagerank, hubs, features, rankedSymbols      │
│  NEW:      packages, packageEdges, types, legacy                               │
│                                                                               │
│  Fingerprint now includes: composer.json + composer.lock hashes                │
└──────────────────────────────────┬────────────────────────────────────────────┘
                                   │ ensureFresh() → build() on stale/dirty
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Orchestrator (src/Core/map-builder.mjs)              │
│                                                                               │
│  Existing flow:                                                               │
│    makeProject() → build() → pagerank() → rankSymbols() → write map.json      │
│                                                                               │
│  v1.2 enhanced flow:                                                          │
│    makeProject() → build() → buildPackageGraph() → pagerank() →               │
│    rankSymbols() → resolveTypes() → detectLegacy() → write map.json            │
│                                                                               │
│  buildPackageGraph(): added after file graph, before PageRank                  │
│  resolveTypes():     runs after symbol ranking, before persist                 │
│  detectLegacy():     runs last, diagnostic only                                │
└────┬──────────────────────┬──────────────────────┬───────────────────────────┘
     │                      │                      │
     ▼                      ▼                      ▼
┌──────────────┐   ┌──────────────┐   ┌─────────────────────────┐
│ PackageGraph │   │ TypeResolver │   │ LegacyDetector          │
│ Resolver     │   │              │   │                         │
│              │   │ - PHPDoc     │   │ - Classmap scanner      │
│ - composer   │   │   parser     │   │ - PSR-4 compliance chk  │
│   .json parse│   │ - Assignmt   │   │ - Fallback dir scan     │
│ - composer   │   │   tracking   │   │ - Doctor warnings        │
│   .lock parse│   │ - Return     │   │                         │
│ - Edge model │   │   chaining   │   └─────────────────────────┘
│ - Version    │   │ - Local prop │
│   constraint │   └──────────────┘
│ - Mermaid/DOT│
└──────────────┘
```

## New Component Boundaries

### PackageGraphResolver (`src/Core/PackageGraphResolver.mjs`)

| Responsibility | Communicates With |
|---------------|-------------------|
| Parse `composer.json` (require, require-dev, conflict, replace, provide, suggest) | map-builder.mjs (called from build()) |
| Parse `composer.lock` (resolved versions, package metadata) | map.json (writes `packages` + `packageEdges`) |
| Build typed edge list for package graph | CLI layer (via `--packages`, `--dependencies`) |
| Compute content-hash for staleness detection | cache.mjs (fingerprint includes hash) |
| Format output (text tree, JSON, Mermaid, DOT) | CLI layer (format dispatch) |

**Key interfaces:**

```javascript
export class PackageGraphResolver {
  constructor(projectRoot) {}

  /** Parse composer.json and composer.lock, build package graph */
  resolve() {
    // Returns { packages: {...}, packageEdges: [...], contentHash: "..." }
  }

  /** Get direct dependencies of --root or a specified package */
  getDependencies(packageName, { includeDev = false, depth = Infinity }) {}

  /** Get reverse dependencies (what depends on this package?) */
  getDependents(packageName) {}

  /** Format as ASCII tree */
  formatTree(edges) {}

  /** Format as JSON for --json output */
  formatJson(packages, edges) {}

  /** Format as Mermaid graph */
  formatMermaid(packages, edges) {}
}
```

**Data model note:** `__root__` is a synthetic package name representing the project itself (the root package has no version). All root `require` edges originate from `__root__`.

### PhpDocParser (`src/Core/PhpDocParser.mjs`)

| Responsibility | Communicates With |
|---------------|-------------------|
| Extract PHPDoc comments from source text (tree-sitter strips them) | TypeResolver.mjs (called during type resolution) |
| Parse `@var`, `@return`, `@param`, `@method`, `@property` annotations | — |
| Match docblocks to AST positions (adjacent line heuristic) | — |

**Why separate:** PHPDoc parsing is a self-contained concern with a single input (source text + line number hints) and single output (structured annotations). Extracting it as its own module makes it testable in isolation and replaceable (could switch to a full DocParser later).

**Implementation approach:**
- Step 1: Extract all `/** ... */` blocks from source text using regex
- Step 2: For each block, record its end line number
- Step 3: For each AST declaration node (method, property, class, function), find the nearest docblock ending 1-2 lines above it
- Step 4: Parse the docblock content for known annotations

```javascript
export class PhpDocParser {
  /** Extract all docblocks from source text, matched to line numbers */
  extractDocblocks(sourceText) {
    // Returns [{ startLine, endLine, text }]
  }

  /** Find docblock immediately preceding a given line */
  findDocblockAtLine(docblocks, targetLine) {}

  /** Parse annotations from a docblock text */
  parseAnnotations(docblockText) {
    // Returns { var: [...], return: [...], param: [...], method: [...], property: [...] }
  }

  /** Parse a single @var annotation: "@var Type $name" → { type: "Type", name: "$name" } */
  parseVarAnnotation(line) {}

  /** Parse @return: "@return Type" → { type: "Type" } */
  parseReturnAnnotation(line) {}

  /** Parse @param: "@param Type $name description" → { type: "Type", name: "$name" } */
  parseParamAnnotation(line) {}

  /** Parse @method/@property for class-level annotations */
  parseMethodPropertyAnnotation(line) {}
}
```

### TypeResolver (`src/Core/TypeResolver.mjs`)

| Responsibility | Communicates With |
|---------------|-------------------|
| Track variable types through assignments within a single file | PhpParser.mjs / EnhancedLaravelParser.mjs (receives AST) |
| Resolve return types through simple method chains | PhpDocParser.mjs (for PHPDoc annotations) |
| Store per-file type information for map output | map.json (writes `types`) |

**Implementation approach:**
- Per-file analysis (no cross-file state)
- Maintain a map of `variableName → { type, source, confidence }` while walking the AST
- On each `assignment_expression`:
  - If RHS is `object_creation_expression` → type is the created class name
  - If RHS is `variable_name` → type is whatever the LHS variable tracked to
  - If RHS is `function_call_expression` or `member_call_expression` → type is the declared return type (or PHPDoc @return)
- Type resolution is best-effort — unresolved types remain `null`/`mixed`

```javascript
export class TypeResolver {
  constructor(phpDocParser) {}

  /**
   * Resolve types within a single PHP file.
   * @param {string} filePath
   * @param {string} sourceText
   * @param {object} ast - tree-sitter AST root node
   * @param {object} exports - from PhpParser.extractExports()
   * @returns {object[]} type information entries
   */
  resolveFile(filePath, sourceText, ast, exports) {
    // Returns [{ name, type, source, line }]
  }

  /**
   * Track variable assignments in a scope.
   * Internal state: Map<variableName, TypeInfo>
   */
  _trackAssignments(scopeNode, docblocks) {}

  /**
   * Resolve a type expression (qualified name, primitive, union).
   */
  _resolveTypeNode(typeNode) {}
}
```

**Interaction with existing code:** `EnhancedLaravelParser.inferTypes()` already returns declared types (Level 0). `TypeResolver` handles Level 1-2 (assignment tracking + PHPDoc). The two outputs are merged: declared types are the "base", and resolver types augment or refine them.

### LegacyDetector (`src/Core/LegacyDetector.mjs`)

| Responsibility | Communicates With |
|---------------|-------------------|
| Read `composer.json `autoload.classmap` entries | map-builder.mjs (called from build()) |
| Scan classmap directories for PHP files, extract class names | — |
| Detect files in PSR-4 directories that violate namespace conventions | — |
| Fallback directory scanning when no PSR-4 config exists | — |
| Generate diagnostic warnings for `--doctor` | CLI doctor |

```javascript
export class LegacyDetector {
  constructor(projectRoot) {}

  /** Main detection pass */
  detect(composerJson, phpFiles) {
    // Returns { nonPsr4: [...], classmapFiles: [...], fallbackDirs: [...], warnings: [...] }
  }

  /** Read autoload.classmap entries and discover files */
  scanClassmapDirs(classmapEntries) {}

  /** Check PSR-4 compliance: does each PHP file's class match its namespace? */
  checkPsr4Compliance(phpFiles, psr4Prefixes) {}

  /** Fallback: scan common dirs when no PSR-4 */
  scanFallbackDirs() {}
}
```

## Extended Data Flow

### Package Graph Data Flow

```
1. build() called (from ensureFresh() or --no-cache)
2. makeProject() — existing TS/JS parsing (unchanged)
3. Existing build() loop — process SourceFiles, build file graph (unchanged)
4. NEW: const packageResolver = new PackageGraphResolver(projectRoot)
5. const { packages, packageEdges, contentHash } = packageResolver.resolve()
6. const fileRank = pagerank(nodes, fileEdges) — existing, unchanged
7. Write map.json with new keys:
   {
     ...existing,  // schema, files, fileEdges, pagerank, hubs, features, rankedSymbols
     packages,     // NEW
     packageEdges, // NEW
     types: {},    // from TypeResolver (Phase 2)
     legacy: {},   // from LegacyDetector (Phase 3)
   }
8. fingerprint now includes: git SHA + file hashes + composer.json hash + composer.lock hash
```

### Type Resolution Data Flow

```
1. After file graph is built (or during file parse in Phase 2)
2. For each PHP file:
   a. Read source text
   b. const docblocks = phpDocParser.extractDocblocks(sourceText)
   c. Walk AST for assignments, method declarations, property declarations
   d. const types = typeResolver.resolveFile(filePath, sourceText, ast, exports)
   e. types.push(...enhancedLaravelParser.inferTypes(filePath, ast))  // Level 0
3. Merge per-file types into top-level types map
4. Write to map.json.types
```

### Legacy Detection Data Flow

```
1. After file graph is built
2. Read composer.json autoload config
3. For each PSR-4 prefix→dir: verify detected classes match expected namespace
4. For each classmap dir: scan .php files, extract classes
5. If no PSR-4 config: scan fallback dirs
6. Generate warnings array
7. Write to map.json.legacy
```

## Schema Evolutions

### map.json: packages entry

```json
{
  "packages": {
    "monolog/monolog": {
      "version": "2.9.1",
      "constraint": "^2.0",
      "type": "library",
      "description": "Logging for PHP",
      "isDev": false,
      "license": ["MIT"],
      "stability": "stable"
    }
  }
}
```

### map.json: packageEdges entry

```json
{
  "packageEdges": [
    {
      "from": "__root__",
      "to": "monolog/monolog",
      "type": "depends-on",
      "constraint": "^2.0",
      "resolved": "2.9.1"
    },
    {
      "from": "__root__",
      "to": "phpunit/phpunit",
      "type": "dev-depends-on",
      "constraint": "^10.0",
      "resolved": "10.5.0"
    }
  ]
}
```

### map.json: fingerprint extension

```json
{
  "fingerprint": {
    "sha": "abc1234",
    "fileHashes": { "src/User.php": "sha256hex..." },
    "composerJsonHash": "md5hex...",
    "composerLockHash": "md5hex..."
  }
}
```

## Pattern: Package Resolver (Strategy)

The `PackageGraphResolver` reads from filesystem and is stateless — it can be called on-demand without needing the full build pipeline. This enables a fast `--packages` path that skips the expensive file-parsing build:

```javascript
// Fast path: --packages without --no-cache
//   1. Read cached map.json
//   2. If packages exist and content-hash matches → display cached
//   3. Else: run PackageGraphResolver standalone (cheap), no full build

// Full path: --no-cache or stale
//   1. Full build() runs
//   2. PackageGraphResolver runs as part of build
```

## Constants File Additions

```javascript
// src/Core/constants.mjs additions:
export const PACKAGE_RELEVANT_KEYS = [
  'name', 'version', 'require', 'require-dev', 'conflict',
  'replace', 'provide', 'minimum-stability', 'prefer-stable',
  'repositories', 'extra',
];
export const PACKAGE_EDGE_TYPES = ['depends-on', 'dev-depends-on', 'conflicts', 'replaces', 'provides', 'suggests'];
export const LEGACY_FALLBACK_DIRS = ['src/', 'lib/', 'classes/', 'app/', 'includes/'];
```

## Exclusion Patterns

| Pattern | New Feature Application |
|---------|------------------------|
| `vendor/` exclusion (existing for `node_modules/`) | Package graph reads from composer.* (not vendor/). Vendor file scanning for classmap is opt-in via `--with-vendor`. |
| `node_modules/` exclusion (existing) | Unchanged |
| `.git/` exclusion (existing) | Unchanged |
| `vendor/` exclusion in classmap scanning | Classmap scanning in vendor/ is disabled by default. Users can opt in with `--with-vendor` on the `--legacy` flag. |

## Compatibility Guarantees

| Concern | Guarantee |
|---------|-----------|
| Existing CLI flags | All unchanged — same behavior, output, exit codes |
| map.json schema v3 | Existing `files`/`edges` keys unchanged. New keys are additive. |
| MCP tools | Existing 6 tools unchanged. May add new tools for package graph in a later phase. |
| Build performance | Package graph adds <50ms to build. Type resolution adds <200ms for typical projects. Legacy detection adds <100ms. |
| Node.js compatibility | All new modules use ESM (.mjs). No new native dependencies. |
