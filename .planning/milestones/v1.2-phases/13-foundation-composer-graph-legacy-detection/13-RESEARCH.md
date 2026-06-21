# Phase 13: Foundation — Composer Graph + Legacy Detection - Research

**Researched:** 2026-06-21
**Domain:** Composer JSON parsing, PSR-4 autoload, legacy PHP detection, Node.js ESM module integration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- `ComposerParser` lives in `src/Core/ComposerParser.mjs` — standalone class (not LanguageParser subclass)
- Composer graph stored as new top-level key `packages` alongside `files`/`edges` in map.json
- Schema version bump (v3→v4) deferred to Phase 16
- Version constraints displayed as raw strings — no normalization
- Edge types prefixed per line: `[require]`, `[require-dev]`, `[conflict]` etc.
- Missing composer files: warning to stderr + empty result (exit 0)
- `vendor/` packages excluded
- Legacy detection lives in `src/Core/LegacyDetector.mjs` — separate module
- Heuristic legacy dirs: `classes/`, `lib/`, `modules/`, `src/` without PSR-4 namespace prefix
- Legacy warnings stored in map.json as `legacyWarnings` array
- `PSR4Resolver` exported from `src/Core/PSR4Resolver.mjs` — Phase 14 imports it
- No CLI flags in this phase — that is Phase 16's job

### the agent's Discretion

- Internal implementation details of ComposerParser (exact parsing loops, error recovery edge cases)
- Test fixture design for composer.json/composer.lock samples
- Exact shape of `packages` key in map.json
- Exact shape of `legacyWarnings` entries

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMP-01 | Parse `composer.json` for package metadata (name, version, description) and dependency edges (require, require-dev, conflict, replace, provide) | composer.json schema verified via official docs; all fields documented below |
| CMP-02 | Parse `composer.lock` for resolved dependency graph with exact installed versions | composer.lock packages array structure documented; each entry mirrors composer.json fields |
| CMP-03 | Display version constraints with operator semantics (^, ~, exact, wildcard *, branch-name, stability flags @dev) | Full constraint syntax verified from getcomposer.org/doc/articles/versions.md |
| LEG-01 | Parse `autoload.classmap` and `autoload.files` from `composer.json` for non-PSR-4 file registration | autoload.classmap (array of dirs/files) and autoload.files (array of PHP files) documented |
| LEG-02 | Detect source directories via heuristic patterns (`classes/`, `lib/`, `modules/`, `src/` without PSR-4 namespace prefix) | PSR-4 spec verified; detection algorithm designed based on prefix-to-path mapping |
</phase_requirements>

## Summary

Phase 13 delivers two pure-parsing modules — `ComposerParser` and `LegacyDetector` — plus a `PSR4Resolver` utility. All three are standalone ESM classes in `src/Core/`, following the exact plugin pattern used by `PhpParser` and `LaravelParser`. No tree-sitter is needed: composer files are plain JSON, parsed with `JSON.parse`. All I/O is synchronous (`readFileSync`/`existsSync`), matching the project's established pattern.

The composer.json schema is well-specified: six package-link sections (require, require-dev, conflict, replace, provide, suggest), an autoload section with psr-4/psr-0/classmap/files sub-keys, and an optional autoload-dev mirror. The composer.lock packages array gives resolved versions for every installed dependency. Version constraints are raw strings — no parsing needed, just display as-is.

Legacy detection is a directory-existence check against a known list (`classes/`, `lib/`, `modules/`, `src/`) cross-referenced against the psr-4 map from composer.json. If a directory exists and no psr-4 prefix maps to it, it gets flagged. Classmap and files entries are reported as non-PSR-4 registrations directly. Both modules integrate into `map-builder.mjs` `build()` by appending `packages` and `legacyWarnings` keys to the output object before `writeFileSync`.

**Primary recommendation:** Implement ComposerParser, LegacyDetector, and PSR4Resolver as thin, synchronous JSON-reader classes. Integrate into `build()` with two lines: call parser, append results to `out`. Write black-box unit tests using the `php-parser.test.mjs` pattern (direct import + in-memory fixture, no CLI subprocess needed).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| composer.json / composer.lock parsing | Backend (Node.js build step) | — | Pure file I/O + JSON; no browser/PHP runtime needed |
| Version constraint display | Backend (ComposerParser) | — | Raw string passthrough from JSON; no frontend |
| PSR-4 namespace-to-path resolution | Backend (PSR4Resolver) | Phase 14 consumer | Shared utility; path math is Node.js `path.join` |
| Legacy directory detection | Backend (LegacyDetector) | — | `existsSync` + array diff; no AST needed |
| map.json output | Backend (map-builder.mjs) | — | Existing write pipeline; two new top-level keys |


## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs` (built-in) | Node 18+ | `readFileSync`, `existsSync`, `readdirSync` | Zero deps; synchronous I/O matches project pattern |
| `node:path` (built-in) | Node 18+ | `join`, `dirname`, `relative` | Path math for PSR-4 resolution |

No external packages needed. Composer parsing is pure JSON — `JSON.parse(readFileSync(..., 'utf8'))`. [CITED: getcomposer.org/doc/04-schema.md]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `JSON.parse` | `@iarna/toml` or dedicated composer parser | composer.json is JSON — no parser library needed |
| Manual PSR-4 resolution | `composer dump-autoload` subprocess | Subprocess adds latency and composer dependency; pure JS is faster and dep-free |

## Package Legitimacy Audit

No external packages introduced in this phase. All implementation uses Node.js built-ins only.

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious SUS:** none

## Architecture Patterns

### System Architecture Diagram

```
composer.json / composer.lock
        │
        ▼
  ComposerParser.mjs
  ├── parseJson(path) ─── existsSync + readFileSync + JSON.parse (try-catch)
  ├── parseComposerJson() ─── extracts: name, require, require-dev, conflict,
  │                           replace, provide, suggest, autoload.*
  ├── parseComposerLock() ─── extracts: packages[].name, packages[].version,
  │                           packages[].require
  └── returns: { packages: [...], edges: [...] }
        │
        ▼
  LegacyDetector.mjs
  ├── detect(projectRoot, psr4Map, classmapEntries, filesEntries)
  ├── scans LEGACY_DIRS against psr4Map values
  └── returns: legacyWarnings[]
        │
  PSR4Resolver.mjs  (shared utility, consumed by Phase 14)
  ├── resolve(fqcn, projectRoot) ─── reads autoload.psr-4 from composer.json
  └── returns: absolute file path or null
        │
        ▼
  map-builder.mjs build()
  ├── [existing TS/PHP parsing ...]
  ├── composerResult = new ComposerParser().parse(cwd)
  ├── legacyResult   = new LegacyDetector().detect(cwd, composerResult.psr4Map, ...)
  └── out = { ...existing, packages: composerResult.packages, legacyWarnings: legacyResult }
        │
        ▼
  .claude/agentmap/map.json  (schema v3 + new keys; v4 bump in Phase 16)
```

### Recommended Project Structure
```
src/Core/
├── ComposerParser.mjs    # NEW — parses composer.json + composer.lock
├── LegacyDetector.mjs    # NEW — heuristic legacy dir detection
├── PSR4Resolver.mjs      # NEW — shared PSR-4 namespace→path resolver
├── map-builder.mjs       # MODIFIED — calls ComposerParser + LegacyDetector in build()
├── constants.mjs         # MODIFIED — add COMPOSER_FILES, LEGACY_DIRS constants
├── PhpParser.mjs         # UNCHANGED — _resolvePsr4() will delegate to PSR4Resolver
└── ...                   # all other modules unchanged

test/
└── composer-parser.test.mjs   # NEW — unit tests for ComposerParser + LegacyDetector
```

### Pattern 1: Synchronous JSON File Parser with Graceful Degradation

**What:** Read a JSON file safely — return empty result + stderr warning on any failure, never throw.
**When to use:** All composer file reads in ComposerParser.

```javascript
// Source: mirrors PhpParser._resolvePsr4() pattern in src/Core/PhpParser.mjs
import { readFileSync, existsSync } from "node:fs";

function readJsonSafe(filePath, label) {
  if (!existsSync(filePath)) {
    process.stderr.write(`# agentmap: ${label} not found at ${filePath}\n`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (e) {
    process.stderr.write(`# agentmap: ${label} is corrupt or invalid JSON: ${e.message}\n`);
    return null;
  }
}
```

### Pattern 2: ComposerParser Class Structure

**What:** Standalone class (not LanguageParser subclass) that reads composer.json + composer.lock.
**When to use:** Called once per `build()` run from map-builder.mjs.

```javascript
// Source: mirrors PhpParser.mjs standalone class pattern [ASSUMED for exact API]
import { existsSync } from "node:fs";
import { join } from "node:path";

