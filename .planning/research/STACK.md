# agentmap-php: Technology Stack Research

**Researched:** 2026-06-19  
**Domain:** PHP static analysis, AST parsing, tree-sitter integration  
**Confidence:** HIGH

## Summary

agentmap-php extends the existing agentmap (Node.js CLI, v0.9.0) to support PHP and Laravel codebases alongside its existing TypeScript/JavaScript support. The core technical challenge is replacing `ts-morph` (TypeScript compiler wrapper) as the parsing engine for PHP files, instead using **tree-sitter** with the **tree-sitter-php** grammar.

The `tree-sitter` npm package (v0.25.0) provides native Node.js bindings (C++ addon) with a synchronous, lightweight API for parsing source files into ASTs. The `tree-sitter-php` grammar (v0.24.2) is mature, community-maintained, and ships with WebAssembly builds plus prebuilt native binaries. agentmap's monolith (`agentmap.mjs`, ~1831 lines) needs decomposition to support a dual-engine architecture: `ts-morph` for TS/JS, tree-sitter for PHP.

**Primary recommendation:** Use `tree-sitter` npm package (NOT `web-tree-sitter`) with `tree-sitter-php` grammar. Decompose agentmap into modular architecture with language-specific backends behind a common interface. The `src/` directory is already scaffolded and empty — use it.

**Phases required (top-down):**
1. **Parser abstraction layer** — Define common file/symbol/edge interface, separate from CLI
2. **tree-sitter PHP module** — Language parser, AST walker for PHP constructs  
3. **Laravel-aware analysis** — Facades, Eloquent, routes, service providers
4. **Mixed-project support** — TS/JS + PHP files in same repo
5. **Integration** — Wire into build(), CLI, MCP, tests

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PHP file parsing/AST | Core parser module | `src/Core/PHPParser.mjs` | Encapsulated entity; CLI layer calls it via build() |
| PHP import resolution | Core parser module | `src/Core/PHPParser.mjs` | Part of the same parser — resolve `use` → file graph |
| Symbol ranking (shared) | Core algorithm | `src/Core/ranker.mjs` | PageRank + identifier ranking is language-agnostic; extract from monolith |
| CLI dispatch | CLI layer | `agentmap.mjs` | Flags, routing, output format unchanged |
| MCP tools | MCP layer | `mcp.mjs` | Stateless, queries cached map — unchanged for consumers |
| Laravel facade resolution | PHP analysis module | `src/Core/PHPAnalyzer.mjs` | Knowledge of Laravel patterns; combines namespace map with known facade classes |
| Mixed-project merging | Orchestration | `src/Core/build.mjs` | Merges TS/JS graph with PHP graph before PageRank |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tree-sitter` | `^0.25.0` | Incremental parser for Node.js — native bindings, sync API, correct by default | Official Node.js binding from the tree-sitter project; mature, maintained, used by hundreds of projects [CITED: github.com/tree-sitter/node-tree-sitter] |
| `tree-sitter-php` | `^0.24.2` | PHP grammar for tree-sitter — parses PHP 5–8.x, rich AST with 135+ named node types | Official PHP grammar from tree-sitter org; used by GitHub's syntax highlighting, many editors [CITED: npmjs.com/package/tree-sitter-php] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `web-tree-sitter` | `^0.26.9` | WASM-based tree-sitter for browser/edge workers | NOT recommended for this CLI tool — WASM loading overhead, async API, extra complexity for no benefit over native bindings |
| `tree-sitter-cli` | `^0.25.5` | CLI tool to generate/rebuild grammar files | Only needed for dev/CI — regenerating parser.c from grammar.js, building WASM |
| `composer.json` (Composer) | — | PHP dependency manager; autoload PSR-4 config | Optional but useful for detecting PSR-4 namespace-to-directory mappings in Laravel projects |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tree-sitter` npm addon | `tree-sitter/wasm` via `web-tree-sitter` | WASM is 2-5x slower startup, requires async init, harder to bundle. Native addon is correct for CLI tooling. |
| `tree-sitter` | Custom regex-based parser | Regex parsing of PHP is fragile, misses nested constructs, can't handle heredocs/string interpolation. tree-sitter is exponentially more robust. |
| `tree-sitter` | `php-parser` npm (glayzzle/php-parser) | glayzzle/php-parser is pure JS, 3x slower, less maintained, no incremental parsing. tree-sitter is faster and the industry standard. |
| `tree-sitter` | Spawn PHP process with `token_get_all()` | Massive overhead per-file, shell injection risk, fragile output parsing. Not viable for large repos. |

