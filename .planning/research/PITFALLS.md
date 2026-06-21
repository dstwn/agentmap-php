# Domain Pitfalls

**Domain:** Composer dependency graph + PHP type resolution in a Node.js repo-mapping tool
**Researched:** 2026-06-21

## Critical Pitfalls

### Pitfall 1: Composer autoload mismatch — PSR-4 roots in packages must reconcile with project roots

**What goes wrong:** A package in `composer.lock` declares autoload PSR-4 roots (e.g. `"Monolog\\": "src/"`). But the project's own PSR-4 roots (e.g. `"App\\": "app/"`) are in `composer.json`. If you parse only `composer.lock` for package autoload info, you miss the project's own autoload. If you parse only `composer.json`, you miss package details.

**Why it happens:** Two different files carry two different kinds of autoload info — `composer.json` has project roots, `composer.lock` packages[] has vendor package roots.

**Consequences:** File→package mapping is incomplete. Files in the project root get no package tag. Files in vendor packages get wrong package attribution.

**Prevention:** Parse BOTH files:
- `composer.json` → project-level autoload (PSR-4/PSR-0/classmap/files)
- `composer.lock` → vendor package autoload configurations (per package)
- Union both sets into a single combined root map

**Detection:** If `packageGraph.resolvePackage(fqcn)` returns null for a file under `app/`, the project roots were missed.

### Pitfall 2: composer.lock can be missing or out of sync

**What goes wrong:** The code assumes `composer.lock` exists. On a freshly cloned repo before `composer install`, there is no lock file. The build fails or silently produces an empty package graph.

**Why it happens:** `composer.lock` is gitignored in some projects (bad practice, but exists). Also, CI containers may not have run `composer install`.

**Consequences:** Package graph is empty. File→package mapping is empty. `--packages` shows no results.

**Prevention:** Graceful degradation:
- If `composer.lock` missing → read `composer.json` only (version info from `require` field without exact versions)
- If `composer.json` also missing → skip package graph entirely, emit warning to stderr
- Never throw an error because of missing composer files

**Detection:** `existsSync(composerLockPath)` check before parsing.

### Pitfall 3: TypeResolver parsing PHP files a second time (memory + perf)