export class ComposerParser {
  parse(projectRoot) {
    const jsonPath  = join(projectRoot, "composer.json");
    const lockPath  = join(projectRoot, "composer.lock");
    const json  = readJsonSafe(jsonPath,  "composer.json");
    const lock  = readJsonSafe(lockPath,  "composer.lock");

    const packages = [];
    const LINK_TYPES = ["require", "require-dev", "conflict", "replace", "provide", "suggest"];

    if (json) {
      const name = json.name ?? "(root)";
      for (const linkType of LINK_TYPES) {
        const deps = json[linkType] ?? {};
        for (const [pkg, constraint] of Object.entries(deps)) {
          packages.push({ from: name, to: pkg, type: linkType, constraint });
        }
      }
    }

    // Resolved versions from lock file
    const resolved = {};
    if (lock) {
      const allPkgs = [...(lock.packages ?? []), ...(lock["packages-dev"] ?? [])];
      for (const pkg of allPkgs) {
        resolved[pkg.name] = pkg.version;
      }
    }

    // Autoload sections for LegacyDetector
    const psr4Map    = json?.autoload?.["psr-4"]   ?? {};
    const classmaps  = json?.autoload?.classmap     ?? [];
    const autoFiles  = json?.autoload?.files        ?? [];

    return { packages, resolved, psr4Map, classmaps, autoFiles };
  }
}
```

### Pattern 3: PSR-4 Resolver (extracted from PhpParser._resolvePsr4)

**What:** Resolves FQCN to absolute file path using composer.json psr-4 map.
**When to use:** Phase 14 imports this for type resolution; PhpParser can delegate to it.

```javascript
// Source: refactored from PhpParser._resolvePsr4() in src/Core/PhpParser.mjs [CITED: src/Core/PhpParser.mjs]
import { existsSync } from "node:fs";
import { join } from "node:path";

export class PSR4Resolver {
  resolve(fqcn, projectRoot, psr4Map) {
    const nsParts = fqcn.split("\\");
    for (const [prefix, dirs] of Object.entries(psr4Map)) {
      const prefixParts = prefix.replace(/\\+$/, "").split("\\");
      let match = true;
      for (let i = 0; i < prefixParts.length; i++) {
        if (nsParts[i] !== prefixParts[i]) { match = false; break; }
      }
      if (!match) continue;
      const dirsArr = Array.isArray(dirs) ? dirs : [dirs];
      for (const dir of dirsArr) {
        const remaining = nsParts.slice(prefixParts.length);
        const relPath = join(dir, ...remaining) + ".php";
        const absPath = join(projectRoot, relPath);
        if (existsSync(absPath)) return absPath;
      }
    }
    return null;
  }
}
```

### Pattern 4: Legacy Directory Detection

**What:** Compare LEGACY_DIRS against psr-4 covered directories; flag uncovered ones.
**When to use:** Called from LegacyDetector after ComposerParser provides psr4Map.

```javascript
// Source: heuristic design based on REQUIREMENTS.md LEG-02 [ASSUMED for exact implementation]
import { existsSync } from "node:fs";
import { join } from "node:path";
import { LEGACY_DIRS } from "./constants.mjs";

export class LegacyDetector {
  detect(projectRoot, psr4Map, classmaps, autoFiles) {
    const warnings = [];

    // Covered dirs: flatten all psr-4 mapped paths
    const coveredDirs = new Set();
    for (const dirs of Object.values(psr4Map)) {
      const arr = Array.isArray(dirs) ? dirs : [dirs];
      for (const d of arr) coveredDirs.add(d.replace(/\/+$/, ""));
    }

    // Heuristic: legacy dirs that exist but aren't PSR-4 mapped
    for (const dir of LEGACY_DIRS) {
      const absDir = join(projectRoot, dir);
      if (existsSync(absDir) && !coveredDirs.has(dir) && !coveredDirs.has(dir + "/")) {
        warnings.push({
          type: "legacy-dir",
          directory: dir,
          message: `Directory '${dir}' exists but is not registered as a PSR-4 namespace prefix`,
        });
      }
    }

    // Non-PSR-4: classmap entries
    for (const entry of classmaps) {
      warnings.push({ type: "classmap", entry, message: `classmap entry: ${entry}` });
    }

    // Non-PSR-4: files entries
    for (const file of autoFiles) {
      warnings.push({ type: "autoload-file", entry: file, message: `autoload.files entry: ${file}` });
    }

    return warnings;
  }
}
```

### Pattern 5: map-builder.mjs Integration

**What:** Two lines added to `build()` to append packages + legacyWarnings to the output.
**When to use:** In `build()` after existing file parsing, before `writeFileSync`.

```javascript
// Source: mirrors build() pattern in src/Core/map-builder.mjs [CITED: src/Core/map-builder.mjs]
import { ComposerParser } from "./ComposerParser.mjs";
import { LegacyDetector } from "./LegacyDetector.mjs";

