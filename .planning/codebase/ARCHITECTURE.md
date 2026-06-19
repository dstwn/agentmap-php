<!-- refreshed: 2026-06-19 -->
# Architecture

**Analysis Date:** 2026-06-19

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                      CLI Layer (agentmap.mjs)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐ │
│  │  --any   │ │  --find  │ │--relates │ │  --map   │ │--hubs │ │
│  │  router  │ │  symbol  │ │ blast    │ │ ranked   │ │PageRnk│ │
│  │file→sym→ │ │  lookup  │ │ radius   │ │ digest   │ │rank   │ │
│  │ feat→grep│ │          │ │          │ │          │ │       │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └───────┘ │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Query / Cache Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ ensureFresh() │  │ resolveFile()│  │  fileBlock()          │ │
│  │ stale check   │  │ path lookup  │  │  structured output    │ │
│  └──────┬───────┘  └──────┘───────┘  └───────────┘────────────┘ │
└─────────┼─────────────────┼──────────────────┼──────────────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Build Pipeline                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ makeProject() │  │ build()      │  │  pagerank()           │ │
│  │ ts-morph init │  │ parse → graph│  │  personalized PageRnk │ │
│  │ lazy-loaded   │  │ → symbol idx│  │  damping=0.85         │ │
│  └──────────────┘  └──────┬───────┘  └────────────┬───────────┘ │
│                           │                       │              │
│                           ▼                       ▼              │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │  Cache: .claude/agentmap/map.json (schema v3)                ││
│  │  fingerprint(sha + file hash) → dirty detection              ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│      Infrastructure / Integration Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ MCP Server   │  │ Hooks        │  │ Skill Install          │ │
│  │ mcp.mjs      │  │ post-commit  │  │ skills/install.mjs     │ │
│  │ stdio MCP    │  │ PreToolUse   │  │ skills/guidance.md     │ │
│  │ 6 tools      │  │ nudge        │  │                        │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| CLI Router | Parse flags, dispatch queries, format output | `agentmap.mjs:1458-1831` |
| Build Pipeline | Parse TS/JS, build import graph, compute PageRank, index symbols | `agentmap.mjs:358-795` |
| Cache Layer | Staleness check, map.json read/write, lazy rebuild | `agentmap.mjs:794-870` |
| Hook Installer | Wire post-commit + PreToolUse nudge into target repo | `agentmap.mjs:889-993` |
| Doctor/Status | Diagnose hook/installation health | `agentmap.mjs:1005-1401` |
| MCP Server | Expose agentmap queries as stdio MCP tools | `mcp.mjs` |
| Skill Install | Install agentmap skill for Claude Code | `skills/install.mjs` |
| Test Suite | Black-box CLI tests against temp repos | `test/*.test.mjs` |

## Pattern Overview

**Overall:** Monolith CLI with lazy-loaded dependency

**Key Characteristics:**
- Single file (`agentmap.mjs`, ~1831 lines) contains all core logic — no module decomposition
- ts-morph loaded lazily (~105ms init) so warm cache queries skip it entirely
- Zero external state — only artifact is `.claude/agentmap/map.json`
- Git-aware — uses `git rev-parse` for root detection, SHA for fingerprinting, `git grep` for content fallback
- All I/O synchronous (fs, child_process) — no async/await except MCP server

## Layers

**CLI Entry Layer:**
- Purpose: Parse args, route to handler, format output
- Location: `agentmap.mjs:1458-1831`
- Contains: Flag parsing, dispatch logic, 6 output formatters (text/JSON), usage string
- Depends on: Cache Layer, Build Pipeline, Content Search
- Used by: End user via terminal

**Query / Cache Layer:**
- Purpose: Serve cached results, rebuild only when stale
- Location: `agentmap.mjs:794-870`
- Contains: `ensureFresh()`, `resolveFile()`, `fileBlock()`, `contentSearch()`
- Depends on: Map cache on disk
- Used by: CLI Layer

