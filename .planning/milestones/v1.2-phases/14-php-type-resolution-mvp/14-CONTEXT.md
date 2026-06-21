# Phase 14: PHP Type Resolution (MVP) - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers PHP type resolution from two sources: (1) variable assignment expressions (`$x = new Foo()`, `$x = SomeClass::staticMethod()`) and (2) PHPDoc annotations (`@var`, `@return`, `@param`, `@property`). Results are merged with existing `EnhancedLaravelParser.inferTypes()` output — declared types remain the baseline. No CLI flags wired in this phase (Phase 16). Method chain tracing deferred to Phase 15.

</domain>

<decisions>
## Implementation Decisions

### TypeResolver Module Architecture
- `TypeResolver` lives in `src/Core/TypeResolver.mjs` — standalone module, same pattern as ComposerParser/LegacyDetector
- Called after `inferTypes()` returns — results merged (union) into existing types map; does not replace inferTypes()
- Resolved types stored on each file's existing entry as `assignedTypes` and `phpDocTypes` arrays — no new top-level key
- Import `PSR4Resolver` from `src/Core/PSR4Resolver.mjs` for FQCN-to-path resolution

### Assignment Expression Tracking
- Patterns tracked in MVP: `$x = new Foo()` (new expression) and `$x = SomeClass::staticMethod()` (static call)
- FQCN resolution: use PSR4Resolver with `use` statement imports in scope + fallback to `\Foo` global
- AST node: `assignment_expression` with right-child `object_creation_expression` — extracted from `variable_declaration_statement` and bare expression statements
- Confidence tag: `MEDIUM` — per REQUIREMENTS.md TYP-04 ("assigned/new" = MEDIUM confidence)

### PHPDoc Annotation Parsing
- Docblock attachment: line-number proximity — docblock on line N attaches to symbol starting at line N+1 or N+2 (skipping blank lines)
- Tags parsed in MVP: `@var`, `@return`, `@param`, `@property` — exactly the TYP-02 list
- Type extraction format: `{ tag: "@param", type: "Foo", name: "$bar" }` — structured object per annotation
- Confidence tag: `MEDIUM` — per REQUIREMENTS.md TYP-04 ("PHPDoc" = MEDIUM confidence)

### the agent's Discretion
- Internal tree-sitter traversal implementation details
- Exact merge strategy for duplicate type entries (deduplication logic)
- Performance optimization approach for <200ms budget
- Test fixture design for PHP assignment/PHPDoc samples

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/Core/PSR4Resolver.mjs` — FQCN-to-path resolution, just created in Phase 13
- `src/Core/EnhancedLaravelParser.mjs` — `inferTypes()` method produces declared types baseline
- `src/Core/PhpParser.mjs` — tree-sitter PHP parser init pattern (`this._parser`, `this._phpLang`, `this._ready`)
- `src/Core/map-builder.mjs` — `build()` integration point where TypeResolver will be called
- `test/composer-parser.test.mjs` — example of new test file structure from Phase 13

### Established Patterns
- Parsers in `src/Core/` are standalone classes with synchronous methods
- tree-sitter AST traversal: `node.children`, `node.type`, `node.text` properties
- Error handling: try-catch returning empty/null with graceful degradation
- All I/O synchronous: `readFileSync`, `existsSync`
- Tests: black-box Node native test runner in `test/*.test.mjs`

### Integration Points
- `src/Core/map-builder.mjs` `build()` — where TypeResolver gets called after EnhancedLaravelParser
- `src/Core/EnhancedLaravelParser.mjs` `inferTypes()` — output to merge with TypeResolver results
- Each file entry in map.json gains `assignedTypes` and `phpDocTypes` arrays
- Phase 15 will extend TypeResolver with method chain tracing

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond REQUIREMENTS.md TYP-01 and TYP-02 — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

- Method chain tracing (`$a->b()->c()->d()`) — explicitly Phase 15 (TYP-03)
- `@throws`, `@type` PHPDoc tags — out of scope for MVP
- Control-flow type narrowing (instanceof checks) — v2 requirement per REQUIREMENTS.md

</deferred>
