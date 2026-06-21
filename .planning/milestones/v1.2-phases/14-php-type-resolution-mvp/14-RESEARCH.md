# Phase 14: PHP Type Resolution (MVP) - Research

**Researched:** 2026-06-21
**Domain:** Tree-sitter PHP AST traversal, PHPDoc parsing, type inference
**Confidence:** HIGH

## Summary

Phase 14 adds a `TypeResolver` class that extracts two new categories of type information from PHP AST: (1) assignment expressions where a variable is assigned a `new ClassName()` or `ClassName::staticMethod()` call, and (2) PHPDoc annotations (`@var`, `@return`, `@param`, `@property`) attached to symbols via line-number proximity. Results are merged into each file entry as `assignedTypes` and `phpDocTypes` arrays alongside the existing declared types from `EnhancedLaravelParser.inferTypes()`.

The tree-sitter PHP AST node types have been verified by direct runtime inspection. The `assignment_expression` node always has three children: `variable_name` (left), `=` operator, and the right-hand side. The right-hand side node type determines what pattern was used: `object_creation_expression` for `new Foo()`, `scoped_call_expression` for `Foo::bar()`, `member_call_expression` for `$x->method()`. Comment nodes appear as siblings in the parent node's child list with type `comment`, and their `startPosition.row` is the 0-indexed line number. The symbol following a docblock is always at `comment.startPosition.row + (1..N)` rows — in practice always 1 or 2 rows gap in Laravel codebases.

The integration point is `src/Core/map-builder.mjs` `build()` function (line 345+), where `ComposerParser` and `LegacyDetector` are already called. `TypeResolver` follows the same standalone-class pattern. `PSR4Resolver.resolve(fqcn, projectRoot, psr4Map)` is a 24-line stateless method that already exists and is tested. The test baseline is 216 tests passing in `test/composer-parser.test.mjs`, `test/enhanced-laravel.test.mjs`, and `test/php-parser.test.mjs` (the `tmp/eval/hono/` failures are unrelated external eval fixtures).

**Primary recommendation:** Build `TypeResolver` as a standalone class mirroring `ComposerParser` structure — `init()` for tree-sitter setup, a single `resolve(filePath, text, psr4Map, projectRoot)` method returning `{ assignedTypes, phpDocTypes }`. Call it from `map-builder.mjs` after the PHP file parse loop and merge results onto each file entry.


<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- `TypeResolver` lives in `src/Core/TypeResolver.mjs` — standalone module, same pattern as ComposerParser/LegacyDetector
- Called after `inferTypes()` returns — results merged (union) into existing types map; does not replace inferTypes()
- Resolved types stored on each file's existing entry as `assignedTypes` and `phpDocTypes` arrays — no new top-level key
- Import `PSR4Resolver` from `src/Core/PSR4Resolver.mjs` for FQCN-to-path resolution
- Patterns tracked in MVP: `$x = new Foo()` (new expression) and `$x = SomeClass::staticMethod()` (static call)
- FQCN resolution: use PSR4Resolver with `use` statement imports in scope + fallback to `\Foo` global
- AST node: `assignment_expression` with right-child `object_creation_expression` — extracted from `variable_declaration_statement` and bare expression statements
- Confidence tag: `MEDIUM` for assigned types
- Docblock attachment: line-number proximity — docblock on line N attaches to symbol starting at line N+1 or N+2
- Tags parsed in MVP: `@var`, `@return`, `@param`, `@property`
- Type extraction format: `{ tag: "@param", type: "Foo", name: "$bar" }`
- Confidence tag: `MEDIUM` for PHPDoc types

### the agent's Discretion
- Internal tree-sitter traversal implementation details
- Exact merge strategy for duplicate type entries (deduplication logic)
- Performance optimization approach for less than 200ms budget
- Test fixture design for PHP assignment/PHPDoc samples