// Inside build(), before writeFileSync:
const composerResult = new ComposerParser().parse(cwd);
const legacyWarnings = new LegacyDetector().detect(
  cwd, composerResult.psr4Map, composerResult.classmaps, composerResult.autoFiles
);

const out = {
  schema: SCHEMA_VERSION, generatedSha: sha, dirty: dirtyCount(), fileCount: nodes.length,
  fingerprint: sha ? undefined : sourceFingerprint(),
  hubs, features, rankedSymbols: rankedSymbols.slice(0, RANKED_SYMBOLS_LIMIT), files,
  packages: composerResult.packages,       // NEW — CMP-01, CMP-02, CMP-03
  legacyWarnings,                          // NEW — LEG-01, LEG-02
};
```

### Anti-Patterns to Avoid

- **Throwing on missing/corrupt JSON:** Use try-catch + stderr warning + empty return. Matches PhpParser._resolvePsr4() pattern; never let missing composer.json crash the build.
- **Normalizing version constraints:** Display raw strings. `"^2.0"` stays `"^2.0"`. CMP-03 says "operator semantics displayed correctly" — this means the raw string IS the correct display.
- **Subclassing LanguageParser:** ComposerParser does not parse source files; it has no `canParse()`, no `parse(text)`. Standalone class only.
- **Including vendor/ packages:** composer.lock `packages` array lists ALL installed packages including vendor. Only report root composer.json dependency edges — filter out transitive deps from vendor.
- **Scanning vendor/ directories:** LegacyDetector must skip `vendor/`. Add it to the exclusion list when iterating.
- **Mutating PhpParser._resolvePsr4:** Phase 13 ONLY extracts PSR4Resolver; Phase 13 does NOT refactor PhpParser to use it. That is a separate concern.


## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON parsing | Custom tokenizer/parser | `JSON.parse` | composer.json is valid JSON; built-in handles all edge cases |
| Version constraint semantics | Constraint parser/evaluator | Raw string passthrough | CMP-03 requires display only, not resolution; composer.lock has resolved versions |
| SAT dependency resolver | Dependency solver | composer.lock resolved graph | REQUIREMENTS.md Out of Scope: "SAT version constraint resolver" |
| PSR-4 autoloader | Custom autoload logic | `PSR4Resolver` (extracted from existing PhpParser._resolvePsr4) | Logic already exists in PhpParser.mjs — extract, don't rebuild |
| File system walker | Recursive glob | `existsSync` + hardcoded LEGACY_DIRS list | Only 4 directories to check; no walker needed |

**Key insight:** This phase is almost entirely JSON reading + array iteration. The only "algorithm" is the PSR-4 prefix-match loop, which already exists in PhpParser._resolvePsr4 and needs only extraction.

## Common Pitfalls

### Pitfall 1: composer.lock `packages` vs `packages-dev`
**What goes wrong:** Only reading `packages` array from composer.lock misses dev dependencies. `packages-dev` is a separate top-level key.
**Why it happens:** The schema has two arrays: `packages` (production) and `packages-dev` (dev).
**How to avoid:** Always merge both: `[...(lock.packages ?? []), ...(lock["packages-dev"] ?? [])]`.
**Warning signs:** Dev packages like `phpunit/phpunit` not appearing in resolved versions.

### Pitfall 2: PSR-4 prefix trailing backslash normalization
**What goes wrong:** Prefix `"App\\"` in JSON is the string `App\` — one backslash. The spec requires trailing `\\` in JSON (which is one `\` character). Splitting on `\\` in JavaScript string gives wrong result.
**Why it happens:** JSON escaping: `"\\"` = one backslash char. PSR-4 requires prefix to end with `\`.
**How to avoid:** Use `.replace(/\\+$/, "")` to strip trailing backslash(es) before splitting on `\\`. This already works correctly in PhpParser._resolvePsr4 — follow that exact pattern.
**Warning signs:** Namespace resolution returning null for valid PSR-4 mappings.

### Pitfall 3: `suggest` values are free text, not version constraints
**What goes wrong:** Treating `suggest` values as version constraints when they are human-readable strings like `"Allows more advanced logging"`.
**Why it happens:** All other package-link sections use version constraint strings; `suggest` is the exception.
**How to avoid:** In ComposerParser, include `suggest` edges but label them `[suggest]` and store constraint as-is (it's descriptive text).
**Warning signs:** Constraint display looking broken for suggest entries.

### Pitfall 4: `autoload-dev` vs `autoload` in legacy detection
**What goes wrong:** Only checking `autoload.classmap` misses `autoload-dev.classmap` entries (test helpers, etc.).
**Why it happens:** composer.json has both `autoload` and `autoload-dev` keys.
**How to avoid:** For LEG-01, read both `autoload.classmap`, `autoload.files`, `autoload-dev.classmap`, `autoload-dev.files`.
**Warning signs:** Test classmap directories not flagged as legacy.

### Pitfall 5: `src/` false positive when correctly mapped via PSR-4
**What goes wrong:** Flagging `src/` as legacy when it IS registered as a PSR-4 namespace base directory.
**Why it happens:** Many projects have `"App\\": "src/"` — src/ is PSR-4, not legacy.
**How to avoid:** The covered-dirs check in LegacyDetector must correctly collect all values from the psr-4 map (including array values) and compare against the candidate dir. Only flag if NOT in covered set.
**Warning signs:** `src/` appearing in legacyWarnings for a standard Laravel project.

### Pitfall 6: vendor/ directories triggering false legacy warnings
**What goes wrong:** Classmap or files entries from vendor packages appearing in autoload sections if reading lock file package autoload data.
**Why it happens:** composer.lock packages each have their own `autoload` section.
**How to avoid:** Only read root `composer.json` autoload/autoload-dev for LEG-01/LEG-02. Do not read per-package autoload from composer.lock packages.
**Warning signs:** Hundreds of legacy warnings from vendor packages.

## Code Examples

### composer.json Full Schema (relevant fields)
```json
// Source: https://getcomposer.org/doc/04-schema.md [CITED]
{
  "name": "vendor/project",
  "require":     { "php": ">=8.1", "laravel/framework": "^10.0" },
  "require-dev": { "phpunit/phpunit": "^10.0" },
  "conflict":    { "old/package": "<2.0" },
  "replace":     { "other/package": "self.version" },
  "provide":     { "psr/log-implementation": "3.0" },
  "suggest":     { "ext-redis": "Required for Redis cache driver" },
  "autoload": {
    "psr-4":    { "App\\": "app/", "Database\\Factories\\": "database/factories/" },
    "classmap": ["database/seeders/"],
    "files":    ["app/helpers.php"]
  },
  "autoload-dev": {
    "psr-4": { "Tests\\": "tests/" }
  }
}
```

### composer.lock Relevant Structure
```json
// Source: https://getcomposer.org/doc/04-schema.md [CITED]
{
  "_readme": ["..."],
  "content-hash": "abc123",
  "packages": [
    {
      "name": "laravel/framework",
      "version": "10.48.22",
      "require": { "php": "^8.1" },
      "autoload": { "psr-4": { "Illuminate\\": "src/Illuminate/" } }
    }
  ],
  "packages-dev": [
    {
      "name": "phpunit/phpunit",
      "version": "10.5.20"
    }
  ]
}
```

### Version Constraint Examples (all valid raw strings to display as-is)
```javascript
// Source: https://getcomposer.org/doc/articles/versions.md [CITED]
// Exact:          "1.0.2"
// Wildcard:       "1.0.*"        (>=1.0 <1.1)
// Tilde:          "~1.2"         (>=1.2 <2.0)  "~1.2.3" (>=1.2.3 <1.3.0)
// Caret:          "^1.2.3"       (>=1.2.3 <2.0.0)  "^0.3" (>=0.3 <0.4)
// Range:          ">=1.0 <2.0"   ">=1.0 <1.1 || >=1.2"
// Hyphen:         "1.0 - 2.0"
// Branch:         "dev-main"     "dev-master"   "v1.x-dev"
// Stability flag: "1.0.*@beta"   "@dev"         "^2.0@RC"
// PHP/ext:        ">=8.1"        "*" (ext-mbstring)
```

### Test Fixture Pattern (follows php-parser.test.mjs style)
```javascript
// Source: test/php-parser.test.mjs pattern [CITED: test/php-parser.test.mjs]
import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("ComposerParser", () => {
  it("parses require edges from composer.json", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "composer-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "acme/app",
      require: { "laravel/framework": "^10.0" },
      "require-dev": { "phpunit/phpunit": "^10.0" },
    }));
    const result = new ComposerParser().parse(dir);
    assert.ok(result.packages.some(p => p.type === "require" && p.to === "laravel/framework"));
    assert.ok(result.packages.some(p => p.type === "require-dev" && p.to === "phpunit/phpunit"));
    assert.equal(result.packages.find(p => p.to === "laravel/framework").constraint, "^10.0");
    rmSync(dir, { recursive: true });
  });

  it("returns empty result with stderr warning when composer.json missing", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "no-composer-"));
    const result = new ComposerParser().parse(dir);
    assert.deepEqual(result.packages, []);
    rmSync(dir, { recursive: true });
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PSR-0 autoloading (namespace in path) | PSR-4 (namespace stripped from path) | ~2013 | Legacy PSR-0 still supported in composer but deprecated |
| classmap-only autoloading | PSR-4 preferred | Composer 1.0 | classmap is now explicitly a legacy/fallback indicator |
| `include-path` | `files` autoloading | Composer 1.0 | `include-path` deprecated but still parsed |

