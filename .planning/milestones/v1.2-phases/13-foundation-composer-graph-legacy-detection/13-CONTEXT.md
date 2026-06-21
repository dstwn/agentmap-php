# Phase 13: Foundation — Composer Graph + Legacy Detection - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers two foundational capabilities for v1.2: (1) parsing `composer.json`/`composer.lock` into a package dependency graph with all edge types and version constraints, and (2) detecting legacy non-PSR-4 code via heuristic directory patterns and `autoload.classmap`/`autoload.files` entries. It also exposes a `PSR4Resolver` for use by Phase 14. No CLI flags are wired in this phase — that is Phase 16's job.

</domain>

<decisions>
## Implementation Decisions

### Composer Parser Module Structure
- `ComposerParser` lives in `src/Core/ComposerParser.mjs` — matches the plugin pattern (PhpParser, LaravelParser all in src/Core/)
- Standalone class (not LanguageParser subclass) — composer.json is not source code, different contract
- Composer graph stored as new top-level key `packages` alongside `files`/`edges` in map.json — keeps concerns separate
- Schema version bump (v3→v4) deferred to Phase 16 per ROADMAP/REQUIREMENTS

### Composer Graph Output Format
- Version constraints displayed as raw strings from composer.json — `"^2.0"`, `"~1.4"`, `"*"` — no normalization, user sees exactly what's in the file
- Edge types prefixed per line — `[require]`, `[require-dev]`, `[conflict]` etc. — consistent with agentmap's plain text style
- Missing composer files: warning to stderr + empty result (exit 0) — matches agentmap's graceful degradation pattern
- `vendor/` packages excluded — per REQUIREMENTS.md "Out of Scope: Vendor directory parsing"

### Legacy Non-PSR-4 Detection
- Legacy detection lives in `src/Core/LegacyDetector.mjs` — separate module from ComposerParser, single responsibility
- Heuristic directories that trigger legacy warning: `classes/`, `lib/`, `modules/`, `src/` without PSR-4 namespace prefix — exactly the REQUIREMENTS.md LEG-02 list
- Legacy warnings stored in map.json as `legacyWarnings` array — CLI flag in Phase 16 reads and displays them
- `PSR4Resolver` exported from `src/Core/PSR4Resolver.mjs` (its own module) — Phase 14 imports it directly

### the agent's Discretion
- Internal implementation details of ComposerParser (exact parsing loops, error recovery edge cases)
- Test fixture design for composer.json/composer.lock samples
- Exact shape of `packages` key in map.json (agent decides best schema)
- Exact shape of `legacyWarnings` entries

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/Core/LanguageParser.mjs` — base class interface (canParse, init, parse pattern)
- `src/Core/PhpParser.mjs` — example standalone parser with tree-sitter init pattern
- `src/Core/utils.mjs` — `sh()`, `currentSha()`, `dirtyCount()` helpers
- `src/Core/map-builder.mjs` — `build()` function where new parsers are integrated
- `src/Core/constants.mjs` — `MAP`, `SCHEMA_VERSION`, `SRC_EXT`, `HUBS_LIMIT` constants
- `src/Core/cache.mjs` — `sourceFingerprint()` for dirty detection

### Established Patterns
- New modules go in `src/Core/<Name>.mjs` — ESM, named exports
- Parsers are standalone classes with `init()`, `canParse()`, `parse()` methods
- Error handling: try-catch returning empty/null with stderr warning (not throw)
- All I/O synchronous: `readFileSync`, `existsSync` — no async
- Tests are black-box CLI tests in `test/<feature>.test.mjs` using Node native test runner + `test/helpers.mjs`

### Integration Points
- `src/Core/map-builder.mjs` `build()` — where ComposerParser and LegacyDetector get called
- `map.json` schema — new `packages` and `legacyWarnings` keys added (schema v3 extended, v4 bump in Phase 16)
- `src/Core/constants.mjs` — add any new constants (e.g. `COMPOSER_FILES`, `LEGACY_DIRS`)
- Phase 14 will import `PSR4Resolver` from `src/Core/PSR4Resolver.mjs`

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond REQUIREMENTS.md CMP-01, CMP-02, CMP-03, LEG-01, LEG-02 — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
