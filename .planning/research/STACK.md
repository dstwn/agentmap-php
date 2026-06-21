# Stack Research: v1.2 — Composer Dependency Graph + PHP Type Resolution

**Project:** agentmap-php (fork of agentmap)
**Researched:** 2026-06-21
**Mode:** Ecosystem (stack additions for v1.2 milestone)
**Confidence:** HIGH for established packages, MEDIUM for custom modules

## Executive Summary

agentmap-php v1.2 adds three feature areas to the existing codebase:
1. **Composer dependency graph** — package-level edges from `composer.json` / `composer.lock`
2. **PHP type resolution beyond declared types** — assignment tracking, PHPDoc, return-type chaining
3. **Legacy non-PSR-4 code detection** — classmap scanning, convention checking

**Key finding:** Only ONE new npm dependency is needed (`semver`). All other work is new `src/Core/` modules using existing `tree-sitter-php` grammar (v0.22.6) and standard Node.js APIs. The existing tree-sitter-php grammar already produces all AST node types needed for the enhanced type resolution — no grammar upgrade required.

**Stack impact:** Minimal. Zero changes to the existing parser chain. New modules sit alongside existing `PhpParser.mjs` / `EnhancedLaravelParser.mjs` and are consumed by `map-builder.mjs` and `cli.mjs`.

---

## Recommended Stack Additions

### Core Libraries (npm)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `semver` | `^7.6.0` | Version constraint parsing for Composer dependencies | Composer uses the same `^`, `~`, `||`, `*`, `>=`, `<=` operators as npm semver for ~90% of constraints. The `semver.satisfies()`, `semver.minVersion()`, and `semver.maxSatisfying()` APIs directly map to composer constraint evaluation. [VERIFIED: npmjs.com/package/semver] |

### Existing Libraries (no change)

| Library | Version | Purpose | Why Unchanged |
|---------|---------|---------|---------------|
| `tree-sitter` | `^0.22.4` | AST parsing for PHP files | Type inference uses existing `assignment_expression`, `member_call_expression`, `object_creation_expression`, `return_statement` nodes already present in grammar. No upgrade needed. |
| `tree-sitter-php` | `^0.22.6` | PHP grammar for tree-sitter | **CRITICAL: Do NOT upgrade to 0.24.x.** The 0.24 release series introduced breaking changes (renamed `namespace_name_as_prefix` → `prefix` field, removed `namespace_aliasing_clause`, renamed `anonymous_function_creation_expression`, changed `name` → `_name` with `reserved` keyword semantics). The current 0.22.6 grammar fully supports PHP 8.0-8.3 and all node types needed for v1.2 type inference. [VERIFIED: npm registry tree-sitter-php 0.22.6 → 0.24.2 diff] |
| `ts-morph` | `28.0.0` | TS/JS parsing | Unchanged — not involved in PHP features. |

### What NOT to Add

| Package | Why Avoid | Recommended Approach |
|---------|-----------|---------------------|
| `@snyk/composer-lockfile-parser` | Wraps output in Snyk's `dep-graph` format. Adds `@snyk/dep-graph`, `@snyk/graphlib`, and transitive dependencies (10+ packages) for what is fundamentally a JSON parse + walk. Tightly coupled to Snyk CLI plugin architecture. | Parse `composer.lock` directly with `JSON.parse()` — it's a flat JSON array of packages, no special parser needed. ~50 lines of code vs 10+ dependencies. [CITED: github.com/sen-ltd/composer-graph — proven pattern] |
| `glayzzle/php-parser` | Full PHP parser in JS (v3.6.0, 0 deps, 353K/wk). Produces a higher-level AST than tree-sitter with semantic information including type hints. However, it's a separate parser — would mean maintaining two PHP parsing pipelines with different AST structures. Tree-sitter already handles everything needed. | Stick with tree-sitter. The existing `PhpParser.mjs` already walks tree-sitter ASTs. Type resolution builds on the same AST nodes. |
| `@expreva/php-parser` | Bundles PHP-WASM (entire PHP 8.x runtime compiled to WASM) running `nikic/PHP-Parser` inside the WASM. ~20MB+ download, async initialization (~2-5s), complexity explosion. Only makes sense if you need actual PHP runtime evaluation (which agentmap does not). | Tree-sitter AST walker, zero overhead. |
| `tree-sitter-php` upgrade to 0.24.x | See above — breaking changes in the grammar AST node structure. The 0.22.6 grammar already handles PHP 8.3. The only reason to upgrade would be PHP 8.4 support (property hooks, etc.), which is not needed for v1.2. | Stay on 0.22.6 for v1.2. Consider upgrade for v1.3 if PHP 8.4 features are needed. |