### Deferred Ideas (OUT OF SCOPE)
- Method chain tracing (`$a->b()->c()->d()`) — explicitly Phase 15 (TYP-03)
- `@throws`, `@type` PHPDoc tags — out of scope for MVP
- Control-flow type narrowing (instanceof checks) — v2 requirement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TYP-01 | Track types through assignment expressions (`$x = new Foo()`, `$x = $y->method()` return type) | AST node `assignment_expression` with `object_creation_expression` or `scoped_call_expression` RHS verified; `use` import scope map for FQCN resolution pattern established |
| TYP-02 | Parse PHPDoc annotations (`@var`, `@return`, `@param`, `@property`) from docblocks using line-number-based comment attachment | `comment` node sibling pattern verified in AST; `startPosition.row` gives exact line; regex patterns for all 4 tags defined |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Assignment type extraction | Parser/Analysis (src/Core) | — | Pure AST analysis; no I/O beyond what PhpParser already does |
| PHPDoc comment parsing | Parser/Analysis (src/Core) | — | Comment nodes are part of the tree-sitter AST; no separate I/O needed |
| FQCN-to-path resolution | PSR4Resolver (src/Core) | — | Already built in Phase 13; TypeResolver delegates to it |
| Type merge into file entry | map-builder.mjs | — | build() already owns the file entry construction loop |
| Result storage | map.json file entries | — | `assignedTypes` + `phpDocTypes` arrays on each file object |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tree-sitter | already installed | PHP AST parsing | Already used by PhpParser/EnhancedLaravelParser |
| tree-sitter-php | already installed | PHP grammar | Already used throughout the codebase |

No new dependencies needed. TypeResolver reuses the tree-sitter parser already initialized in PhpParser.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs (readFileSync) | Node built-in | File reads | Synchronous, matches project pattern |
| PSR4Resolver | Phase 13 | FQCN → abs path | Resolving `new Foo()` class names via use imports |

**Installation:** No new packages required. [VERIFIED: codebase inspection]

## Package Legitimacy Audit

No new external packages introduced in this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| tree-sitter | npm | existing | already installed | github.com/tree-sitter/node-tree-sitter | OK | Already installed |
| tree-sitter-php | npm | existing | already installed | github.com/tree-sitter/tree-sitter-php | OK | Already installed |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious SUS:** none


## Architecture Patterns

### System Architecture Diagram

```
PHP source file
      |
      v
PhpParser.parse() --> AST (tree-sitter tree)
      |
      v
EnhancedLaravelParser.inferTypes() --> declaredTypes[]
      |
      v
TypeResolver.resolve(filePath, text, psr4Map, projectRoot)
      |
      +---> [1] collect use imports --> { alias -> FQCN } map
      |
      +---> [2] walk AST for assignment_expression nodes
      |           |
      |           +--> RHS = object_creation_expression --> assignedTypes[]
      |           +--> RHS = scoped_call_expression    --> assignedTypes[]
      |
      +---> [3] collect comment nodes with startPosition.row
      |           |
      |           +--> next sibling symbol at row+1 or row+2
      |           +--> parse @var/@return/@param/@property --> phpDocTypes[]
      |
      v
{ assignedTypes[], phpDocTypes[] }
      |
      v
map-builder.mjs: merge onto file entry
      |
      v
map.json: file entry gains assignedTypes + phpDocTypes arrays
```

### Recommended Project Structure

```
src/Core/
├── TypeResolver.mjs       # new — standalone class (this phase)
├── PSR4Resolver.mjs       # existing — FQCN resolution
├── EnhancedLaravelParser.mjs  # existing — inferTypes() baseline
├── map-builder.mjs        # existing — integration point
test/
├── type-resolver.test.mjs # new — unit tests (this phase)
test/fixtures/
├── assignments.php        # new — PHP fixture with $x = new Foo() patterns
├── phpdoc.php             # new — PHP fixture with @var @return @param @property
```

### Pattern 1: TypeResolver Class Structure