**Build Pipeline:**
- Purpose: Parse project, build import graph, rank files+symbols
- Location: `agentmap.mjs:358-795`
- Contains: `makeProject()`, `build()`, `pagerank()`, `rankSymbols()`, `extractVueScripts()`
- Depends on: ts-morph, Node fs/child_process
- Used by: Cache Layer (lazy rebuild)

**Infrastructure Layer:**
- Purpose: Installation, diagnostics, MCP integration
- Location: `agentmap.mjs:889-1401`, `mcp.mjs`, `skills/`
- Contains: Hook installer, doctor report, MCP server, skill installer
- Depends on: Node fs, external git hooks
- Used by: End user setup, MCP clients

## Data Flow

### Primary Query Path (`--any`)

1. Parse `--any <query>` flag (`agentmap.mjs:1458-1488`)
2. Ensure map is fresh — check fingerprint vs disk cache (`agentmap.mjs:794-824`)
3. If stale or missing: `build()` → parse TS/JS via ts-morph → build import graph → PageRank → index symbols → write `map.json`
4. Read cached map from `.claude/agentmap/map.json`
5. Route query: exact file path match → structured file block (`agentmap.mjs:1489-1505`)
6. If no file match: symbol fuzzy match by PageRank-weighted identifier score
7. If no symbol: feature match by route segment
8. If no feature: live `git grep` content search fallback (`agentmap.mjs:84-87`)
9. Format output (text or JSON) and print to stdout

### Build Pipeline (`build()`)

1. `sourceFingerprint()` — hash all source files + current git SHA
2. Compare to cached fingerprint — skip if unchanged
3. `makeProject()` — create ts-morph Project with tsconfig resolution + alias config discovery
4. Enumerate all source files matching `SRC_EXT` regex (`agentmap.mjs:113`)
5. For each file: extract exports, imports, and symbol identifiers
6. Handle Vue SFC (`extractVueScripts()`): extract `<script>` blocks as virtual `.ts`/`.js` files
7. Build directed graph edges (file A imports from file B)
8. `pagerank()` — personalized PageRank, 0.85 damping, 100 max iterations, 1e-6 tolerance
9. `rankSymbols()` — Aider-style identifier ranking with boosts for long/rare identifiers
10. `featureOf()` — detect Next.js `app/` route segments
11. Write cache to `map.json`

### Install Flow (`--install-hooks`)

1. Copy `hooks/post-commit` to `.git/hooks/post-commit` + `chmod +x`
2. Copy `hooks/agentmap-nudge.mjs` to `.claude/hooks/agentmap-nudge.mjs`
3. Add `.claude/agentmap/` to `.gitignore`
4. Wire PreToolUse Grep/Bash hooks in `.claude/settings.json`

**State Management:**
- No runtime state — all state in cache file `.claude/agentmap/map.json`
- Fingerprint (SHA + file hashes) determines staleness — no watch mode
- Post-commit hook rebuilds on every commit (background, detached)

## Key Abstractions

**Map Schema v3 (`.claude/agentmap/map.json`):**
- Purpose: Serializable cache of the entire import graph + rankings
- Structure: `{ schemaVersion, files, edges, pagerank, symbols, hubs, features, metadata (sha, dirty, buildTime) }`
- Pattern: Single JSON blob, read/written atomically

**Source Fingerprint:**
- Purpose: Deterministic dirty detection without watch mode
- Content: JSON of `{ [filepath]: sha256 hash }` for all source files + current git SHA
- Compared on each query to decide rebuild

**Feature Detection:**
- Purpose: Group files by route-based feature ownership
- Pattern: `app/<feature>/page.tsx` → feature named after route segment
- Next.js `app/` convention only

## Entry Points

**Primary CLI:**
- Location: `agentmap.mjs` (shebang + argument parsing at line 1458)
- Triggers: User runs `agentmap --any <query>` or any flag
- Responsibilities: Parse flags, ensure fresh map, dispatch query, format output

**MCP Server:**
- Location: `mcp.mjs` (exported `serve()` function)
- Triggers: `node agentmap.mjs --mcp` → dynamic import + call `serve()`
- Responsibilities: Expose 6 MCP tools: `agentmap_any`, `agentmap_find`, `agentmap_relates`, `agentmap_map`, `agentmap_features`, `agentmap_hubs`