---

## New Source Modules (in `src/Core/`)

These are new modules, not new dependencies. All use existing patterns (`tree-sitter` AST walking, `JSON.parse`, Node.js fs).

### 1. `PackageResolver.mjs` — Composer Dependency Graph

**Purpose:** Parse `composer.json` and `composer.lock` into a package-level dependency graph.

**Interfaces with:**
- `map-builder.mjs` (called after file graph is built, adds `packages` + `packageEdges` to map.json)
- `cli.mjs` (new `--packages` flag consumes the package graph)
- `cache.mjs` (package fingerprint included in staleness detection)

**Approach:**
```javascript
// composer.lock structure (flat JSON):
{
  "packages": [
    { "name": "monolog/monolog", "version": "2.9.1",
      "require": { "psr/log": "^1.0 || ^2.0 || ^3.0" },
      "type": "library", ... }
  ],
  "packages-dev": [...],
  "content-hash": "abc123..."
}
// composer.json structure:
{
  "require": { "laravel/framework": "^10.0" },
  "require-dev": { "phpunit/phpunit": "^10.0" },
  "autoload": { "psr-4": { "App\\": "app/" }, "classmap": ["classes/"] }
}
```

**Key design decision:** Package-level edges go into a separate `packageEdges` array in `map.json`, NOT mixed into the existing file-level `edges` array. The existing `edges` schema remains unchanged.

**`semver` usage:** Parse composer version constraints with `semver` for standard cases (caret `^`, tilde `~`, wildcard `*`, OR `||`, AND space/comma). Composer-specific extensions (stability flags `@dev`/`@stable`/`@beta`, branch aliases `dev-master`) handled by a thin `ComposerConstraint` wrapper that strips flags before passing to semver.

**Composer vs npm semver compatibility matrix:**

| Composer Constraint | npm semver? | Handling |
|--------------------|-------------|----------|
| `^1.2.3` | ✅ Identical | `semver.satisfies(version, '^1.2.3')` |
| `~1.2.3` | ✅ Identical | `semver.satisfies(version, '~1.2.3')` |
| `1.2.*` | ✅ (use `1.2.x`) | `semver.satisfies(version, '1.2.x')` |
| `>=1.0 <2.0` | ✅ Identical | `semver.satisfies(version, '>=1.0 <2.0')` |
| `1.0.0 \|\| 2.0.0` | ✅ Identical | `semver.satisfies(version, '1.0.0 || 2.0.0')` |
| `>=1.0,<2.0` (comma AND) | ✅ (` ` as AND) | `semver.satisfies(version, '>=1.0 <2.0')` |
| `1.0.0@beta` (stability flag) | ❌ NOT supported | Strip `@beta` → `1.0.0`, note stability in metadata |
| `@dev` (bare stability) | ❌ NOT supported | Return `*` equivalent, note stability=dev |
| `dev-master` (branch) | ❌ NOT supported | Match by prefix, version = `0.0.0-dev` + branch name |
| `dev-master#abc123` (ref) | ❌ NOT supported | Strip ref after `#`, same as dev-master above |

### 2. `TypeResolver.mjs` — PHP Type Inference (Levels 1-3)

**Purpose:** Infer PHP variable types beyond declared type hints. Uses tree-sitter AST from the existing `PhpParser.parse()` method.