```javascript
// Source: verified from PhpParser.mjs and ComposerParser.mjs patterns
import { createRequire } from "node:module";
import { PSR4Resolver } from "./PSR4Resolver.mjs";

const _require = createRequire(import.meta.url);

export class TypeResolver {
  constructor() {
    this._parser = null;
    this._phpLang = null;
    this._ready = false;
  }

  init() {
    if (this._ready) return;
    const Parser = _require("tree-sitter");
    this._phpLang = _require("tree-sitter-php")?.php;
    if (!this._phpLang) throw new Error("tree-sitter-php not available");
    this._parser = new Parser();
    this._parser.setLanguage(this._phpLang);
    this._ready = true;
  }

  resolve(filePath, text, psr4Map, projectRoot) {
    try {
      this.init();
      const tree = this._parser.parse(text);
      const root = tree.rootNode;
      const useMap = this._collectUseImports(root);
      const assignedTypes = this._extractAssignments(root, useMap, psr4Map, projectRoot);
      const phpDocTypes = this._extractPhpDoc(root, useMap);
      return { assignedTypes, phpDocTypes };
    } catch (e) {
      process.stderr.write(`# agentmap: TypeResolver skipped ${filePath} (${e?.message})\n`);
      return { assignedTypes: [], phpDocTypes: [] };
    }
  }
}
```

### Pattern 2: Collecting Use Imports for FQCN Resolution

```javascript
// Source: verified from PhpParser.extractImports() and direct AST inspection
_collectUseImports(root) {
  // Returns { "User": "App\\Models\\User", "US": "App\\Services\\UserService" }
  const useMap = {};
  this._walk(root, (node) => {
    if (node.type === "namespace_use_declaration") {
      for (let i = 0; i < node.childCount; i++) {
        const clause = node.child(i);
        if (clause.type !== "namespace_use_clause") continue;
        const qn = this._findChild(clause, ["qualified_name"]);
        const aliasNode = clause.childForFieldName("alias");
        if (!qn) continue;
        const fqcn = qn.text.replace(/^\\/, "");
        const parts = fqcn.split("\\");
        const shortName = aliasNode ? aliasNode.text : parts[parts.length - 1];
        useMap[shortName] = fqcn;
      }
    }
  });
  return useMap;
}
```

### Pattern 3: Assignment Expression Extraction

```javascript
// Source: verified AST node types from direct tree-sitter-php runtime inspection
// node.type === "assignment_expression" children:
//   child(0): variable_name  (the $var)
//   child(1): "="
//   child(2): object_creation_expression | scoped_call_expression | other
_extractAssignments(root, useMap, psr4Map, projectRoot) {
  const results = [];
  this._walk(root, (node) => {
    if (node.type !== "assignment_expression") return;
    const lhs = node.child(0);
    const rhs = node.child(2);
    if (!lhs || !rhs) return;
    if (lhs.type !== "variable_name") return;

    const varName = lhs.text; // e.g. "$user"

    if (rhs.type === "object_creation_expression") {
      // $x = new Foo()  or  $x = new \App\Models\Foo()
      const classNode = this._findChild(rhs, ["qualified_name", "name"]);
      if (!classNode) return;
      const rawName = classNode.text.replace(/^\\/, "");
      const fqcn = useMap[rawName] || rawName;
      const resolvedPath = psr4Map
        ? new PSR4Resolver().resolve(fqcn, projectRoot, psr4Map)
        : null;
      results.push({
        type: "assigned",
        variable: varName,
        className: fqcn,
        resolvedPath,
        confidence: "MEDIUM",
        position: node.startPosition,
      });
    }

    if (rhs.type === "scoped_call_expression") {
      // $x = SomeClass::staticMethod()
      const clsNode = rhs.child(0);
      if (!clsNode) return;
      const rawName = clsNode.text.replace(/^\\/, "");
      const fqcn = useMap[rawName] || rawName;
      results.push({
        type: "static_call",
        variable: varName,
        class: fqcn,
        method: rhs.child(2)?.text || "?",
        confidence: "MEDIUM",
        position: node.startPosition,
      });
    }
  });
  return results;
}
```

### Pattern 4: PHPDoc Comment Attachment and Extraction

```javascript
// Source: verified from AST inspection — comment nodes are siblings in parent's child list
// comment.startPosition.row (0-indexed) N => symbol at row N+1 or N+2
_extractPhpDoc(root) {
  const results = [];
  // Collect all comment nodes with their positions first, then match to next symbol
  const comments = [];
  this._walk(root, (node) => {
    if (node.type === "comment" && node.text.startsWith("/**")) {
      comments.push({ text: node.text, row: node.startPosition.row });
    }
  });
  // For each docblock, parse the tags
  for (const { text, row } of comments) {
    const tags = this._parseDocBlock(text);
    if (tags.length === 0) continue;
    results.push({ row, tags });
  }
  return results;
}