**Installation:**
```bash
npm install tree-sitter@^0.25.0 tree-sitter-php@^0.24.2
npm install --save-dev tree-sitter-cli@^0.25.5
```

**Version verification:**
```
npm view tree-sitter version      # → 0.25.0
npm view tree-sitter-php version  # → 0.24.2
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `tree-sitter` | npm | ~8 yrs | ~300K/wk | github.com/tree-sitter/node-tree-sitter | OK | Approved |
| `tree-sitter-php` | npm | ~5 yrs | ~20K/wk | github.com/tree-sitter/tree-sitter-php | OK | Approved |

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none  

---

## Architecture Patterns

### System Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                     CLI Layer (agentmap.mjs / mcp.mjs)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ --map    │ │ --any    │ │--find    │ │--relates │ │ doctor   │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│       │            │            │             │            │         │
│       └────────────┴────────────┴─────────────┴────────────┘         │
│                              │                                       │
│                              ▼                                       │
└──────────────────────────────┼───────────────────────────────────────┘
                               │ queries map.json
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   Cached Map Layer (map.json)                        │
│  files, edges, rank, hubs, rankedSymbols, features, fingerprint     │
└──────────────────────────┬───────────────────────────────────────────┘
                           │ ensureFresh() → build() on stale/dirty
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Orchestrator (src/Core/build.mjs)               │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────┐   │
│  │ TS/JS Parser   │  │  PHP Parser    │  │  Graph Merger        │   │
│  │ (ts-morph)     │  │ (tree-sitter)  │  │  edges + nodes from  │   │
│  │                │  │                │  │  both languages      │   │
│  └───────┬────────┘  └───────┬────────┘  └──────────┬───────────┘   │
│          │                   │                       │               │
│          ▼                   ▼                       ▼               │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │              Shared Algorithm Layer                         │      │
│  │  ┌──────────┐  ┌────────────┐  ┌───────────────────────┐  │      │
│  │  │ PageRank  │  │ Symbol     │  │ Digest Builder        │  │      │
│  │  │ (hub det) │  │ Ranking    │  │ (token-budgeted map)  │  │      │
│  │  └──────────┘  └────────────┘  └───────────────────────┘  │      │
│  └────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── Core/
│   ├── build.mjs            # Orchestrator: ensureFresh → build → persist
│   ├── parser.mjs           # Abstract file parser interface
│   ├── TSParser.mjs         # ts-morph wrapper (extracted from agentmap.mjs)
│   ├── PHPParser.mjs        # tree-sitter PHP wrapper (new)
│   ├── PHPAnalyzer.mjs      # Laravel-aware analysis (facades, routes, etc.)
│   ├── graph.mjs            # Graph data structures + edge construction
│   ├── pagerank.mjs         # PageRank algorithm (extracted from agentmap.mjs)
│   ├── symbolRanker.mjs     # Aider-style symbol ranking (extracted)
│   ├── digester.mjs         # Token-budgeted map digest (extracted)
│   └── utils.mjs            # Shared utilities (path resolution, etc.)
├── Commands/
│   ├── map.mjs              # --map command handler
│   ├── any.mjs              # --any router handler
│   ├── find.mjs             # --find handler
│   ├── relates.mjs          # --relates handler
│   └── doctor.mjs           # Doctor health report
├── Hooks/
│   ├── install.mjs          # Hook installation logic
│   └── nudge.mjs            # PreToolUse nudge hook
├── Mcp/
│   └── server.mjs           # MCP server logic (extracted from mcp.mjs)
└── Skills/
    └── installer.mjs        # Skill installation logic
```

### Pattern 1: Parser Adapter (Strategy Pattern)

**What:** Language-specific parsers implement a common interface so the orchestrator treats all files uniformly regardless of language.

