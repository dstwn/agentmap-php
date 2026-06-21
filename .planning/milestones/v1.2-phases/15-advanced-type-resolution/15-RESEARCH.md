# Phase 15: Advanced Type Resolution - Research

**Researched:** 2026-06-21
**Domain:** tree-sitter PHP AST traversal, method chain resolution, type confidence system
**Confidence:** HIGH


<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Extend `TypeResolver.mjs` with a `resolveChain()` method — keeps all type resolution in one module
- Default chain depth limit: 3 — captures most fluent builder patterns without runaway
- Algorithm: look up `b()` return type in PSR4Resolver-resolved `Foo` AST, then `c()` return in that result — depth-first walk
- Stop chain at first unknown type, emit `LOW` confidence for partial results
- `confidence` field on each type entry: `{ type: "Foo", confidence: "HIGH", source: "declared" }`
- Backfill Phase 14 `assignedTypes` and `phpDocTypes` entries with `confidence: "MEDIUM"` in this phase
- Existing `enhanced.types` entries (from inferTypes()) get `confidence: "HIGH"` + `source: "declared"`
- Default output: HIGH+MEDIUM only; `--all` flag reveals LOW (flag wired in Phase 16)
- `DEFAULT_CHAIN_DEPTH = 3` constant in `constants.mjs`, overridable via map.json config key `chainDepth`
- At depth limit: log warning to stderr + mark result `LOW` confidence
- Cycle prevention: Set of visited class+method pairs per resolution call — break with LOW on revisit
- PHP fixtures: 1-level, 2-level, 3-level, and >3-level chains to verify truncation behavior

### the agent's Discretion

- Internal AST traversal implementation for method return type lookup
- Exact shape of visited-pairs tracking (string key format for the Set)
- Warning message exact wording
- Fixture file structure and test case distribution

### Deferred Ideas (OUT OF SCOPE)

- `--all` CLI flag (Phase 16 wires all CLI flags)
- `--chain-depth N` CLI override (Phase 16)
- Control-flow type narrowing (v2 per REQUIREMENTS.md)
- Cross-file chain resolution beyond PSR4Resolver lookup
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TYP-03 | Trace types through method chains (`$a->b()->c()->d()`) with configurable depth limit | AST node `member_call_expression` confirmed; depth-first walk via PSR4Resolver file lookup; return type from `named_type`/`optional_type` child of `method_declaration` |
| TYP-04 | Tag every resolved type with confidence level — HIGH (declared), MEDIUM (assigned/new/PHPDoc), LOW (inferred through chains) | Phase 14 already emits `confidence: "MEDIUM"`; `inferTypes()` entries lack confidence field and need backfill; chain-inferred entries get `confidence: "LOW"` |
</phase_requirements>

## Summary

Phase 15 extends the existing `TypeResolver` class with two tightly coupled capabilities: fluent method chain tracing and a uniform confidence level system. Both capabilities are pure in-process computation — no new packages, no new I/O patterns, no new external dependencies. All the hard infrastructure (tree-sitter parser, PSR4Resolver, agentmap.mjs integration block) already exists from Phase 14.

The key technical challenge is the chain walk: given `$a->method1()->method2()->method3()`, the tree-sitter AST nests left-recursively — the outermost `member_call_expression` wraps the inner chain. Walking the chain means recursively peeling the object child. For each step, we need to find the class file via PSR4Resolver, parse it fresh, and extract the return type declared on the target method. Return types sit as `named_type`, `optional_type`, `union_type`, or `primitive_type` children of `method_declaration` nodes — confirmed via live AST inspection.

The confidence backfill is straightforward: Phase 14 code already emits `confidence: "MEDIUM"` on all `assignedTypes` and `phpDocTypes` entries. The `enhanced.types` array from `inferTypes()` does not carry a `confidence` field — the backfill step adds `confidence: "HIGH"` and `source: "declared"` to each entry in that array inside the agentmap.mjs loop.