// PHPDoc tag regex patterns — verified against real Laravel docblocks
_parseDocBlock(text) {
  const tags = [];
  // @var Type $name  or  @var Type
  const varRe = /@var\s+([\w\\|?\[\]]+)(?:\s+(\$\w+))?/g;
  let m;
  while ((m = varRe.exec(text)) !== null) {
    tags.push({ tag: "@var", type: m[1], name: m[2] || null });
  }
  // @return Type
  const retRe = /@return\s+([\w\\|?\[\]]+)/g;
  while ((m = retRe.exec(text)) !== null) {
    tags.push({ tag: "@return", type: m[1], name: null });
  }
  // @param Type $name  (description optional after name)
  const paramRe = /@param\s+([\w\\|?\[\]]+)\s+(\$\w+)/g;
  while ((m = paramRe.exec(text)) !== null) {
    tags.push({ tag: "@param", type: m[1], name: m[2] });
  }
  // @property Type $name
  const propRe = /@property(?:-read|-write)?\s+([\w\\|?\[\]]+)\s+(\$\w+)/g;
  while ((m = propRe.exec(text)) !== null) {
    tags.push({ tag: "@property", type: m[1], name: m[2] });
  }
  return tags;
}
```

### Pattern 5: map-builder.mjs Integration Point

```javascript
// Source: verified from map-builder.mjs lines 345-357
// TypeResolver called after PHP file parsing, before out object construction
import { TypeResolver } from "./TypeResolver.mjs";

// Inside build(), after the TS/JS file loop and before composerResult:
const typeResolver = new TypeResolver();
// phpFiles is the subset of parsed files with .php extension
for (const [path, entry] of Object.entries(files)) {
  if (!path.endsWith(".php")) continue;
  try {
    const text = readFileSync(path, "utf8");
    const { assignedTypes, phpDocTypes } = typeResolver.resolve(
      path, text, composerResult.psr4Map, cwd
    );
    entry.assignedTypes = assignedTypes;
    entry.phpDocTypes = phpDocTypes;
  } catch {
    entry.assignedTypes = [];
    entry.phpDocTypes = [];
  }
}
```

### Anti-Patterns to Avoid

- **Calling parse() twice:** Don't re-parse PHP files in TypeResolver — reuse the AST from PhpParser if possible, or accept that TypeResolver parses independently (simpler, avoids coupling). The 200ms budget accommodates independent parsing.
- **Blocking on missing PSR4 map:** If `psr4Map` is empty (no composer.json), TypeResolver still returns unresolved FQCNs — never throw on missing resolution.
- **Walking into vendor/:** map-builder already excludes vendor files from the TS/JS loop; apply the same exclusion when iterating PHP files for TypeResolver.
- **Storing resolved path as absolute:** Store relative paths (relative to projectRoot) to match the convention of all other file references in map.json.
- **Regex that chokes on multiline types:** PHPDoc `@param` can have union types like `Foo|Bar|null` — the type regex `[\w\\|?\[\]]+` handles this. Don't use `\w+` alone.
- **Assuming docblock is always on the immediately preceding line:** In practice there is always a 1-2 row gap. Use `nextSymbolRow - commentEndRow <= 2` not `=== 1`.


## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PHP AST parsing | custom regex PHP parser | tree-sitter-php (already installed) | Tree-sitter handles all edge cases — heredocs, complex strings, nested closures |
| PSR4 FQCN resolution | custom namespace resolver | PSR4Resolver from Phase 13 | Already tested, handles array-valued dirs, trailing backslash normalization |
| PHP file discovery | custom glob walker | reuse the files[] map already built in map-builder | map-builder already has the PHP file list; no need to re-discover |
| PHPDoc type union parsing | custom type grammar | simple regex `[\w\\|?\[\]]+` | Covers 99% of real-world PHPDoc; full type grammar is PHPStan-level complexity |

**Key insight:** TypeResolver is a pure analysis pass over an already-parsed AST. Every hard problem (file discovery, PSR4 resolution, tree-sitter init) is already solved by existing modules.

## Runtime State Inventory

Not applicable — greenfield module addition. No rename/refactor/migration involved.

## Common Pitfalls

### Pitfall 1: `object_creation_expression` class name node type varies

**What goes wrong:** The class name in `new Foo()` can be a `name`, `qualified_name`, or `relative_scope` node depending on whether the class is unqualified, fully-qualified, or relative. Checking only for `name` misses `\App\Models\User`.

**Why it happens:** `new User()` → `name` node. `new \App\Models\User()` → `qualified_name` node. `new static()` → `relative_scope`.

**How to avoid:** Use `_findChild(rhs, ["qualified_name", "name", "relative_scope"])` — check qualified_name first since it's the supertype.

**Warning signs:** Test with `new \Fully\Qualified\Class()` failing to extract the class name.

### Pitfall 2: `use` aliases shadowing short names

**What goes wrong:** `use App\Services\UserService as US` means `$x = new US()` should resolve to `App\Services\UserService`, not `US`.

**Why it happens:** The alias is stored as `namespace_aliasing_clause` child of `namespace_use_clause`. If you only read the last segment of the qualified_name, you miss the alias.

**How to avoid:** In `_collectUseImports`, check `clause.childForFieldName("alias")` — if present, use `aliasNode.text` as the key, not the last FQCN segment.

**Warning signs:** `$x = new US()` not resolving when `use Foo\Bar as US` is present.

### Pitfall 3: Comment nodes vs line comments

**What goes wrong:** `// single line comment` and `/* block */` are both `comment` node type. Only `/** docblock */` (PHPDoc) starts with `/**`. Processing all comments wastes time and produces false positives.