**Example interface (src/Core/parser.mjs):**
```javascript
// Each parser implements (for its own language):
class FileParser {
  /** @returns {boolean} - true if this parser handles the given file path */
  canHandle(filePath) { }

  /**
   * Parse a file string into structured file metadata.
   * @param {string} filePath - Absolute path to the file
   * @param {string} source - File source text
   * @returns {FileInfo} { exports, imports, importedSymbols, defaultExportName, reExports }
   */
  parse(filePath, source) { }

  /**
   * Resolve a module specifier from a given file's directory.
   * @param {string} spec - Module specifier (relative path, namespace, bare name)
   * @param {string} fromDir - Importing file's directory
   * @returns {string|null} - Resolved repo-relative path or null
   */
  resolveSpecifier(spec, fromDir) { }
}
```

### Pattern 2: tree-sitter PHP Parse

**What:** Parse a PHP file with tree-sitter and walk the AST to extract structural metadata. Use tree-sitter queries (S-expressions) for efficient node discovery.

**Example (src/Core/PHPParser.mjs):**
```javascript
import Parser from 'tree-sitter';
import PhpLang from 'tree-sitter-php';

export class PHPParser {
  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(PhpLang);
  }

  parse(filePath, source) {
    const tree = this.parser.parse(source);
    const root = tree.rootNode;
    const result = {
      exports: [],
      imports: [],
      importedSymbols: {},
      defaultExportName: null,
      reExports: [],
    };

    // Use tree-sitter queries to find PHP constructs
    // Namespace: (namespace_definition name: (name) @name)
    // Use statements: (namespace_use_declaration
    //   (namespace_use_clause (name) @import (alias)? @alias))
    // Class: (class_declaration name: (name) @name)
    // Function: (function_definition name: (name) @name)

    // ... query and walk AST ...
    return result;
  }
}
```

### Pattern 3: PSR-4 Namespace-to-Path Resolution

**What:** PHP uses PSR-4 autoloading (namespaces → directory paths). Import graph edges start from `use` statements. The parser must map `use App\Models\User` to `app/Models/User.php`.

```javascript
// PSR-4 resolution: namespace prefix → base directory mapping
// e.g., composer.json autoload.psr-4 {"App\\": "app/"}
// "use App\Models\User" → "app" + "/Models/User.php" = "app/Models/User.php"
function resolveNamespace(spec, psr4Prefixes) {
  for (const [prefix, baseDir] of Object.entries(psr4Prefixes)) {
    if (spec.startsWith(prefix)) {
      const relativePath = spec.slice(prefix.length).replace(/\\/g, '/');
      return `${baseDir}/${relativePath}.php`;
    }
  }
  return null;
}
```

### Anti-Patterns to Avoid

- **Parsing PHP with regex** — `require`/`include`/`use` statements can span multiple lines, appear inside strings, or be nested inside conditionals. Tree-sitter handles all of these correctly.
- **Treating PHP `use` like ES imports** — PHP `use` creates a namespace alias, it does NOT create a runtime dependency edge. `use App\Models\User;` means `new User()` resolves to `\App\Models\User`, but the file isn't "imported" until actually referenced. For building an import graph, treat `use` as a declarative edge (it shows which files the code might reference).
- **Ignoring `require`/`include`** — These ARE runtime file dependencies. `require __DIR__.'/../helpers.php';` is a real graph edge. Less common in modern PHP but must be supported.
- **Assuming all PHP is Laravel** — The parser must work for plain PHP and all frameworks. Laravel analysis is additive — extra decorators on top of base PHP parsing.
- **Over-engineering the parser abstraction** — PHP and TS/JS have fundamentally different module systems. Don't try to force identical data structures For example, PHP has no "default export" concept and exports are implicit (namespaced classes are auto-exported).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PHP AST parser | Regex-based PHP "parsing" | `tree-sitter-php` grammar | Handles all PHP edge cases: alternative syntax (`:`+`endif`), heredocs, variable variables, namespaced identifiers, type annotations, attributes |
| Incremental reparse | Custom diff-and-reparse | `tree-sitter` built-in `Tree.edit()` | tree-sitter supports incremental parsing natively — edits to a tree are faster than full reparse |
| TS/JS parser | Roll your own AST walker | Existing `ts-morph` Project API | Already in the codebase and works — only PHP needs a new parser |