**Primary recommendation:** Implement `resolveChain()` as a standalone private method group on `TypeResolver`, parsing target class files on-demand with the same cached `_parser` instance. Cache parsed class ASTs by file path within a single `resolveChain()` call to avoid re-parsing the same file at every chain step.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chain AST traversal | TypeResolver.mjs | — | All type resolution in one module (locked decision) |
| Return type extraction from class AST | TypeResolver.mjs | — | Pure tree-sitter work, same parser instance |
| Class file lookup | PSR4Resolver.mjs | — | Already used in Phase 14 for FQCN-to-path |
| Confidence backfill (inferTypes entries) | agentmap.mjs build() | — | inferTypes() output lives in enhanced.types; enrichment block in agentmap.mjs is the established pattern |
| chainTypes on file entries | agentmap.mjs build() | — | Same TypeResolver loop block from Phase 14 |
| Depth constant | constants.mjs | — | Project-wide constants file; established pattern |
| Config key override (chainDepth) | agentmap.mjs config read | — | map.json config key, same as other config keys |


## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tree-sitter | already installed | PHP AST parsing | Already in use; same `_parser` instance reused in TypeResolver |
| tree-sitter-php | already installed | PHP grammar | Already in use; `this._phpLang` available via `createRequire` |

No new packages. [VERIFIED: codebase — package.json + TypeResolver.mjs]

### Supporting

None. PSR4Resolver is already imported in TypeResolver.mjs.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing `this._parser` for chain file parsing | Spawning a new Parser per file | Reuse is cheaper; same grammar, same guard pattern |
| Flat `Set<string>` for visited tracking | Map or object | Set is O(1) membership; string key `"ClassName::methodName"` is sufficient |

**Installation:** None required.

## Package Legitimacy Audit

No new packages in this phase. Section not applicable.

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious SUS:** none

## Architecture Patterns

### System Architecture Diagram

```
PHP source text
      │
      ▼
TypeResolver.resolve(filePath, text, psr4Map, projectRoot)
      │
      ├── _collectUseImports(root) → useMap{ alias → FQCN }
      ├── _extractAssignments(root, useMap, ...) → assignedTypes[] { confidence: MEDIUM }
      ├── _extractPhpDoc(root) → phpDocTypes[] { confidence: MEDIUM }
      └── resolveChain(root, useMap, psr4Map, projectRoot, depth)
                │
                ▼
         walk assignment_expression RHS for member_call_expression
                │
                ▼
         _peelChain(node) → ordered list of { object, method } steps
                │
                ▼
         step 0: resolve object variable type from assignedTypes
                │
                ▼
         for each step: PSR4Resolver.resolve(FQCN) → class file path
                │       readFileSync → parse → _findMethodReturnType(ast, methodName)
                │
                ├─ depth limit hit → warn stderr, emit LOW
                ├─ cycle detected (visited Set) → break, emit LOW
                ├─ file not found / return type unknown → stop chain
                └─ return type found → next step, depth+1
                │
                ▼
         chainTypes[] { variable, chain[], resolvedType, confidence: LOW, source: "chain" }

agentmap.mjs build()
      │
      ├── existing TypeResolver loop → entry.assignedTypes, entry.phpDocTypes
      ├── NEW: entry.chainTypes from resolveChain()
      └── NEW: backfill enhanced.types[] with confidence: HIGH, source: declared
```

### Recommended Project Structure

No new directories. Changes are additive to existing files:

```
src/Core/
├── TypeResolver.mjs     # add resolveChain(), _peelChain(), _findMethodReturnType()
└── constants.mjs        # add DEFAULT_CHAIN_DEPTH = 3
test/
├── type-resolver.test.mjs          # extend with chain + confidence tests
└── fixtures/
    ├── assignments.php              # existing
    ├── phpdoc.php                   # existing
    └── chains.php                   # NEW: 1/2/3/>3-level chain fixtures
        chains/
        └── (optional sub-fixtures for multi-file chain resolution)
agentmap.mjs             # backfill enhanced.types, add chainTypes to loop
```