**Git Post-Commit Hook:**
- Location: `hooks/post-commit` (shell script installed to `.git/hooks/`)
- Triggers: Every `git commit` (rebuilds in background)
- Responsibilities: Rebuild map silently, skip during rebase/merge/cherry-pick/bisect

**PreToolUse Nudge:**
- Location: `hooks/agentmap-nudge.mjs` (installed to `.claude/hooks/`)
- Triggers: AI agent invokes Grep or Bash tool
- Responsibilities: Inject reminder text suggesting agentmap before grep

## Architectural Constraints

- **Threading:** Single-threaded event loop. No worker threads. Synchronous I/O in build pipeline (blocks event loop during ~1.2s cold build).
- **Global state:** Lazy-loaded `_tsm` module singleton at `agentmap.mjs:29` (`let _tsm = null`). Only instantiated during cold rebuilds.
- **Circular imports:** Not applicable — single file monolith.
- **Git dependency:** All operations assume inside a git repo. `--doctor` handles outside-git degraded mode.
- **TS/JS only:** `SRC_EXT` regex limits to `.ts`, `.tsx`, `.mts`, `.cts`, `.jsx`, `.js`, `.mjs`, `.cjs`, `.vue`. Vue support via `extractVueScripts()` virtual file approach.

## Anti-Patterns

### Monolith file

**What happens:** All core logic is in single `agentmap.mjs` (~1831 lines). CLI parsing, build pipeline, cache, hooks, diagnostics, and output formatting coexist in one file with no module decomposition.
**Why it's wrong:** Makes it harder to test individual components in isolation. Increases cognitive load. Risk of unintended side effects from global state. The `src/` directory exists but is empty — code was never decomposed.
**Do this instead:** Split into `src/Core/` modules: `build.mjs`, `pagerank.mjs`, `symbols.mjs`, `caching.mjs`, `hooks.mjs`, `cli.mjs`, `formatters.mjs`.

### Synchronous I/O blocking event loop

**What happens:** `build()` uses `execSync`, `readFileSync`, `writeFileSync`. The cold build (~1.2s) blocks the Node event loop completely.
**Why it's wrong:** If agentmap were run in a server context (e.g., MCP long-running process), the blocking build would freeze all concurrent requests.
**Do this instead:** Make build pipeline async, use `execFile` / `readFile` promises, or offload to worker thread.

### Vue SFC handling via virtual files

**What happens:** `extractVueScripts()` extracts `<script>` content and writes virtual paths like `file.vue.ts` to parse with ts-morph. Virtual paths are tracked in a global `Set` at module scope (`agentmap.mjs:157`).
**Why it's wrong:** Virtual paths leak into the file map — `leakedVirtualPaths()` helper exists specifically to detect this. Global mutable set is not reset between builds.
**Do this instead:** Pass virtual paths as a local collection parameter through the build pipeline.

## Error Handling

**Strategy:** Fail-fast with stdout/stderr messages. Child commands use try-catch with empty-string fallback (`sh()` helper). `--doctor` reports structured issues with suggestions.

**Patterns:**
- All `execSync` calls wrapped in try-catch via `sh()` helper returning empty string on failure (`agentmap.mjs:62`)
- Map deserialization fallback: if JSON parse fails on cached map, trigger full rebuild (`agentmap.mjs:803-808`)
- ts-morph errors during `makeProject()` caught and logged, graceful degradation for unsupported files
- No custom error classes — strings only

## Cross-Cutting Concerns

**Logging:** No logging framework. Only `console.log` for CLI output. Hooks run silenced (`>/dev/null 2>&1`).
**Validation:** No input validation on `--any` query string (potential injection vector — `agentmap.mjs:84` concatenates query into `git grep` command via string interpolation).
**Authentication:** Not applicable — no network services (except MCP stdio which is local-only).
**Security:** `git grep` content search at `agentmap.mjs:84` uses string interpolation of user query — documented as "caveman" in tests, validated via `injection-safety.test.mjs`.

---

*Architecture analysis: 2026-06-19*