**Key insight:** The difficulty in static analysis is NOT parsing — it's resolving module specifiers to file paths. PHP's autoloader (PSR-4) and Composer make this straightforward: parse `composer.json` for namespace prefix→base directory mapping, resolve `use` statements to file paths. ts-morph for TS/JS already handles this via tsconfig. The two resolution schemes coexist cleanly in separate name spaces.

---

## Common Pitfalls

### Pitfall 1: Native Addon Compilation
**What goes wrong:** `tree-sitter` requires native compilation (node-gyp). CI or contributors may lack build tools (Python, C++ compiler, make).
**Why it happens:** `tree-sitter` is a C++ addon via `node-addon-api` + `node-gyp-build`.
**How to avoid:** The package ships prebuilt binaries via `prebuildify` for major platforms. `node-gyp-build` fetches the right binary at install time. Ensure CI has `--build-from-source` fallback only as last resort. Document the prerequisite (build-essential, python3) for fallback.
**Warning signs:** `npm install` fails with `node-gyp rebuild` errors; missing `binding.gyp` steps.

### Pitfall 2: PHP Namespace Edge Cases
**What goes wrong:** PHP allows multi-part namespace declarations (`namespace Foo\Bar\Baz;`), grouped use statements (`use Foo\{Bar, Baz};`), `use function` / `use const`, and namespace aliasing (`use Foo\Bar as Baz;`).
**Why it happens:** The grammar is detailed but tree-sitter represents each of these differently in the AST.
**How to avoid:** Write comprehensive unit tests against the tree-sitter AST for every PHP import/use variant before building the full pipeline. The tree-sitter query API makes most of these straightforward to capture.
**Warning signs:** `namespace_use_declaration` `type` field differentiates `type` (class), `function`, and `const` imports. Grouped use produces multiple `namespace_use_clause` children per `namespace_use_declaration`.

### Pitfall 3: Performance at Scale
**What goes wrong:** Laravel projects can have 2000+ PHP files and 10,000+ vendor files. Parsing everything with tree-sitter is fast per-file but slow in aggregate.
**Why it happens:** tree-sitter is fast (~1MB/sec parse) but 12,000+ files still takes noticeable time.
**How to avoid:** Only parse project source files (not `vendor/`) by default. The existing agentmap already excludes `node_modules/` — apply the same pattern to exclude `vendor/`. Provide a `--all` or `--with-vendor` flag for exhaustive analysis.
**Warning signs:** `npm run map` takes > 30 seconds on a project with vendor. File discovery glob returns 15,000+ PHP files.

### Pitfall 4: Mixed-Project Resolution Ambiguity
**What goes wrong:** A repo has both `src/Foo.ts` and `src/Foo.php`. A query for "Foo" should return both, but the existing `--any` router doesn't know about PHP files.
**Why it happens:** The CLI's file resolution, `--map` digest, and `--features` all assume TS/JS-only. PHP files need `dirtyCount()`, `featureOf()`, and `fileBlock()` to recognize `.php` extensions.
**How to avoid:** Add `.php` to the source file extension regexes in `dirtyCount()`. Create a unified `resolveFile()` that searches both TS/JS and PHP file sets. Legacy commands must not regress.

---

## Code Examples

### Initialize tree-sitter with PHP grammar
```javascript
import Parser from 'tree-sitter';
import Php from 'tree-sitter-php';

const parser = new Parser();
parser.setLanguage(Php);
const tree = parser.parse(`<?php namespace App\Models; use Illuminate\\Database\\Eloquent\\Model; class User extends Model {}`);
const root = tree.rootNode;
```
[CITED: tree-sitter.github.io/node-tree-sitter/classes/Parser.html]