### Pattern 1: member_call_expression Chain AST Structure

**What:** tree-sitter nests method chains left-recursively. `$a->b()->c()->d()` produces:

```
member_call_expression          ← outermost ($a->b()->c()->d())
  member_call_expression        ← ($a->b()->c())
    member_call_expression      ← ($a->b())
      variable_name $a
      -> 
      name "b"
      arguments ()
    ->
    name "c"
    arguments ()
  ->
  name "d"
  arguments ()
```

[VERIFIED: live tree-sitter AST dump in this session]

**When to use:** When extracting the ordered chain of calls from a RHS expression.

**Example:**

```javascript
// Source: verified via live AST dump
_peelChain(node) {
  // node is the outermost member_call_expression
  const steps = [];
  let cur = node;
  while (cur.type === "member_call_expression") {
    // child(0) = object (another member_call_expression or variable_name)
    // child(1) = "->"
    // child(2) = name (method name)
    // child(3) = arguments
    const methodNode = cur.child(2);
    steps.unshift({ method: methodNode?.text ?? "?", node: cur });
    cur = cur.child(0);
  }
  // cur is now the root object (variable_name, $this, etc.)
  return { rootObject: cur, steps };
}
```

### Pattern 2: Method Return Type Extraction

**What:** `method_declaration` children include a return type node. Three possible node types: [VERIFIED: live AST dump]

| Return type syntax | AST node type | Extract via |
|--------------------|---------------|-------------|
| `function foo(): Bar` | `named_type` | `.text` directly — may be `qualified_name` child |
| `function foo(): ?Bar` | `optional_type` | inner `named_type` child: `node.child(1).text` |
| `function foo(): Foo\|null` | `union_type` | `.text` gives `"Foo\|null"` — split on `\|`, filter nulls |
| `function foo(): int` | `named_type` or `primitive_type` | `.text` — detect scalar to skip |
| `function foo(): static` | `named_type` | `.text === "static"` → resolve to current class |
| `function foo(): self` | `named_type` | `.text === "self"` → resolve to current class |
| `function foo()` (no return) | absent | no type node found → unknown |

**Example:**

```javascript
// Source: verified via live AST dump
_findMethodReturnType(root, methodName) {
  let found = null;
  this._walk(root, (node) => {
    if (node.type !== "method_declaration") return;
    const nameNode = this._findChild(node, ["name"]);
    if (nameNode?.text !== methodName) return;
    for (let i = 0; i < node.childCount; i++) {
      const c = node.child(i);
      if (c.type === "named_type" || c.type === "primitive_type") {
        found = c.text.replace(/^\\/, "");
        break;
      }
      if (c.type === "optional_type") {
        // ?Bar → extract inner named_type
        const inner = this._findChild(c, ["named_type"]);
        found = inner ? inner.text.replace(/^\\/, "") : null;
        break;
      }
      if (c.type === "union_type") {
        // Foo|null → take first non-null, non-scalar type
        const parts = c.text.split("|").map(s => s.trim().replace(/^\\/, ""));
        found = parts.find(t => t !== "null" && t !== "void" && !/^(int|string|bool|float|array|mixed)$/.test(t)) ?? null;
        break;
      }
    }
  });
  return found; // null = no declared return type
}
```

### Pattern 3: resolveChain() Top-Level Method

**What:** Entry point — called per file, returns `chainTypes[]` array.