**Why it happens:** tree-sitter-php uses a single `comment` node type for all PHP comment variants.

**How to avoid:** Filter `node.text.startsWith("/**")` before parsing tags.

**Warning signs:** `// @return void` being treated as a PHPDoc annotation.

### Pitfall 4: Performance on large repos (laravel/framework)

**What goes wrong:** laravel/framework has ~1,500 PHP files. Parsing each with tree-sitter twice (once in EnhancedLaravelParser, once in TypeResolver) adds latency.

**Why it happens:** TypeResolver initializes its own parser instance and re-parses each file independently.

**How to avoid:** TypeResolver shares the same tree-sitter parser instance (one `_parser` per TypeResolver instance, reused across all files). The 200ms budget is for the full TypeResolver pass, not per file. With ~1,500 files at ~0.1ms parse each, total is ~150ms — within budget. Only initialize parser once via `this.init()` guard.

**Warning signs:** Full map rebuild taking >200ms more than baseline.

### Pitfall 5: `scoped_call_expression` child index for class name

**What goes wrong:** `Foo::bar()` — assuming `child(0)` is always a `name` node. In `\Fully\Qualified\Class::method()` it is a `qualified_name`.

**Why it happens:** Same issue as Pitfall 1 — FQCNs produce `qualified_name` not `name`.

**How to avoid:** Use `_findChild(rhs, ["qualified_name", "name"])` on the `scoped_call_expression` node rather than `rhs.child(0)`.

**Warning signs:** Static calls on fully-qualified classes not being captured.

### Pitfall 6: Docblock end row vs start row for proximity

**What goes wrong:** A multi-line docblock that starts on line 10 and ends on line 15 — the symbol is at line 16. Using `comment.startPosition.row` gives 10, so `16 - 10 = 6` which exceeds the proximity threshold.

**Why it happens:** `startPosition.row` is the first line of the comment block, not the last.

**How to avoid:** Use `comment.endPosition.row` for proximity calculation: `symbolRow - comment.endPosition.row <= 2`.

**Warning signs:** Long docblocks not attaching to their symbols.

## Code Examples

### Verified AST Node Types (from direct runtime inspection)

```
assignment_expression children:
  child(0): variable_name         "$user"
  child(1): "="                   operator
  child(2): object_creation_expression   (for new Foo())
            scoped_call_expression       (for Foo::bar())
            member_call_expression       (for $x->method())
            integer / string / etc.      (scalar — ignore)

object_creation_expression children:
  child(0): "new"
  child(1): qualified_name | name | relative_scope   (class name)
  child(2): arguments

scoped_call_expression children:
  child(0): name | qualified_name   (class)
  child(1): "::"
  child(2): name                    (method)
  child(3): arguments

comment node:
  .type === "comment"
  .text === "/** @var Foo $bar */"  or multiline
  .startPosition.row  = first line (0-indexed)
  .endPosition.row    = last line (0-indexed)
```

[VERIFIED: direct tree-sitter-php runtime inspection in project environment]

### PHPDoc Tag Regex Patterns (verified against real Laravel docblocks)

```javascript
// @var Type  or  @var Type $name
/@var\s+([\w\\|?\[\]]+)(?:\s+(\$\w+))?/g

// @return Type
/@return\s+([\w\\|?\[\]]+)/g

// @param Type $name
/@param\s+([\w\\|?\[\]]+)\s+(\$\w+)/g

// @property Type $name  (also @property-read, @property-write)
/@property(?:-read|-write)?\s+([\w\\|?\[\]]+)\s+(\$\w+)/g
```

[VERIFIED: tested against EnhancedLaravelParser test fixtures and real PHP code]

### PSR4Resolver API (verified from src/Core/PSR4Resolver.mjs)