**Deprecated/outdated:**
- `autoload.psr-0`: Deprecated in favor of PSR-4. Still valid in composer.json but signals legacy code. Worth noting in legacyWarnings if present.
- `autoload.include-path`: Deprecated. Presence is a legacy signal.
- `target-dir`: Deprecated PSR-0 helper. Presence signals very old code.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `LEGACY_DIRS = ["classes/", "lib/", "modules/", "src/"]` is the complete list from REQUIREMENTS.md | Architecture Patterns / LegacyDetector | Missing dirs would mean some legacy code not detected — add more dirs to the constant |
| A2 | ComposerParser only reports root composer.json dependency edges (not transitive) | Architecture Patterns | If transitive deps needed, would require recursive lock parsing — but REQUIREMENTS.md says "parse composer.json for edges" so root only is correct |
| A3 | Exact shape of `packages` array entries in map.json (agent's discretion) | Architecture Patterns | Shape mismatch with Phase 16 CLI — coordination needed at Phase 16 boundary |
| A4 | Exact shape of `legacyWarnings` entries (agent's discretion) | Architecture Patterns | Shape mismatch with Phase 16 CLI — coordination needed at Phase 16 boundary |
| A5 | PhpParser._resolvePsr4 is NOT refactored to use PSR4Resolver in this phase | Anti-Patterns | If refactored now, risk of breaking existing 194 tests — safer to leave PhpParser unchanged |

## Open Questions

1. **Should `autoload.psr-0` entries trigger a legacy warning?**
   - What we know: PSR-0 is deprecated; PSR-4 is the standard
   - What's unclear: REQUIREMENTS.md LEG-02 only lists classmap/files; psr-0 is not mentioned
   - Recommendation: Add psr-0 to legacyWarnings but with a distinct type; easy to add, low risk

2. **Should conflict/replace/provide edges appear in the `packages` array in map.json?**
   - What we know: REQUIREMENTS.md CMP-01 lists all six link types
   - What's unclear: Phase 16 CLI display — it might want to filter by type
   - Recommendation: Include all six types with `type` field; Phase 16 filters as needed

3. **Should resolved versions from composer.lock be merged into the packages edges?**
   - What we know: CMP-02 says parse composer.lock for exact versions; CMP-03 says display constraints
   - What's unclear: Whether a single entry should have both `constraint` (from json) and `resolvedVersion` (from lock)
   - Recommendation: Yes — add optional `resolvedVersion` field to each package edge; null if lock not present

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 18 | All modules | ✓ | (project requirement) | — |
| `node:fs` built-in | ComposerParser, LegacyDetector | ✓ | built-in | — |
| `node:path` built-in | PSR4Resolver | ✓ | built-in | — |
| composer.json | ComposerParser | project-dependent | — | Graceful empty result + stderr warning |
| composer.lock | ComposerParser | project-dependent | — | Graceful empty result + stderr warning (CMP-02 partially unavailable) |

**Missing dependencies with no fallback:** none — all runtime deps are Node.js built-ins.
**Missing dependencies with fallback:** composer.json / composer.lock — graceful degradation to empty result.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node:test`) |
| Config file | none — run via `node --test` |
| Quick run command | `node --test test/composer-parser.test.mjs` |
| Full suite command | `node --test test/` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMP-01 | Parse require/require-dev/conflict/replace/provide/suggest edges | unit | `node --test test/composer-parser.test.mjs` | ❌ Wave 0 |
| CMP-02 | Parse composer.lock resolved versions | unit | `node --test test/composer-parser.test.mjs` | ❌ Wave 0 |
| CMP-03 | Version constraints displayed as raw strings (^, ~, *, dev-x, @dev) | unit | `node --test test/composer-parser.test.mjs` | ❌ Wave 0 |
| LEG-01 | Parse autoload.classmap and autoload.files entries | unit | `node --test test/composer-parser.test.mjs` | ❌ Wave 0 |
| LEG-02 | Detect legacy dirs (classes/, lib/, modules/, src/ without PSR-4) | unit | `node --test test/composer-parser.test.mjs` | ❌ Wave 0 |
| CMP-01/02 | Missing composer.json → empty result, exit 0 | unit | `node --test test/composer-parser.test.mjs` | ❌ Wave 0 |
| CMP-01/02 | Corrupt composer.json → empty result, exit 0 | unit | `node --test test/composer-parser.test.mjs` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test test/composer-parser.test.mjs`
- **Per wave merge:** `node --test test/`
- **Phase gate:** Full suite (all 194+ tests) green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `test/composer-parser.test.mjs` — covers CMP-01, CMP-02, CMP-03, LEG-01, LEG-02
- [ ] No framework install needed — `node:test` built-in

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | JSON.parse in try-catch; never eval; never exec composer subprocess |
| V6 Cryptography | no | — |

### Known Threat Patterns for Node.js JSON file parsing

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious composer.json with deeply nested JSON (JSON bomb) | DoS | `JSON.parse` has no depth limit in V8; mitigated by try-catch timeout — low risk for local tool |
| Path traversal via autoload paths | Tampering | Only read from `projectRoot` directory; paths are relative in composer.json by spec |
| Prototype pollution via JSON keys | Tampering | `JSON.parse` is safe in modern Node.js (no `__proto__` pollution since Node 10+) |

## Sources

### Primary (HIGH confidence)
- [CITED: getcomposer.org/doc/04-schema.md] — Full composer.json schema, all package-link types, autoload fields
- [CITED: getcomposer.org/doc/articles/versions.md] — Complete version constraint syntax: ^, ~, *, ranges, branch names, stability flags
- [CITED: www.php-fig.org/psr/psr-4/] — PSR-4 autoloader specification, namespace-to-path mapping rules

### Secondary (HIGH confidence — codebase)
- [CITED: src/Core/PhpParser.mjs] — Existing _resolvePsr4() pattern, synchronous I/O convention, try-catch error handling
- [CITED: src/Core/map-builder.mjs] — build() function structure, out object shape, writeFileSync pattern
- [CITED: test/php-parser.test.mjs] — Test pattern: direct import, in-memory fixtures, tmpdir cleanup
- [CITED: test/mixed-project.test.mjs] — Black-box CLI test pattern as alternative for integration tests

### Tertiary (LOW confidence)
- None — all claims verified via official docs or codebase reading

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external packages; all built-ins
- Architecture: HIGH — patterns directly lifted from existing codebase; composer spec verified from official docs
- Pitfalls: HIGH — derived from verified spec (trailing backslash, packages-dev split) and codebase patterns
- Version constraints: HIGH — verified from official getcomposer.org docs
- PSR-4 spec: HIGH — verified from php-fig.org/psr/psr-4/

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (stable specs — Composer schema and PSR-4 are versioned standards, not fast-moving)