```javascript
// Source: derived from Phase 14 patterns + AST research
resolveChain(root, useMap, assignedTypes, psr4Map, projectRoot, depthLimit = 3) {
  const results = [];
  this._walk(root, (node) => {
    if (node.type !== "assignment_expression") return;
    const lhs = node.child(0);
    const rhs = node.child(2);
    if (!lhs || rhs?.type !== "member_call_expression") return;
    const variable = lhs.text;
    const { rootObject, steps } = this._peelChain(rhs);
    // Resolve the root object's type from assignedTypes
    const rootType = assignedTypes.find(e => e.variable === rootObject.text)?.className;
    if (!rootType) return;
    const visited = new Set();
    const chain = this._walkChain(rootType, steps, useMap, psr4Map, projectRoot, depthLimit, visited);
    if (chain.length > 0) {
      results.push({
        variable,
        chain,
        resolvedType: chain[chain.length - 1].returnType,
        confidence: "LOW",
        source: "chain",
      });
    }
  });
  return results;
}
```

### Pattern 4: Confidence Backfill in agentmap.mjs

**What:** `enhanced.types` from `inferTypes()` lacks confidence field. Backfill in the existing TypeResolver enrichment block.

```javascript
// Inside the TypeResolver loop in agentmap.mjs build()
// Existing:
entry.assignedTypes = assignedTypes;
entry.phpDocTypes = phpDocTypes;
// NEW: add chainTypes
entry.chainTypes = chainTypes;
// NEW: backfill enhanced.types with confidence + source
if (entry.enhanced?.types) {
  entry.enhanced.types = entry.enhanced.types.map(t => ({
    ...t,
    confidence: "HIGH",
    source: "declared",
  }));
}
```

### Pattern 5: Cycle Prevention Set Key Format

**What:** Visited set tracks `"ClassName::methodName"` strings to prevent infinite loops in circular type graphs.

```javascript
const key = `${currentClass}::${methodName}`;
if (visited.has(key)) {
  // emit LOW, stop chain
  return;
}
visited.add(key);
```

**Rationale:** Simple string key. No class needed. One Set per top-level `resolveChain()` call — not shared across variables.

### Anti-Patterns to Avoid

- **Separate parser instance per chain step:** Each `PSR4Resolver` file lookup triggers a fresh parse. Reuse `this._parser` (already initialized) — just call `this._parser.parse(text)` on each new file's text. Never re-call `init()` inside chain traversal.
- **Walking the entire file tree for return types:** Only parse the specific class file found by PSR4Resolver. Don't glob all PHP files.
- **Mutating the source assignedTypes array during backfill:** Use `map()` to produce new objects — don't mutate entries in place.
- **Using inferTypes() AST node position as a unique key:** `inferTypes()` entries don't have a stable ID — backfill by iterating the array, not by lookup.
- **Sharing visited Set across multiple variable resolutions:** Each `$variable = $a->b()->c()` gets its own Set. A class-level Set would prevent legitimate same-method calls on different variables.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PHP file parsing in chain | Custom text regex for return types | tree-sitter + `_findMethodReturnType()` | Regex breaks on multiline, generics, attributes; AST is reliable |
| FQCN-to-file resolution | Manual namespace prefix scan | `PSR4Resolver.resolve()` | Already handles prefix matching, multiple dirs, existsSync |
| Class name normalization | String manipulation | Existing `useMap` + `replace(/^\\/, "")` pattern | Phase 14 established this; reuse exactly |

**Key insight:** The entire resolution infrastructure (parser, use-import map, PSR4Resolver) is already wired. Phase 15 is assembling existing pieces, not building new ones.

## Common Pitfalls

### Pitfall 1: optional_type Inner Child

**What goes wrong:** Code checks for `named_type` in `method_declaration` children but misses `?Bar` — the node type is `optional_type`, not `named_type`.
**Why it happens:** `inferTypes()` in EnhancedLaravelParser only checks `primitive_type | named_type` (line 446) — it silently misses nullable returns. Phase 15 must handle `optional_type` explicitly.
**How to avoid:** Check for all four: `named_type`, `primitive_type`, `optional_type`, `union_type`. [VERIFIED: live AST dump]
**Warning signs:** Chain stops at methods with `?ReturnType` syntax despite the class being resolvable.

### Pitfall 2: Left-Recursive Chain Nesting