### tree-sitter queries for PHP constructs
```javascript
// Find namespace declarations:
// (namespace_definition name: (name) @ns-name)

// Find use/import statements with aliases:
// (namespace_use_declaration
//   (namespace_use_clause
//     (name) @import-name
//     alias: (name)? @import-alias))

// Find class declarations:
// (class_declaration name: (name) @class-name
//   base_clause: (base_clause (name) @extends)?
//   class_interface_clause: (class_interface_clause (name) @implements)*)

// Find function definitions:
// (function_definition name: (name) @fn-name)

// Find trait use inside a class:
// (declaration_list (use_declaration (name) @trait-use))

// Find method calls (Laravel facades: Cache::get()):
// (scoped_call_expression
//   scope: (name) @scope-name
//   name: (name) @method-name)

// Find function calls:
// (function_call_expression
//   function: (name) @fn-call-name)

const query = parser.getLanguage().query(`(class_declaration name: (name) @class-name)`);
const matches = query.matches(root);
for (const match of matches) {
  for (const capture of match.captures) {
    console.log(`${capture.name} = ${capture.node.text} at ${capture.node.startPosition.row}:${capture.node.startPosition.column}`);
  }
}
```
[CITED: tree-sitter.github.io/tree-sitter/using-parsers/queries/1-syntax]

### Sync with the Q query API (Node.js)
```javascript
// tree-sitter v0.25+ Node.js API: query() returns Query with matches/captures
// Parser is the main class. setLanguage(Language). parse(string) → Tree.
// Tree.rootNode → SyntaxNode. SyntaxNode has: type, childCount, children,
//   parent, startPosition, endPosition, text, namedChildren, descendantsOfType, etc.
// Language.query(sexpString) → Query. Query.matches(rootNode) → QueryMatch[]
// QueryMatch.captures → QueryCapture[] (name + node)

const query = new Parser.Query(phpLang, `
  (namespace_definition name: (name) @ns)
  (class_declaration name: (name) @class)
  (class_declaration
    base_clause: (base_clause (name) @extends))
`);
```
[CITED: tree-sitter.github.io/node-tree-sitter/interfaces/QueryCapture.html]

### PHPParser class outline
```javascript
export class PHPParser {
  constructor(phpLang) {
    this.parser = new Parser();
    this.parser.setLanguage(phpLang);
    // Precompile queries for frequent operations
    this.queries = {
      namespace: phpLang.query(`(namespace_definition name: (name) @ns)`),
      useStatements: phpLang.query(`(namespace_use_declaration
        (namespace_use_clause
          (name) @import
          alias: (name)? @alias
        )
      )`),
      classDecl: phpLang.query(`(class_declaration
        name: (name) @name
        base_clause: (base_clause (name)* @extends)?
      )`),
      interfaceDecl: phpLang.query(`(interface_declaration name: (name) @name)`),
      traitDecl: phpLang.query(`(trait_declaration name: (name) @name)`),
      enumDecl: phpLang.query(`(enum_declaration name: (name) @name)`),
      functionDef: phpLang.query(`(function_definition name: (name) @name)`),
    };
  }

  /** @returns {import('tree-sitter').SyntaxNode} */
  parseFile(source) {
    return this.parser.parse(source).rootNode;
  }
}
```

### PHP namespace + use resolution
```php
<?php
// Source file: app/Models/User.php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class User extends Model {
    use HasFactory;
}
```

Expected tree-sitter output:
- `namespace_definition` → name: `App\Models`
- `namespace_use_declaration` → `Illuminate\Database\Eloquent\Model` (type: type)
- `namespace_use_declaration` → `Illuminate\Database\Eloquent\Factories\HasFactory` (type: type)
- `class_declaration` → name: `User`, base_clause: `Model`
- `use_declaration` → `HasFactory` (trait use inside class body)

Graph edges generated:
- `app/Models/User.php` → `vendor/laravel/framework/src/Illuminate/Database/Eloquent/Model.php` (depends-on)
- `app/Models/User.php` → `vendor/laravel/framework/src/Illuminate/Database/Eloquent/Factories/HasFactory.php` (depends-on)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolith in single file | Modular in src/Core/ | This project | Decomposition enables separate language backends |
| ts-morph only | ts-morph + tree-sitter | This project | PHP support without rebuilding the entire tool |
| No PHP support | Full PHP/Laravel analysis | This project | Opens PHP/Laravel market for agentmap |

