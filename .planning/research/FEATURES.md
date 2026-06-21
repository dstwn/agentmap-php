# Feature Landscape: Composer Dependency Graph + PHP Type Resolution

**Domain:** PHP code-map tool (agentmap-php)
**Researched:** 2026-06-21
**Mode:** Ecosystem features for v1.2 milestone

## Overview

Three feature areas for the v1.2 milestone, ordered by dependency:

1. **Composer Dependency Graph** — parse `composer.json`/`composer.lock` to build a package-level dependency graph with version-constraint awareness. Includes edge types for `require`, `require-dev`, `conflict`, `replace`, `provide`, `suggest`.
2. **PHP Type Resolution (beyond declared types)** — trace variable types through assignments, track return types through method chains, read PHPDoc annotations, basic union narrowing. NOT full control-flow analysis.
3. **Legacy Non-PSR-4 Code Detection** — detect PHP files that don't follow PSR-4 namespace conventions, using `composer.json` `autoload.classmap` entries and heuristic scanning.

---

## Table Stakes

Features users expect from a code-map tool with PHP support. Missing these = product feels incomplete.

### 1. Package Dependency Parsing (Composer)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Read `composer.json` `require`/`require-dev` | Every PHP project has a `composer.json`; users expect the tool to know their dependencies | **LOW** | JSON parse, already partially done for PSR-4 autoload. Add edge extraction. |
| Read `composer.lock` resolved versions | Lockfile is the source of truth for what's installed | **LOW** | Flat JSON, parse `packages` and `packages-dev` arrays. Each has `name`, `version`, `require`, etc. |
| Basic package → package edges (depends-on) | Core value: "what packages does this project depend on?" | **LOW** | `composer.json.require` → edges. `composer.lock` for resolved version. |
| `require-dev` edges separate from `require` | Dev dependencies are a different class of edge; users need to distinguish | **LOW** | Separate edge type or edge metadata attribute. |
| Version constraint display (caret, tilde, exact) | Users want to see "~1.2.3" not just "1.2.3" | **LOW** | Store the original constraint string from `composer.json`, also store resolved version from lock. |
| `--relates` includes package edges | Existing flag should show package dependencies alongside file-level edges | **LOW** | Extend `--relates` output to include package-level edges. |

### 2. PHP Type Resolution

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Declared property types | Already done in `EnhancedLaravelParser.inferTypes()` | **LOW** | `property_declaration` → `type_declaration` node |
| Declared parameter types | Already done in `EnhancedLaravelParser.inferTypes()` | **LOW** | `simple_parameter` → `type_declaration` node |
| Declared return types | Already done in `EnhancedLaravelParser.inferTypes()` | **LOW** | Method `type_declaration` after formal_parameters |
| `$x = new ClassName()` assignment tracking | Most basic non-declared type inference: "if you assign `new Foo`, $x is Foo" | **MEDIUM** | Track `assignment_expression` with `object_creation_expression` RHS. Store in a per-file local type map. |
| `@var` PHPDoc annotation reading | Standard way to annotate variable types when PHP can't infer them | **MEDIUM** | Parse PHPDoc comments above assignments. tree-sitter doesn't parse PHPDoc natively — need comment text scanning. |
| `@return` / `@param` PHPDoc reading | Standard way to annotate function/method types beyond PHP type hints | **MEDIUM** | Same PHPDoc comment scanning approach. Extract `@return Type`, `@param Type $name`. |

### 3. Legacy Code Detection

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Detect missing PSR-4 compliance (files in PSR-4 dirs whose class doesn't match namespace) | Common issue in older hybrid codebases (e.g. manobo-upgrade's `classes/` + `modules/`) | **LOW** | For each PSR-4 prefix→dir mapping, check if class declarations in those dirs match the expected namespace. Flag mismatches. |
| Read `autoload.classmap` from `composer.json` | Composer's standard mechanism for non-PSR-4 autoloading | **LOW** | JSON parse — already reading composer.json. Add classmap dirs to the file discovery list. |
| Scan classmap dirs for classes/traits/interfaces | Classmap directories need file scanning to know what classes exist where | **MEDIUM** | Walk classmap dirs (respect exclusions), parse each .php file, extract class/interface/trait names. Not as simple as PSR-4 resolution. |