**What goes wrong:** Iterating `node.children` to find method names yields the inner chain first — methods appear in wrong order without careful unwinding.
**Why it happens:** `$a->b()->c()->d()` nests as outermost=`d`, innermost=`b`. Direct iteration gives `d` before `b`.
**How to avoid:** Use `_peelChain()` which does `unshift` while walking child(0) — produces steps in left-to-right call order. [VERIFIED: live AST dump]
**Warning signs:** Resolved type corresponds to the first method in the chain, not the last.

### Pitfall 3: `static` / `self` Return Types

**What goes wrong:** Method returns `static` or `self` — these aren't real class names but mean "the current class".
**Why it happens:** Fluent builder methods (e.g., `return $this`) are often declared `: static`. Passing `"static"` to PSR4Resolver will fail to resolve.
**How to avoid:** When `_findMethodReturnType` returns `"static"` or `"self"`, substitute the current class being walked. Track `currentClass` through the chain walk.
**Warning signs:** Chain stops unexpectedly at fluent builder methods.

### Pitfall 4: PSR4 Map Empty in agentmap.mjs

**What goes wrong:** `psr4Map` is passed as `{}` in the current Phase 14 integration (line 751 of agentmap.mjs). Chain resolution calls `PSR4Resolver.resolve()` with an empty map → always returns `null` → all chains produce no results.
**Why it happens:** Phase 14 accepted this limitation for MVP. Phase 15 needs real PSR4 resolution for chain tracing to work.
**How to avoid:** Either (a) wire `ComposerParser` into `agentmap.mjs` build() to provide a real `psr4Map`, or (b) accept that chain resolution silently produces no `chainTypes` when psr4Map is empty (which is valid degradation). **The planner must surface this trade-off** — if the project under analysis has no `composer.json`, chain resolution degrades gracefully to empty results. Document clearly in output.
**Warning signs:** All `chainTypes` arrays are empty even on well-typed PHP code.

### Pitfall 5: Re-reading Files on Every Chain Step

**What goes wrong:** A 3-step chain through `Foo → Builder → QueryBuilder` reads each class file up to `depth` times if the same class appears in multiple chains.
**Why it happens:** No caching between `_walkChain` calls.
**How to avoid:** Pass a `fileCache = new Map()` through the chain walk — keyed by absolute file path, value is the parsed tree root. Within a single `resolveChain()` invocation this prevents re-parsing the same file.
**Warning signs:** Performance regression on files with many fluent assignments.

## Code Examples

### Full Chain Walk Implementation Sketch