**Deprecated/outdated:**
- `web-tree-sitter` for CLI tools: WASM-based, slower startup, async initialization. The native `tree-sitter` npm package is the correct choice.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | tree-sitter npm package can be lazily loaded like ts-morph (via createRequire) | Architecture | If tree-sitter doesn't support lazy init due to native module registration, cold start times increase. Verify with a quick prototype. |
| A2 | composer.json is always present in PHP/Laravel projects | PSR-4 Resolution | Projects without Composer exist (WordPress, legacy). Fall back to scanning `src/` for namespace patterns. |
| A3 | Sorting `require`/`include` edges is a low priority for modern PHP code | PHPParser | Legacy or WordPress-style codebases rely heavily on `require_once`. Need to be supported for correctness but edge weight in PageRank should be configurable. |
| A4 | PHP files in `vendor/` should be excluded by default | Performance | Some analysis needs full vendor graph (e.g., framework internals). Must support `--with-vendor` flag. |

---

## Open Questions

1. **How to lazily load tree-sitter like ts-morph?**
   - What we know: ts-morph uses `createRequire()` + closure (`() => (_tsm ??= _require("ts-morph"))`). tree-sitter is a native addon (node-addon-api). Native modules typically register on require and don't fully benefit from lazy closures.
   - What's unclear: Can tree-sitter's `Parser` class and language objects be deferred without a startup penalty?
   - Recommendation: Prototype a quick benchmark. If native addon init is <50ms, lazy loading is unnecessary complexity.

2. **PHP parser vs ts-morph interface parity**
   - What we know: ts-morph provides rich type introspection (Symbol, Type, Declaration, etc.). tree-sitter only gives us an AST (node types, positions, text).
   - What's unclear: Does the existing code use ts-morph's type system, or only AST-level information (exports, imports, symbol definitions)? If only AST, tree-sitter parity is easy.
   - Recommendation: Audit all ts-morph API calls in `agentmap.mjs` — count type-level calls vs AST-level calls.

3. **Laravel facade resolution strategy**
   - What we know: Facade classes like `Illuminate\Support\Facades\Cache` map to underlying classes via `getFacadeAccessor()`. A `use Illuminate\Support\Facades\Cache; Cache::get()` call in the AST shows `scoped_call_expression` with scope `Cache`.
   - What's unclear: Should we resolve `Cache` back to the facade root class, or simply record the edge to the alias'ed namespace? Laravel's real autoloading means `Cache` resolves to the Facade, but "intent" is to call the underlying service.
   - Recommendation: Start simple — record edges to the namespace alias target. Add facade resolution as a second phase, optional via `--laravel` flag.

4. **Mixed-project file graph merging**
   - What we know: PHP `use App\Models\User;` and TS `import { User } from './models/user';` can refer to the same logical entity. But the file paths are different.
   - What's unclear: Should the graph merge at the semantic level (both reference "User"), or only at the file level? If both PHP and TS files reference `getUser()`, should there be a cross-language edge?
   - Recommendation: File-graph only (no cross-language symbol resolution) in the first version. Cross-language edges can be a future extension.

---

## Sources

### Primary (HIGH confidence)
- [CITED: tree-sitter.github.io/node-tree-sitter/] — Full TypeDoc API reference for `tree-sitter` npm package
- [CITED: tree-sitter.github.io/tree-sitter/using-parsers/] — Official tree-sitter documentation (parsing, queries, walking trees)
- [CITED: github.com/tree-sitter/tree-sitter-php] — PHP grammar repository + node-types.json
- [VERIFIED: npm registry] — Package versions: tree-sitter@0.25.0, tree-sitter-php@0.24.2, web-tree-sitter@0.26.9

### Secondary (MEDIUM confidence)
- [CITED: github.com/tree-sitter/node-tree-sitter] — Source code, tree-sitter.d.ts type definitions  
- [CITED: www.php-fig.org/psr/psr-4/] — PSR-4 autoloading specification
- [CITED: github.com/php-fig/fig-standards] — PHP Framework Interop Group standards

### Tertiary (LOW confidence)
- Assumptions about Laravel facade resolution and Composer autoloading patterns are based on general PHP ecosystem knowledge, not verified against specific Laravel documentation in this session.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Packages are well-known, versions confirmed on npm registry
- Architecture: HIGH — Based on thorough codebase analysis of agentmap.mjs
- Pitfalls: HIGH — Native addon and PHP namespace edge cases are well-documented
- Laravel specifics: MEDIUM — Facade resolution and service provider patterns need deeper Laravel-specific research

**Research date:** 2026-06-19  
**Valid until:** 2026-07-19 (30 days — packages are stable but tree-sitter has occasional minor releases)