---

## Differentiators

Features that set agentmap-php apart from other code-map tools. Not expected by users, but highly valued.

### 1. Composer Dependency Graph

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `replace` edge support | Shows package aliasing/replacement relationships — critical for fork detection | **LOW** | Read `composer.json.replace`. Edge type: `replaces`. |
| `conflict` edge support | Shows incompatible packages — useful for debugging dependency hell | **LOW** | Read `composer.json.conflict`. Edge type: `conflicts`. |
| `provide` edge support | Shows virtual package provision (e.g., `psr/log-implementation`) | **LOW** | Read `composer.json.provide`. Edge type: `provides`. |
| `suggest` edge support | Shows recommended-but-not-required packages | **LOW** | Read `composer.json.suggest`. Edge type: `suggests`. |
| Package-level `content-hash` staleness detection | Detect when `composer.json` changed but `composer.lock` wasn't updated | **LOW** | Compare `composer.lock.content-hash` against computed hash of relevant composer.json keys. |
| `--packages` CLI flag dedicated to package graph | Dedicated output for package-level view, separate from file-level map | **MEDIUM** | New CLI flag. Output formats: text tree, JSON, Mermaid, DOT. |
| `--dependencies <package>` to see a specific package's subtree | Drill into a specific package's transitive dependencies | **MEDIUM** | Filter + tree display for one package. |
| Mermaid/DOT output for package graph | Visualizable dependency graph (PRs, docs, wiki) | **MEDIUM** | Pattern: `sen-ltd/composer-graph` does this in PHP. Same concept in Node.js. |
| Default `vendor/` exclusion with `--with-vendor` override | Same pattern as existing `node_modules/` exclusion. Users don't want vendor in their file graph by default but may want package-level view. | **LOW** | Package edges are from `composer.*` not from scanning vendor. But optionally resolve `use` statements to vendor package names. |

### 2. PHP Type Resolution

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Return-type chaining: `$x->getFoo()->getBar()` resolves Bar | Trace through fluent method chains when return types are known | **MEDIUM** | Follow `member_call_expression` chains. Resolve each step via declared return type of the method. |
| Local variable type propagation through assignments | `$x = getFoo(); $y = $x;` → $y has same type as $x | **MEDIUM** | Per-file scope tracking of `varName → resolvedType`. Update on each assignment. |
| Union type awareness without full narrowing | Know that a variable is `string|int|null` without tracking which branch | **LOW** | Read union type declarations (`string|int` in PHP 8.x syntax or `@return string|int|null`) |
| `@method` / `@property` PHPDoc on classes | Resolve magic methods/properties declared in PHPDoc | **MEDIUM** | Parse class-level PHPDoc for `@method` and `@property` annotations. |
| Type information in `--any` / `--find` / `--map` output | Surfacing type data makes the code map more useful for AI agents | **MEDIUM** | Include type annotations in the `fileBlock()` output format. |

### 3. Legacy Code Detection

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Scan `require`/`include` calls as additional resolution paths | `require_once __DIR__.'/../helpers.php';` is a file dependency edge | **LOW** | Already partially done in `PhpParser.extractImports()`. Ensure edges are added to the graph. |
| Auto-detect fallback dirs when no PSR-4 exists | If a project has no `composer.json` or no PSR-4 config, scan `src/`, `lib/`, `classes/`, `app/` | **LOW** | Heuristic fallback. Common dirs in legacy PHP projects. |
| Naming convention detection (class name → file path) | Legacy files may be named `class.User.php` or `user.class.php` | **MEDIUM** | Multiple legacy naming conventions to detect. Not critical for v1.2. |
| `--doctor` integration for legacy code warnings | Alert users about detected non-PSR-4 code that could cause autoloading issues | **LOW** | Add checks to existing `--doctor`/`--status` commands. |