```javascript
// Source: derived from verified AST structure + Phase 14 patterns
_walkChain(currentClass, steps, useMap, psr4Map, projectRoot, depthLimit, visited, fileCache = new Map(), depth = 0) {
  const results = [];
  for (const step of steps) {
    if (depth >= depthLimit) {
      process.stderr.write(`# agentmap: chain depth limit (${depthLimit}) reached at ${currentClass}::${step.method}\n`);
      break;
    }
    const key = `${currentClass}::${step.method}`;
    if (visited.has(key)) break; // cycle
    visited.add(key);

    // Resolve class file
    const fqcn = useMap[currentClass] || currentClass;
    let filePath = null;
    if (psr4Map && projectRoot && Object.keys(psr4Map).length > 0) {
      filePath = new PSR4Resolver().resolve(fqcn, projectRoot, psr4Map);
    }
    if (!filePath) break;

    // Parse (or reuse cached)
    let classRoot = fileCache.get(filePath);
    if (!classRoot) {
      try {
        const text = readFileSync(filePath, "utf8");
        classRoot = this._parser.parse(text).rootNode;
        fileCache.set(filePath, classRoot);
      } catch { break; }
    }

    const returnType = this._findMethodReturnType(classRoot, step.method);
    // Handle self/static
    const resolvedType = (returnType === "static" || returnType === "self") ? currentClass : returnType;
    results.push({ method: step.method, class: currentClass, returnType: resolvedType ?? null });
    if (!resolvedType) break; // unknown return type — stop chain

    currentClass = resolvedType;
    depth++;
  }
  return results;
}
```

### Backfill in agentmap.mjs

```javascript
// After existing TypeResolver loop (lines 744-759 of agentmap.mjs)
// Extend the try block to also call resolveChain and backfill enhanced.types:
const { assignedTypes, phpDocTypes } = typeResolver.resolve(filePath, text, {}, cwdp);
const chainTypes = typeResolver.resolveChain(
  typeResolver._lastRoot,    // or re-parse; see note below
  typeResolver._lastUseMap,
  assignedTypes,
  psr4Map ?? {},
  cwdp
);
entry.assignedTypes = assignedTypes;
entry.phpDocTypes = phpDocTypes;
entry.chainTypes = chainTypes;
if (entry.enhanced?.types) {
  entry.enhanced.types = entry.enhanced.types.map(t =>
    ({ ...t, confidence: "HIGH", source: "declared" })
  );
}
```

**Note on re-parse vs. storing root:** The cleanest approach is to have `resolve()` internally store `this._lastRoot` and `this._lastUseMap` as instance fields after parsing, so `resolveChain()` can be called immediately after without re-parsing. Alternatively, `resolveChain()` can accept `text` directly and parse internally. The agent should choose whichever avoids duplicate parsing.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No chain resolution (Phase 14 MVP) | Depth-first chain walk via PSR4Resolver | Phase 15 | Chain types now visible in map.json |
| No confidence levels on enhanced.types | HIGH + source: declared backfill | Phase 15 | All type entries uniformly tagged |
| assignedTypes/phpDocTypes implicit MEDIUM | Explicit confidence: MEDIUM (Phase 14 already) | Phase 14 | Consistent — no change needed |

**Deprecated/outdated:**
- `inferTypes()` entries without confidence field: will be backfilled in Phase 15. Code reading `enhanced.types` after Phase 15 can rely on `confidence` being present.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `psr4Map` can be sourced from ComposerParser in agentmap.mjs build() context | Pitfall 4 | Chain resolution silently produces empty results; TYP-03 not demonstrable without real PSR4 map |
| A2 | `self` and `static` return types should resolve to the current class in the chain | Pattern 2, Pitfall 3 | Fluent builder chains break at every `return $this` method |

## Open Questions

1. **Real psr4Map in agentmap.mjs TypeResolver loop**
   - What we know: Phase 14 passes `{}` as psr4Map; ComposerParser exists but isn't instantiated in agentmap.mjs build()
   - What's unclear: Whether the planner should wire ComposerParser to provide a real map, or whether graceful degradation (empty chainTypes when no composer.json) is acceptable for Phase 15
   - Recommendation: Planner should add a task to attempt `ComposerParser` instantiation in the TypeResolver block; fall back to `{}` if composer.json absent — this makes chain resolution work on real Laravel projects

2. **resolve() internal state for resolveChain()**
   - What we know: resolveChain() needs the parsed root and useMap that resolve() already computed
   - What's unclear: Whether to store `_lastRoot`/`_lastUseMap` on the instance or accept `text` as a parameter to resolveChain()
   - Recommendation: Store as instance fields after resolve() — avoids double-parse, keeps API clean; agent's discretion per CONTEXT.md

## Environment Availability

Step 2.6: SKIPPED — no new external dependencies. tree-sitter and tree-sitter-php already installed and verified in Phase 14.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js native test runner (node:test) |
| Config file | none — invoked directly |
| Quick run command | `node --test test/type-resolver.test.mjs` |
| Full suite command | `node --test test/*.test.mjs test/**/*.test.mjs` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TYP-03 | 1-level chain `$a->b()` resolves returnType | unit | `node --test test/type-resolver.test.mjs` | ❌ Wave 0 |
| TYP-03 | 2-level chain `$a->b()->c()` resolves final type | unit | `node --test test/type-resolver.test.mjs` | ❌ Wave 0 |
| TYP-03 | 3-level chain resolves to depth 3 | unit | `node --test test/type-resolver.test.mjs` | ❌ Wave 0 |
| TYP-03 | 4-level chain truncated at depth 3, warns stderr | unit | `node --test test/type-resolver.test.mjs` | ❌ Wave 0 |
| TYP-03 | Cycle detected → stops without infinite loop | unit | `node --test test/type-resolver.test.mjs` | ❌ Wave 0 |
| TYP-03 | Unknown return type → chain stops gracefully | unit | `node --test test/type-resolver.test.mjs` | ❌ Wave 0 |
| TYP-04 | assignedTypes entries carry confidence: MEDIUM | unit | `node --test test/type-resolver.test.mjs` | ✅ (Phase 14) |
| TYP-04 | phpDocTypes entries carry confidence: MEDIUM | unit | `node --test test/type-resolver.test.mjs` | ✅ (Phase 14) |
| TYP-04 | chainTypes entries carry confidence: LOW | unit | `node --test test/type-resolver.test.mjs` | ❌ Wave 0 |
| TYP-04 | enhanced.types entries backfilled with HIGH + declared | unit | `node --test test/type-resolver.test.mjs` | ❌ Wave 0 |
| TYP-04 | optional_type (`?Bar`) return extracted correctly | unit | `node --test test/type-resolver.test.mjs` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test test/type-resolver.test.mjs`
- **Per wave merge:** `node --test test/*.test.mjs test/**/*.test.mjs`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `test/fixtures/chains.php` — covers TYP-03: 1/2/3/>3-level chains with class definitions
- [ ] Chain test cases in `test/type-resolver.test.mjs` — TYP-03 and TYP-04 chain confidence
- [ ] `test/fixtures/chain-classes/` — optional multi-file fixtures for PSR4 chain resolution (if PSR4 map is wired)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | tree-sitter graceful degradation on malformed PHP (existing try-catch) |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed PHP causing parser throw | Tampering | Existing try-catch in resolve() wraps all AST work |
| Adversarial file path from PSR4Resolver | Tampering | existsSync + readFileSync on resolved path only — no user-controlled path injection |
| Deep recursion via crafted chain | Denial of Service | depthLimit constant (DEFAULT_CHAIN_DEPTH = 3) + visited Set prevent runaway |