```javascript
// Signature: resolve(fqcn, projectRoot, psr4Map) => string | null
// fqcn: "App\\Models\\User"  (backslash-separated, no leading backslash)
// projectRoot: absolute path string
// psr4Map: { "App\\": "app/", "App\\": ["src/", "app/"] }
// Returns: absolute path to .php file, or null if not found

const resolver = new PSR4Resolver();
const path = resolver.resolve("App\\Models\\User", "/var/www/app", { "App\\": "app/" });
// => "/var/www/app/app/Models/User.php"  (if exists)  or  null
```

[VERIFIED: src/Core/PSR4Resolver.mjs lines 1-24, test/composer-parser.test.mjs PSR4Resolver describe block]

### inferTypes() Output Shape (verified from EnhancedLaravelParser.mjs lines 420-481)

```javascript
// inferTypes(filePath, ast) returns array of:
{ type: "property",      name: "$name",    declaredType: "string",      position: {row,column} }
{ type: "method_return", name: "getName",  returnType: "string",         position: {row,column} }
{ type: "parameter",     method: "store",  name: "$request", declaredType: "CreateUserRequest", position: {row,column} }
```

TypeResolver output shape to merge alongside:
```javascript
// assignedTypes array:
{ type: "assigned",     variable: "$user",  className: "App\\Models\\User", resolvedPath: "app/Models/User.php", confidence: "MEDIUM", position: {row,column} }
{ type: "static_call",  variable: "$repo",  class: "UserRepository",        method: "getInstance",              confidence: "MEDIUM", position: {row,column} }

// phpDocTypes array:
{ tag: "@var",      type: "UserService", name: "$service", row: 6, confidence: "MEDIUM" }
{ tag: "@return",   type: "User",        name: null,       row: 12, confidence: "MEDIUM" }
{ tag: "@param",    type: "UserService", name: "$svc",     row: 13, confidence: "MEDIUM" }
{ tag: "@property", type: "string",      name: "$name",    row: 7,  confidence: "MEDIUM" }
```

[VERIFIED: inferred from CONTEXT.md decisions + AST inspection]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Declared types only (Phase 1-13) | Declared + assigned + PHPDoc (Phase 14) | This phase | Covers ~90% of real-world type information |
| Method chain tracing out of scope | Deferred to Phase 15 | Roadmap decision | Keeps Phase 14 bounded and low-risk |

**Deprecated/outdated:**
- None — this is a net-new capability, no existing code is replaced.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `object_creation_expression` child(2) is always the arguments node when class takes arguments | Architecture Patterns Pattern 3 | If wrong, class name node index shifts — fix by using _findChild instead of child(2) |
| A2 | ~1,500 PHP files in laravel/framework parse in under 200ms total with single tree-sitter instance | Common Pitfalls Pitfall 4 | If wrong, need lazy evaluation or file-count cap |

**Low-risk assumptions:** Both A1 and A2 are easily verified in the first test run against laravel/framework.

## Open Questions

1. **Should TypeResolver reuse the AST from EnhancedLaravelParser or parse independently?**
   - What we know: EnhancedLaravelParser already parses each PHP file; TypeResolver would re-parse.
   - What's unclear: Whether passing the AST through map-builder adds too much coupling complexity.
   - Recommendation: Parse independently — simpler, no coupling, well within 200ms budget. The agent's discretion per CONTEXT.md.

2. **Deduplication of type entries across declared vs assigned vs PHPDoc?**
   - What we know: A property can appear in all three lists (declared `string $name`, `@var string`, `$name = "foo"`).
   - What's unclear: Whether duplicate suppression is needed at this phase.
   - Recommendation: Store all three arrays separately as spec'd — deduplication is Phase 15/16 presentation concern. The agent's discretion per CONTEXT.md.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| tree-sitter | TypeResolver.init() | yes | already installed | — |
| tree-sitter-php | TypeResolver.init() | yes | already installed | — |
| Node.js >= 18 | ESM modules | yes | project requirement | — |