---

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full PHPStan/Psalm-level type inference engine | Massive complexity (control flow graph, SSA, generics, template types, intersection types). agentmap is a Node.js code-map tool, not a PHP static analyzer. Over-engineering for marginal gain — declared types + simple assignment tracking covers 90%+ of use cases for code-map consumption. | Stick to: declared types + assignment tracking + PHPDoc reading. Document the type-inference boundary clearly. |
| Composer SAT solver / version conflict resolution | Composer's dependency solver is a SAT problem. Implementing that in Node.js is insane — Composer already solved it. The lockfile IS the resolved state. | Read the lockfile. Don't re-solve. Show what composer already resolved. |
| Full control-flow-sensitive type narrowing (`if (is_int($x))` → type narrows) | Requires per-branch scope tracking (MutatingScope in PHPStan). Agent context doesn't need this — declared types + simple tracking suffices for understanding what a file provides. | Track only unconditional assignments and declarations. Skip if-branch narrowing, isset checks, instanceof narrowing. |
| Cross-file type inference (infer a function's return type by analyzing its body from all call sites) | Requires full inter-procedural analysis. Not practical for a Node.js CLI tool that runs in < 5s. | Use declared return types and PHPDoc `@return`. Only intra-file assignment tracking. |
| Livewire type inference (dynamic component property resolution) | Livewire's magic property system is undecidable without runtime reflection. | Skip Livewire property types. Focus on explicit declarations. Already handled in existing EnhancedLaravelParser. |
| Eloquent dynamic attribute type inference | Requires database schema knowledge or `@property` annotations. Out of scope for a file-map tool. | Larastan handles this. agentmap should use declared `@property` annotations if present, skip otherwise. |

---

## Feature Dependencies

```
Dependency Graph Feature Set:
  ├─ composer.json require/dev parsing (LOW)
  ├─ composer.lock parsing (LOW)
  ├─ Edge type model: depends/dev-depends (LOW)
  ├─ Edge type model: conflict/replace/provide/suggest (LOW)
  ├─ Version constraint display (LOW)
  ├─ --packages CLI flag (MEDIUM) ── depends on: composer.json + lock parsing
  ├─ --dependencies <pkg> (MEDIUM) ── depends on: --packages
  └─ Mermaid/DOT output (MEDIUM) ── depends on: --packages

Type Resolution Feature Set:
  ├─ Declared types (LOW) — ALREADY DONE
  ├─ PHPDoc @var/@return/@param parsing (MEDIUM)
  ├─ $x = new Foo() tracking (MEDIUM) ── independent of PHPDoc
  ├─ Return-type chaining (MEDIUM) ── depends on: declared types + PHPDoc
  └─ Local variable propagation (MEDIUM) ── depends on: $x = new Foo() tracking

Legacy Detection Feature Set:
  ├─ Classmap autoload reading (LOW) ── independent
  ├─ Non-PSR-4 file detection (LOW) ── independent
  ├─ Fallback dir detection (LOW) ── independent
  └─ --doctor warnings (LOW) ── depends on: other legacy features

Cross-cutting:
  ├─ Enhanced --relates output (LOW) ── depends on: edge type model
  └─ Enhanced --any/--find type display (MEDIUM) ── depends on: type resolution
```
## MVP Recommendation

### Phase 1: Composer Dependency Graph (Foundation)
Priority: **HIGH** — Lowest complexity, highest visibility, clean interface boundary.

1. Parse `composer.json` for `require`, `require-dev`, `conflict`, `replace`, `provide`, `suggest`
2. Parse `composer.lock` for resolved versions and package metadata
3. Build package-level dependency graph with typed edges
4. Store in map.json as `packages` and `packageEdges` alongside existing `files`/`edges`
5. New CLI flag: `--packages` for package graph output
6. Enhance `--relates` to include package edges (e.g., `--relates monolog/monolog` shows dependents)
7. JSON output support for all new flags

**Defer to Phase 2:**
- Mermaid/DOT output format
- `content-hash` staleness detection
- MCP tool enhancements

### Phase 2: PHP Type Resolution (Medium)
Priority: **MEDIUM** — More complex, builds on existing parser.

1. PHPDoc comment scanner (extract `@var`, `@return`, `@param`, `@method`, `@property`)
2. `$x = new Foo()` assignment → local variable type tracking
3. Return-type chaining through method calls
4. Local variable type propagation (`$y = $x` → `$y` has `$x`'s type)
5. Include type information in `fileBlock()` / `--map` / `--any` output
6. Store `types` in map.json (per-file type information)

### Phase 3: Legacy Code Detection (Lowest Priority)
Priority: **LOW** — Important for specific use cases (manobo-upgrade) but narrow audience.

1. Read `autoload.classmap` from `composer.json`; scan classmap directories
2. Detect non-PSR-4 files in PSR-4 directories
3. Fallback directory scanning when no PSR-4 config
4. `--doctor` warnings for legacy patterns
5. `--legacy` CLI flag for legacy-centric analysis

---

## Feature Complexity Matrix

| Feature | Area | Complexity | Dependency | Phase |
|---------|------|------------|------------|-------|
| composer.json require/dev parse | Dependency Graph | LOW | None | 1 |
| composer.lock parse | Dependency Graph | LOW | None | 1 |
| Package edge model (require/dev) | Dependency Graph | LOW | composer.json parse | 1 |
| Package edge model (conflict/replace/provide/suggest) | Dependency Graph | LOW | composer.json parse | 1 |
| Version constraint display | Dependency Graph | LOW | composer.json parse | 1 |
| `--packages` CLI flag | Dependency Graph | MEDIUM | Edge model | 1 |
| `--dependencies <pkg>` | Dependency Graph | MEDIUM | `--packages` | Defer |
| Mermaid/DOT output | Dependency Graph | MEDIUM | `--packages` | Defer |
| Enhanced `--relates` | Cross-cutting | LOW | Edge model | 1 |
| PHPDoc @var/@return/@param | Type Resolution | MEDIUM | None | 2 |
| `$x = new Foo()` tracking | Type Resolution | MEDIUM | None | 2 |
| Return-type chaining | Type Resolution | MEDIUM | PHPDoc + declared types | 2 |
| Local variable propagation | Type Resolution | MEDIUM | Assignment tracking | 2 |
| `@method` / `@property` reading | Type Resolution | MEDIUM | PHPDoc scanner | 2 |
| Type info in output | Type Resolution | MEDIUM | All type features | 2 |
| Classmap autoload reading | Legacy Detection | LOW | None | 3 |
| Non-PSR-4 detection | Legacy Detection | LOW | None | 3 |
| Fallback directory scanning | Legacy Detection | LOW | None | 3 |
| `--doctor` legacy warnings | Legacy Detection | LOW | Legacy features | 3 |

---

## Edge Type Definitions (Package Graph)

| Edge Type | Source | Target | Description | In Current Graph? |
|-----------|--------|--------|-------------|-------------------|
| `depends-on` | composer.json `require` | package name | Required at runtime | No |
| `dev-depends-on` | composer.json `require-dev` | package name | Required for development | No |
| `conflicts` | composer.json `conflict` | package name | Cannot be installed together | No |
| `replaces` | composer.json `replace` | package name | This package replaces another | No |
| `provides` | composer.json `provide` | package name | Provides a virtual package | No |
| `suggests` | composer.json `suggest` | package name | Recommended but not required | No |
| `file-depends-on` (existing) | PHP `use` statement | file path | File-level import edge | Yes |
| `file-uses-package` | PHP `use` statement | vendor package | Maps a `use` to its originating package (optional enrichment) | No |

**Key design decision:** Package-level edges go into a separate `packageEdges` array in map.json, NOT mixed into the `edges` array (which is file-level). The existing `edges` schema remains unchanged. A new `packages` top-level key stores the package node data.

---

## Version Constraint Display

| Constraint | Meaning | Display Style |
|------------|---------|---------------|
| `^1.2.3` | >=1.2.3 <2.0.0 | `^1.2.3 (resolved: 1.2.5)` |
| `~1.2.3` | >=1.2.3 <1.3.0 | `~1.2.3 (resolved: 1.2.5)` |
| `1.2.3` | Exactly 1.2.3 | `1.2.3` |
| `>=1.2` | >=1.2.* | `>=1.2 (resolved: 1.3.0)` |
| `1.2.*` | >=1.2.0 <1.3.0 | `1.2.* (resolved: 1.2.5)` |
| `*` | Any version | `* (resolved: 2.0.1)` |
| `dev-master` | Dev branch | `dev-master#abc1234` |

**Resolution priority:** `composer.lock` version wins over `composer.json` constraint for display. Always show both the declared constraint AND the resolved version.

---

## Type Resolution Levels (Scope)

agentmap-php type resolution operates at these levels, from simplest to most complex:

### Level 0: Declared Types (EXISTING) — LOW
- Property type hints (`public int $count`)
- Parameter type hints (`function foo(string $name)`)
- Return type hints (`function foo(): Bar`)
- Stored in: `EnhancedLaravelParser.inferTypes()` results

### Level 1: Simple Assignment Tracking (PHASE 2) — MEDIUM
- `$x = new Foo()` → `$x` is type `Foo`
- `$x = getSomething()` → `$x` is the declared return type of `getSomething()`
- `$x = $y` → `$x` has the type of `$y` (if tracked)
- Per-file local type map (not cross-file)

### Level 2: PHPDoc Annotation Reading (PHASE 2) — MEDIUM
- `/** @var Foo */ $x = ...` → declares `$x` as `Foo`
- `/** @return Foo */` → overrides/extends declared return type
- `/** @param Foo $x */` → overrides/extends declared parameter type
- `/** @method Foo bar() */` → adds magic method to class
- `/** @property Foo $bar */` → adds magic property to class
- Simple regex-based PHPDoc parser (not full DocParser)

### Level 3: Return-Type Chaining (PHASE 2) — MEDIUM
- `$x->getFoo()->getBar()`:
  1. `$x` has type (from declared/L1/L2)
  2. `$x->getFoo()` → look up `getFoo()` return type on `$x`'s class
  3. Result has type from step 2
  4. `->getBar()` → look up `getBar()` return type on step 3's class

### NOT building (Level 4+):
- Control-flow-sensitive narrowing (`if (is_int($x))`)
- Inter-procedural analysis (analyzing callee bodies at call sites)
- Generics/template resolution
- Conditional return types
- SSA construction / phi nodes

---

## Existing Code Integration Points

### What stays unchanged (BACKWARD COMPATIBILITY):
- `src/Core/graph.mjs` — PageRank algorithm (unchanged, operates on file-level nodes)
- `src/Core/constants.mjs` — Add new constants but don't change existing ones
- `src/Core/cli.mjs` — All existing flags and output formats work identically
- `src/Core/cache.mjs` — Staleness detection (add packages to fingerprint)
- `src/Core/PhpParser.mjs` — Core PHP parsing unchanged
- `src/Core/EnhancedLaravelParser.mjs` — `inferTypes()` stays as Level 0; Level 1+ added alongside

### What gets extended:
- `map-builder.mjs` `build()` — Add package graph construction after file graph
- `constants.mjs` — Add new constants for package-related limits
- `cli.mjs` — Add `--packages`, `--dependencies` flags; enhance `--relates`
- `cache.mjs` — Include packages in fingerprint/staleness

### What gets created:
- `src/Core/PackageGraphResolver.mjs` — Composer JSON/lock parsing + package graph building
- `src/Core/TypeResolver.mjs` — Level 1-3 type inference (assignment tracking, PHPDoc, chaining)
- `src/Core/PhpDocParser.mjs` — Simple PHPDoc annotation scanner (regex-based, not full parser)
- `src/Core/LegacyDetector.mjs` — Classmap scanning + non-PSR-4 detection

---

## Interactions with Existing Features

| Existing Feature | How New Features Interact |
|-----------------|---------------------------|
| `--any <query>` | If query matches a package name → show package info + file-level results. If query matches a type name → show type info. |
| `--find <symbol>` | Package names become findable symbols. Type names become findable (`find Foo` matches files where `$x = new Foo()`). |
| `--map` | Not changed. Packages are NOT part of the file map digest. Separate `--packages` output. |
| `--relates <path>` | **Enhanced:** If path matches a known file, include package-level edges. If path matches a package name, show all files that `use` classes from that package. |
| `--hubs` | Unchanged — operates on file-level PageRank only. |
| `--doctor` | **Enhanced:** Add checks for: missing composer.lock, stale composer.lock, non-PSR-4 code, unreachable package dependencies. |
| `--print <path>` | **Enhanced:** Include type information in the block output if type resolution data is available for symbols. |

---

## Data Model Extensions (map.json schema)

### New top-level keys:

```jsonc
{
  // ... existing (schema v3): schema, generatedSha, dirty, fingerprint, hubs, features, rankedSymbols, files, edges

  // NEW: Package dependency graph
  "packages": {
    "monolog/monolog": {
      "version": "2.9.1",
      "constraint": "^2.0",
      "type": "library",
      "description": "Logging for PHP",
      "homepage": "https://github.com/Seldaek/monolog",
      "isDev": false,
      "license": ["MIT"]
    }
    // ... each package resolved from composer.lock
  },
  "packageEdges": [
    // From composer.json require / require-dev etc.
    { "from": "__root__", "to": "monolog/monolog", "type": "depends-on", "constraint": "^2.0" },
    { "from": "monolog/monolog", "to": "psr/log", "type": "depends-on", "constraint": "^1.0 || ^2.0 || ^3.0" },
    { "from": "__root__", "to": "phpunit/phpunit", "type": "dev-depends-on", "constraint": "^10.0" },
    { "from": "__root__", "to": "ext-json", "type": "depends-on", "constraint": "*" },
    { "from": "laravel/framework", "to": "illuminate/support", "type": "replaces", "constraint": "self.version" }
  ],

  // NEW: Per-file type information (from type resolution)
  "types": {
    "app/Models/User.php": [
      { "name": "$user", "type": "App\\Models\\User", "source": "assignment", "line": 42 },
      { "name": "$count", "type": "int", "source": "declared", "line": 15 },
      { "name": "getPosts()", "returnType": "Illuminate\\Database\\Eloquent\\Collection", "source": "declared", "line": 30 }
    ]
  },

  // NEW: Legacy code warnings
  "legacy": {
    "nonPsr4": [
      { "file": "classes/OldLib.php", "detectedClass": "OldLib", "expectedNamespace": null },
      { "file": "modules/Helper.php", "detectedClass": "Helper", "expectedNamespace": "App\\Modules" }
    ],
    "classmapDirs": ["classes/", "modules/"],
    "fallbackDirsUsed": false
  }
}
```

---

## Sources

- [CITED: getcomposer.org/doc/04-schema.md] — Composer JSON schema (require, require-dev, conflict, replace, provide, suggest, autoload PSR-4/classmap)
- [CITED: getcomposer.org/doc/01-basic-usage.md] — Composer basic usage, lock file semantics
- [CITED: getcomposer.org/doc/articles/versions.md] — Version constraint syntax (caret, tilde, wildcard, exact)
- [CITED: github.com/composer/composer/blob/main/src/Composer/Package/Package.php] — Composer's PHP Package class: edge types, version storage
- [CITED: github.com/sen-ltd/composer-graph] — Reference implementation: lockfile-to-graph in PHP
- [CITED: dev.to/sendotltd/read-composerlock-directly] — Lockfile parsing pattern: zero-dependency JSON approach
- [CITED: phpstan.org/developing-extensions/dynamic-return-type-extensions] — PHPStan type inference extension model
- [CITED: phpstan.org/writing-php-code/narrowing-types] — PHPStan type narrowing documentation
- [CITED: phpstan.org/blog/remembering-and-forgetting-returned-values] — PHPStan purity tracking for type memory
- [CITED: github.com/phpstan/phpstan-src/blob/2.2.x/src/Analyser/Scope.php] — PHPStan Scope interface: variable type tracking
- [CITED: psalm.dev/docs/annotating_code/typing_in_psalm/] — Psalm type annotation documentation
- [CITED: github.com/tron0x8/apex] — APEX static analysis framework: tree-sitter + type inference in Python
- [CITED: github.com/nikolai-vysotskyi/trace-mcp/commit/f114291] — PHP type-aware call resolution implementation in Node.js
- [CITED: github.com/AJenbo/phpantom_lsp] — PHPantom LSP: Rust-based type inference, PHPStan integration