## Sources

### Primary (HIGH confidence)
- Live tree-sitter AST dumps (this session) — `member_call_expression` chain nesting, `optional_type`, `union_type`, `named_type` child shapes [VERIFIED: live AST dump]
- `src/Core/TypeResolver.mjs` — exact method signatures, return shapes, existing patterns [VERIFIED: codebase]
- `src/Core/EnhancedLaravelParser.mjs` inferTypes() — confirmed it only handles `named_type | primitive_type`, missing `optional_type` [VERIFIED: codebase]
- `agentmap.mjs` lines 743–759 — exact TypeResolver integration block location and psr4Map={} limitation [VERIFIED: codebase]
- `src/Core/constants.mjs` — confirmed DEFAULT_CHAIN_DEPTH not yet present; 27 lines, all constants visible [VERIFIED: codebase]
- `src/Core/PSR4Resolver.mjs` — resolve(fqcn, projectRoot, psr4Map) signature confirmed [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- Phase 14 SUMMARY files — confirmed integration point is agentmap.mjs not map-builder.mjs; psr4Map={} limitation documented [CITED: .planning/phases/14-php-type-resolution-mvp/14-02-SUMMARY.md]

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing stack verified in codebase
- Architecture: HIGH — AST node types verified via live dump; integration point confirmed via source read
- Pitfalls: HIGH — optional_type gap confirmed in inferTypes() source; left-recursive nesting confirmed via AST dump; psr4Map={} limitation confirmed in agentmap.mjs

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (tree-sitter-php grammar is stable; agentmap.mjs is project-internal)