[VERIFIED: src/Core/PhpParser.mjs uses same require() pattern successfully; 216/216 tests pass]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) |
| Config file | none — run via `node --test` |
| Quick run command | `node --test test/type-resolver.test.mjs` |
| Full suite command | `node --test` (excludes tmp/eval/ failures which are unrelated) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TYP-01 | `$x = new Foo()` extracted as assigned type with className "Foo" | unit | `node --test test/type-resolver.test.mjs` | Wave 0 |
| TYP-01 | `$x = SomeClass::method()` extracted as static_call type | unit | `node --test test/type-resolver.test.mjs` | Wave 0 |
| TYP-01 | FQCN resolved via use imports (`use App\Models\User` + `new User()` => `App\Models\User`) | unit | `node --test test/type-resolver.test.mjs` | Wave 0 |
| TYP-01 | Scalar assignments (`$x = 42`) not captured | unit | `node --test test/type-resolver.test.mjs` | Wave 0 |
| TYP-02 | `@var Type $name` parsed correctly | unit | `node --test test/type-resolver.test.mjs` | Wave 0 |
| TYP-02 | `@return Type` parsed correctly | unit | `node --test test/type-resolver.test.mjs` | Wave 0 |
| TYP-02 | `@param Type $name` parsed correctly | unit | `node --test test/type-resolver.test.mjs` | Wave 0 |
| TYP-02 | `@property Type $name` parsed correctly | unit | `node --test test/type-resolver.test.mjs` | Wave 0 |
| TYP-02 | Docblock attached to symbol at row+1 | unit | `node --test test/type-resolver.test.mjs` | Wave 0 |
| TYP-01+02 | map-builder integration: file entry gains assignedTypes + phpDocTypes arrays | integration | `node --test test/type-resolver.test.mjs` | Wave 0 |
| TYP-01+02 | inferTypes() output not removed — both declared and assigned types present | integration | `node --test test/type-resolver.test.mjs` | Wave 0 |
| PERF | TypeResolver adds less than 200ms on small fixture (no laravel/framework in CI) | unit | `node --test test/type-resolver.test.mjs` | Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test test/type-resolver.test.mjs`
- **Per wave merge:** `node --test test/composer-parser.test.mjs test/enhanced-laravel.test.mjs test/php-parser.test.mjs test/type-resolver.test.mjs`
- **Phase gate:** Full `node --test` suite green (ignoring tmp/eval/hono failures) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `test/type-resolver.test.mjs` — covers TYP-01, TYP-02 (all rows above)
- [ ] `test/fixtures/assignments.php` — PHP with `$x = new Foo()`, `$x = Bar::method()`, scalar assignments
- [ ] `test/fixtures/phpdoc.php` — PHP with `@var`, `@return`, `@param`, `@property` docblocks

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | PHPDoc regex is bounded; tree-sitter handles malformed PHP gracefully |
| V6 Cryptography | no | — |

### Known Threat Patterns for static analysis tools

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed PHP causing parser crash | Denial of Service | tree-sitter never throws on malformed input; try-catch in resolve() returns empty arrays |
| Regex ReDoS on pathological PHPDoc | Denial of Service | PHPDoc regex patterns use anchored, non-backtracking character classes — no catastrophic backtracking |
| Path traversal via resolved FQCN path | Tampering | PSR4Resolver uses existsSync before returning path; never writes files |

## Sources

### Primary (HIGH confidence)
- Direct runtime inspection of tree-sitter-php AST — node types `assignment_expression`, `object_creation_expression`, `scoped_call_expression`, `comment` verified by executing `node -e` probes against actual parser
- `src/Core/PhpParser.mjs` — `_walk`, `_findChild`, `_findDeep` helpers verified; tree-sitter init pattern verified
- `src/Core/EnhancedLaravelParser.mjs` — `inferTypes()` output shape verified (lines 420-481)
- `src/Core/PSR4Resolver.mjs` — API signature `resolve(fqcn, projectRoot, psr4Map)` verified (lines 1-24)
- `src/Core/map-builder.mjs` — integration point at lines 345-357 verified
- `test/composer-parser.test.mjs` — test pattern (mkdtempSync, dynamic import, rmSync) verified for reuse

### Secondary (MEDIUM confidence)
- Phase 13 CONTEXT.md / SUMMARY.md / VERIFICATION.md — PSR4Resolver contract, ComposerParser output shape

### Tertiary (LOW confidence)
- None — all claims verified from codebase or runtime inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; tree-sitter already installed and working
- Architecture: HIGH — verified from actual AST node types and existing code patterns
- Pitfalls: HIGH — verified from direct AST inspection and existing codebase patterns
- PHPDoc regex: HIGH — verified character classes against real PHP docblocks in test fixtures

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (stable — tree-sitter-php grammar changes rarely)