**Architecture:**
- Does NOT create a new parser — takes the `{ root, filePath, tree }` AST object from `EnhancedLaravelParser.parse()` (inherited from `PhpParser`)
- Operates **per-file** with a local type environment (`Map<string, string>` mapping variable name → resolved type)
- No cross-file analysis (that's for v2.x)

**Type tracking by severity:**

| Level | What | AST Node(s) | Implementation |
|-------|------|-------------|----------------|
| L0 (existing) | Declared property types | `property_declaration` → `property_element` → `type_declaration` | Already in `EnhancedLaravelParser.inferTypes()` |
| L0 (existing) | Declared param types | `simple_parameter` → `type_declaration` | Already in `inferTypes()` |
| L0 (existing) | Declared return types | `method_declaration` → `type_declaration` after formal_parameters | Already in `inferTypes()` |
| L1 | `$x = new Foo()` | `assignment_expression` with RHS `object_creation_expression` → `name` | Walk AST, find assignments where RHS is `new Foo`, store `$x` → `Foo` |
| L1 | `$x = getFoo()` (return type) | `assignment_expression` with RHS `function_call_expression` or `scoped_call_expression` | Look up the function/method declared return type from file exports |
| L1 | `$x = $y` (propagation) | `assignment_expression` with RHS `variable_name` | Copy type from `$y` if tracked in local env |
| L2 | `/** @var Foo */ $x` | Comment node above `assignment_expression` | Scan PHPDoc `@var` annotation with regex |
| L2 | `/** @return Foo */` | Comment node before `method_declaration` | Scan PHPDoc `@return` annotation |
| L2 | `/** @param Foo $x */` | Comment node before `method_declaration` | Scan PHPDoc `@param` annotation |
| L2 | `/** @method Foo bar() */` | Comment node before `class_declaration` | Scan for `@method` → add magic method to class type info |
| L2 | `/** @property Foo $bar */` | Comment node before `class_declaration` | Scan for `@property` → add magic property to class type info |
| L3 | `$x->getFoo()->getBar()` chain | `member_call_expression` chain walking | Walk chain: resolve `$x` type → resolve `getFoo()` return type → resolve `->getBar()` return type |

**Tree-sitter node type reference (tree-sitter-php v0.22.6):**
```
assignment_expression:        (variable "=" _expression)
  left: _variable
  right: _expression

object_creation_expression:   "new" _class_type_designator (arguments)?
  type: _class_type_designator
  arguments: arguments

member_call_expression:       expression "->" name (arguments)?
  object: expression          (the $this, $var, or chained call)
  name: name                  (the method name)
  arguments: arguments

return_statement:             "return" _expression?

formal_parameters:            "(" (simple_parameter ("," simple_parameter)*)? ")"
simple_parameter:             type_declaration? "..."? variable_name ("=" _expression)?
  type: type_declaration      (the declared type hint)
  name: variable_name         (the $param name)

type_declaration:             primitive_type | named_type | union_type | nullable_type
named_type:                   name | qualified_name | relative_name

compound_statement:           "{" _statement* "}"   (method body)
```

**Integration with EnhancedLaravelParser:**
- `TypeResolver.resolve(fileAst)` returns `{ propertyTypes, paramTypes, returnTypes, localTypes, methodReturnTypes }`
- Called from `EnhancedLaravelParser` after `parse()` and `inferTypes()` (L0)
- L0 declared types are extended by L1-L3 inferred types
- The combined type info is stored in `map.json` under a new `types` key

### 3. `PhpDocParser.mjs` — PHPDoc Annotation Scanner

**Purpose:** Extract type annotations from PHPDoc comment blocks.

**Why separate module:** PHPDoc parsing is conceptually separate from AST walking. The tree-sitter AST has comment nodes, but their content requires regex parsing. Keeping it in a dedicated module with unit tests ensures it's testable independently.

**Approach:** Regex-based (not a full DocParser). PHPDoc annotations follow predictable patterns:
```
@var Type|null $variableName optional description
@return Type|null|array description
@param Type|null $paramName description
@property Type|null $propName description
@method ReturnType methodName(Type $param, ...) description
```

**Regex patterns:**
```javascript
const VAR_PATTERN = /@var\s+(\S+(?:\|[\S]+)*)\s+\$(\w+)/;
const RETURN_PATTERN = /@return\s+(\S+(?:\|[\S]+)*)/;
const PARAM_PATTERN = /@param\s+(\S+(?:\|[\S]+)*)\s+\$(\w+)/;
const METHOD_PATTERN = /@method\s+(?:static\s+)?(\S+(?:\|[\S]+)*)\s+(\w+)\(([^)]*)\)/;
const PROPERTY_PATTERN = /@property(?:-read|-write)?\s+(\S+(?:\|[\S]+)*)\s+\$(\w+)/;
```

**Limitations:** 
- Does NOT parse full PHPDoc (skips `@see`, `@deprecated`, `@throws`, `@link`, etc.)
- Does NOT inline `@template` generics
- Does NOT parse nested array shapes (`array{key: Type, ...}`)
- Union types parsed as pipe-delimited strings (no intersection resolution)

### 4. `LegacyDetector.mjs` — Non-PSR-4 Code Detection

**Purpose:** Detect PHP files that don't follow PSR-4 namespace conventions, using `composer.json` `autoload.classmap` entries and heuristic scanning.

**Approach:**
1. Read `composer.json` `autoload.classmap` → directory list
2. Scan classmap dirs for `.php` files, parse with tree-sitter, extract class/interface/trait names
3. For each PSR-4 prefix→dir mapping, check if class declarations match the expected namespace
4. Flag mismatches: a class in an App\ directory that doesn't use the App prefix
5. Scan for `require`/`include`/`include_once`/`require_once` calls as legacy dependency patterns

**Detection categories:**
| Pattern | Detection | Severity |
|---------|-----------|----------|
| Class in PSR-4 dir but wrong namespace | Parse file AST → check `namespace_declaration` against expected from PSR-4 prefix | Warning |
| Classmap dirs referenced but no classmap autoload | `composer.json` has `autoload.classmap` = empty but directories match typical classmap patterns | Info |
| Global namespace classes in project with PSR-4 | Classes with no `namespace` declaration while other files use namespaces | Info |
| File-level `require`/`include` dependencies | Files in PSR-4 area using `require_once` (instead of autoloading) | Warning |
| Mixed PSR-4 + classmap dirs | Same directory appears in both `autoload.psr-4` and `autoload.classmap` | Info |

---

## Installation

```bash
# New dependency
npm install semver@^7.6.0

# Existing dependencies (no change)
npm install tree-sitter@^0.22.4 tree-sitter-php@^0.22.6 ts-morph@28.0.0
```

**Total new dependency weight:** ~300KB (`semver`). Zero native addons, zero WASM runtimes.

---

## Alternatives Considered

### Composer Parsing

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|------------------------|
| Direct `JSON.parse` of `composer.lock` | `@snyk/composer-lockfile-parser` | If you already depend on the Snyk ecosystem and want dep-graph format output. Not recommended — the direct approach is simpler, lighter, and more maintainable. |
| `semver` npm package for constraints | Custom constraint parser | If you need full Composer constraint syntax including stability flags (`@dev`), branch aliases (`dev-master`), and exact references (`dev-master#abc123`), you'll need a thin wrapper. But 90%+ of composer.lock constraints are standard semver syntax. |

### PHP Type Inference

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|------------------------|
| Custom tree-sitter AST type resolver (L1-L3) | `glayzzle/php-parser` (separate JS parser) | If you need a higher-level AST with built-in name resolution and don't mind maintaining two parsing pipelines. The glayzzle parser has richer AST (e.g., it can resolve `use` aliases to FQCNs internally). However, agentmap already has tree-sitter working — the cost of adding a second parser outweighs the benefit. |
| PHPDoc regex scanner | Full DocParser (e.g., `phpstan/phpdoc-parser` in PHP) | If you need full `@template`, `@extends`, `@implements` resolution with generics. For code-map consumption, simple `@var`/`@return`/`@param` regex parsing covers the 80% case. |
| Per-file type environment | MutatingScope (full CFA) | If you need conditional type narrowing, SSA construction, phi nodes, and cross-file type inference. Not needed for a code-map tool — the declared types + simple assignment tracking provide sufficient signal for AI agent context. |

---

## Version Compatibility

| Package | Installed | Latest | Compatible? | Notes |
|---------|-----------|--------|-------------|-------|
| `tree-sitter` | 0.22.4 | 0.25.0 | ✅ Compatible | No upgrade needed for v1.2. The 0.22.x API is stable and used by the existing codebase. |
| `tree-sitter-php` | 0.22.6 | 0.24.2 | ⚠️ Breaking changes | **Do NOT upgrade.** 0.23+ renamed nodes: `namespace_aliasing_clause` removed, `name` → `_name` with `reserved` semantics, `property_initializer` → `default_value`, `anonymous_function_creation_expression` → `anonymous_function`. These would require rewriting `PhpParser.mjs` and `EnhancedLaravelParser.mjs` node type checks. |
| `semver` | N/A (new) | 7.8.5 | ✅ Fresh install | No compatibility concerns. ESM-compatible (`import semver from 'semver'` or granular `import satisfies from 'semver/functions/satisfies.js'`). |
| `ts-morph` | 28.0.0 | 28.0.0 (pinned) | ✅ Unchanged | No involvement in PHP features. |

---

## Integration Architecture

### Flow Diagram (additions in bold)

```
map-builder.mjs build()
  │
  ├── 1. makeProject() → ts-morph project (existing)
  │       → parses .ts/.js/.vue files (existing)
  │
  ├── 2. PHP file parsing (existing)
  │       → PhpParser / EnhancedLaravelParser
  │       → extractImports, extractExports (existing)
  │
  ├── 3. ├── inferTypes() L0 (existing, EnhancedLaravelParser)
  │       └── **TypeResolver.resolve() L1-L3 (NEW)**
  │             → assignment tracking, PHPDoc, return-type chaining
  │             → extends L0 types with inferred types
  │
  ├── 4. File graph construction (existing)
  │       → nodes, edges, PageRank (existing)
  │
  ├── 5. **Composer graph construction (NEW)**
  │       → PackageResolver.parse(projectRoot)
  │       → reads composer.json + composer.lock
  │       → builds packages + packageEdges
  │       → uses semver for constraint display
  │
  ├── 6. **Legacy detection (NEW)**
  │       → LegacyDetector.scan(projectRoot, psr4Config, phpFiles)
  │       → classmap scanning, PSR-4 compliance check
  │
  └── 7. map.json output (extended)
        → adds packages, packageEdges, types, legacy keys
```

### map.json Schema Extensions

```jsonc
{
  // Existing keys (unchanged):
  "schema": 3, "generatedSha": "...", "fileCount": 42, "hubs": [...], "files": {...},

  // NEW:
  "packages": {
    "laravel/framework": { "version": "10.48.4", "constraint": "^10.0", "type": "library", "isDev": false }
  },
  "packageEdges": [
    { "from": "__root__", "to": "laravel/framework", "type": "depends-on", "constraint": "^10.0" },
    { "from": "laravel/framework", "to": "illuminate/support", "type": "replaces", "constraint": "self.version" }
  ],
  "types": {
    "app/Models/User.php": [
      { "name": "$user", "type": "App\\Models\\User", "source": "assignment", "line": 42 },
      { "name": "$count", "type": "int", "source": "declared", "line": 15 }
    ]
  },
  "legacy": {
    "nonPsr4": [ { "file": "classes/OldLib.php", "class": "OldLib", "namespace": null, "expected": "App\\Models" } ],
    "classmapDirs": ["classes/"]
  }
}
```

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| `semver` compatibility | HIGH | Composer's constraint syntax is nearly identical to npm's. The `semver` package has 300M+ weekly downloads, 15 years of development, and is the de facto standard. Only stability flags (`@dev`, `@beta`) and branch constraints (`dev-master`) need custom handling. [VERIFIED: npm registry, getcomposer.org/doc/articles/versions.md] |
| `composer.lock` JSON parsing | HIGH | The lockfile schema is a documented JSON structure with `packages` and `packages-dev` arrays. No special parser needed. [VERIFIED: composer/composer composer.lock file] |
| Tree-sitter node types for type inference | HIGH | The 0.22.6 grammar has `assignment_expression`, `object_creation_expression`, `member_call_expression`, `return_statement`, `formal_parameters`, `type_declaration`, `compound_statement` — all nodes needed for L1-L3 inference. [VERIFIED: tree-sitter-php grammar.json v0.22.6] |
| PHPDoc regex parsing adequacy | MEDIUM | Regex covers `@var`, `@return`, `@param`, `@method`, `@property` patterns for ~80% of real-world usage. Fails on complex generics (`@template T of Foo`) and nested shapes (`@param array{key: Type}`). Acceptable for code-map purposes. |
| `semver` + composer constraint converter | MEDIUM | The converter handles the common cases. Edge cases (aliased packages, stability flags combined with version ranges) may produce incorrect results — but these are rare in practice (<5% of constraints). Document known limitations. |
| Legacy detection heuristic accuracy | MEDIUM | Heuristic-based detection will have both false positives (correctly non-PSR-4 code that is intentionally that way) and false negatives (complex autoloading configurations). The goal is signal, not certification. |

---

## What NOT to Do

| Pitfall | Why | Instead |
|---------|-----|---------|
| Upgrade tree-sitter-php to 0.24.x | Breaking changes in AST node types will require rewriting `PhpParser.mjs` `_findChild` calls and node type checks throughout `EnhancedLaravelParser.mjs`. The 0.22.6 grammar already handles all needed PHP syntax — PHP 8.4 features (property hooks, `new` without parens) are not needed for v1.2. | Stay on 0.22.6. Consider upgrade for v1.3 if PHP 8.4 support is explicitly requested. |
| Add `glayzzle/php-parser` alongside tree-sitter | Two parsing pipelines with different AST structures = double maintenance. Tree-sitter already produces the AST nodes needed for type inference. | Build TypeResolver on existing tree-sitter AST. |
| Build a full composer SAT solver | Composer already resolves dependencies. The lockfile IS the resolved state. Re-solving from scratch in Node.js would be thousands of lines of complex constraint solving code with no benefit over reading the lockfile. | Read `composer.lock` as the source of truth. Show resolved versions from the lockfile. |
| Full-control-flow type narrowing (if-branches) | Requires per-branch scope tracking, phi nodes, SSA construction — the PHPStan/Psalm approach. This is polyglot-level complexity. agentmap is a code-map tool, not a static analyzer. | Stick to unconditional assignments + declared types. Document the boundary. |
| Parse PHPDoc with a full DocParser | Full PHPDoc parsing (AST for DocBlocks, template resolution, nested generics) would require implementing or porting `phpstan/phpdoc-parser`. The annotations we need follow simple regex-parseable patterns. | Regex scanner for `@var`, `@return`, `@param`, `@method`, `@property`. Extend later if needed. |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: npm registry] — `semver@7.8.5`, `tree-sitter-php@0.22.6` (installed), `tree-sitter-php@0.24.2` (latest, breaking changes)
- [VERIFIED: npmjs.com/package/semver] — semver API reference: `satisfies`, `validRange`, `minVersion`, `maxSatisfying`
- [VERIFIED: github.com/tree-sitter/tree-sitter-php] — PHP grammar node types for v0.22.6: assignment_expression, object_creation_expression, member_call_expression, return_statement, formal_parameters, type_declaration
- [VERIFIED: getcomposer.org/doc/articles/versions.md] — Composer version constraint syntax: `^`, `~`, `*`, `||`, `--`, stability flags
- [VERIFIED: composer/composer composer.lock file] — Lockfile JSON schema: packages, packages-dev, content-hash, require, version, type, autoload
- [VERIFIED: getcomposer.org/doc/04-schema.md] — composer.json schema: autoload PSR-4/classmap, require, require-dev, conflict, replace, provide

### Secondary (MEDIUM confidence)
- [CITED: github.com/nikolai-vysotskyi/trace-mcp/commit/f114291] — Reference implementation: PHP type-aware call resolution in Node.js using tree-sitter. Same pattern (local type map, `$x = new Foo()` tracking, param types, return types, method chain resolution).
- [CITED: github.com/sen-ltd/composer-graph] — Reference implementation: lockfile-to-graph in PHP (zero dependencies). Proves the "direct JSON parse" approach works.
- [CITED: dev.to/sendotltd/read-composerlock-directly] — Technical article: "Read composer.lock Directly: A 1000-Line CLI That Beats composer show --tree". Schema: packages, packages-dev, platform, platform-dev.
- [CITED: node-semver README] — For Composer constraint differences documentation

### Tertiary (LOW confidence)
- PHPDoc regex pattern coverage assumptions — based on common PHP practices, not verified against a large corpus of PHPDoc data
- Tree-sitter-php 0.22.6 node type compatibility assumption — verified by reading grammar.json but not tested against all PHP syntax variants

---

*Stack research for: agentmap-php v1.2 — Composer Dependency Graph + PHP Type Resolution*
*Researched: 2026-06-21*
*Valid until: 2026-07-21 (30 days — packages stable)*