**What goes wrong:** The current build() function parses each PHP file once inside the file loop, then discards the AST. TypeResolver needs the AST again. Naive implementation re-parses all PHP files, doubling parse time for large projects (~200ms → ~400ms for laravel/framework's 800 PHP files).

**Why it happens:** The AST is created, used, and garbage-collected within the file loop iteration. The TypeResolver runs AFTER the loop.

**Consequences:** ~2x PHP parse time. For laravel/framework (~800 PHP files), this adds ~200ms to an already ~500ms build. 700ms total is still fast, but the pattern is wasteful.

**Prevention options (in order of preference):**
1. **Best:** Store AST references in a `Map<filePath, AST>` during the first parse pass. Pass the map to TypeResolver. Memory: ~50MB for 800 files (the AST post-extraction holds only tree nodes, not full source text). Acceptable.
2. **Good:** Move TypeResolver logic INSIDE the file loop — for each file, run type resolution immediately after `inferTypes()`. But this loses cross-file context (TypeResolver may need to look at a method declaration in another file to resolve a return type).
3. **Adequate:** Accept the second parse. ~200ms on a one-shot CLI tool is negligible.

**Detection:** Compare build times before and after. If PHP block time doubles, the AST cache isn't wired in.

### Pitfall 4: Package→file edge explosion in PageRank

**What goes wrong:** A large framework (laravel/framework) depends on 60+ packages. Each package edge translates to `N_files_in_A × N_files_in_B` file-level edges. For a package with 500 files depending on another with 800 files, a single dependency produces 400,000 edges. The PageRank power iteration slows from O(edges) and may exceed its 100-iteration cap or memory budget.

**Why it happens:** The naive mapping "every file depends on every other file across package boundaries" creates a dense subgraph.

**Consequences:** Build time spikes from ~500ms to ~5s for large projects. Memory for edge array grows ~50MB.

**Prevention:**
- Cap edge expansion per dependency: `min(N_from × N_to, 1000)` — sampled edges are sufficient for a subtle rank boost
- Use a lower weight (0.1-0.3) so even if edges are numerous, each contributes little
- Consider a TWO-GRAPH approach: file-level PageRank + package-level PageRank, then composite score = 0.9 × fileRank + 0.1 × packageRank (avoids edge explosion entirely)

**Detection:** Monitor `build()` time on laravel/framework. If it exceeds 2s total, edge explosion is likely.

## Moderate Pitfalls

### Pitfall 5: Type resolution depth causing runaway AST walk

**What goes wrong:** Tracing `$a->getB()->getC()->getD()` follows 4 levels of method calls, each requiring its own file lookup, AST parse, and return-type resolution. Deep chains could theoretically recurse through the entire project.

**Prevention:** Cap resolution depth at 3 levels for MVP. Log a warning and stop ("resolution depth exceeded") for deeper chains.

### Pitfall 6: Legacy directory detection false positives

**What goes wrong:** A project has a `classes/` CSS directory (not PHP classes) that gets flagged as a legacy PHP namespace root. Or a `lib/` that contains JS files.

**Prevention:** Only flag directories that contain `.php` files with class declarations or namespace statements. Verify by reading at least one file's AST to confirm it's PHP. Add a confidence field to detections.

### Pitfall 7: Composer package version constraint parsing edge cases

**What goes wrong:** Constraints like `dev-master`, `dev-feature/branch`, `1.2.x-dev`, `*`, aliases (`1.0.x-dev as 1.0.0`), and abandoned packages aren't standard semver.

**Prevention:** Homegrown parser handles common cases (`^`, `~`, `>=`, `<=`, `>`, `<`, `!=`, `||`, `*`). For dev versions and aliases, store the raw string verbatim and tag as `"dev"` type. Never attempt to compare/sort dev versions.

## Minor Pitfalls

### Pitfall 8: `--types` output too verbose

Type resolution may produce hundreds of entries per file. Displaying all of them is noisy.

**Prevention:** By default, show only HIGH confidence types. `--types --all` shows all. JSON output always includes all with confidence filter.

### Pitfall 9: Version constraint grouping instability

Grouping packages by "major version" (MAJOR.MINOR.PATCH) is ambiguous for pre-1.0 versions (0.x is effectively major) and for packages without semver (Laravel-style "v10.3.0" with the "v" prefix).

**Prevention:** Strip the leading "v"/"V". For versions < 1.0.0, use minor version as the group key since 0.1 → 0.2 is a breaking change in practice.

### Pitfall 10: Race condition with concurrent `composer install`

If a user runs `composer install` while the map tool is parsing `composer.lock`, the file could be in an inconsistent state.

**Prevention:** Read the file atomically with `readFileSync` (single read, no streaming). If JSON.parse fails, retry once after 100ms (Composer writes are typically sub-second). If still failing, fall back gracefully with a warning.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| composer-graph.mjs implementation | Lock file missing or corrupt | Graceful fallback: warn + skip, never crash |
| PSR4Resolver directory scanning | Scanning vendor/ recursively | Explicitly exclude `vendor/` and `node_modules/` from legacy scans |
| TypeResolver cross-file resolution | Circular type dependencies causing infinite loops | Track visited files in a Set, abort with MEDIUM confidence on revisit |
| PageRank edge merging | Edge count explosion | Cap at 1000 edges per package dependency or use two-graph approach |
| CLI flag integration | --json output schema change breaks downstream consumers | Add new fields (packages, types) to output, never remove existing fields. Schema version 3→4. |
| Cache invalidation | Old cache (schema 3) served when new features need data | Bump SCHEMA_VERSION to 4 — existing cache won't match, triggers rebuild |
| Legacy detection on Drupal projects | Modules/ directory contains subdirectories with complex class loading | Report detections at directory level, don't attempt per-file resolution unless heuristic is strong |

## Sources

- Codebase analysis: agentmap.mjs build() (lines 474-792) — existing error handling patterns
- Composer schema documentation — autoload, lock file structure, version constraints
- tree-sitter-php grammar — AST node types for assignment and method call expressions
- PROJECT.md — "declared types only suffice" trade-off documentation
