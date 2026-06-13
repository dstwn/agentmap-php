# Changelog

All notable changes to agentmap are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.3] - 2026-06-14

### Changed
- **Docs only — no code change since 0.2.2.** README restructured to lead with the
  benchmark (now a before/after table of real per-task token counts: reading files vs
  agentmap) and the agent-loop differentiator, with plain-language section intros.
  CI actions bumped to v5 (Node 24). Published to sync the npm package page with the
  GitHub README.

## [0.2.2] - 2026-06-13

### Changed
- **`--install-hooks` now auto-wires the `PreToolUse(Grep)` nudge into the project's
  `.claude/settings.json`** (merge-safe + idempotent) instead of only printing the
  snippet — so the "agent is forced to use the map" enforcement is on by default
  after install, with no manual copy-paste step.

### Performance
- **Lazy-load `ts-morph`.** Its ~105 ms compiler init now fires only on a cold
  rebuild; warm cache queries (the common case on a clean tree) skip it entirely via
  `createRequire`, making them ~2× faster — measured **217 ms → 105 ms** median
  (−52%) on a clean-tree fixture. Cold-build time is unchanged.

## [0.2.1] - 2026-06-13

### Changed
- **License simplified to MIT-only.** Removed `LICENSE-APACHE` from the repo and
  the npm tarball. agentmap's PageRank / symbol ranking is an independent
  JavaScript reimplementation of a public algorithm (Aider calls `networkx`; no
  Aider source is copied), so it is not a derivative work and carries no
  Apache-2.0 obligation. Aider remains credited in `NOTICE` and the README as
  the origin of the ranking approach. Fixes GitHub showing an "Unknown" license.

## [0.2.0] - 2026-06-13

### Added
- **New CLI flags**: `--help` / `-h`, `--version` / `-v`, `--json` (global output modifier),
  `--install-hooks`, `--mcp` — full spec in README.
- **`--json` structured output** for all query commands (`--hubs`, `--features`, `--feature`,
  `--find`, `--relates`, `--map`, `--symbols`, `--any`, `--print`, bare build); enables
  machine-readable consumption by MCP clients and CI scripts.
- **MCP server** (`mcp.mjs`) — stdio MCP transport wrapping all query commands; launched via
  `agentmap --mcp` or directly. Ships in the npm tarball.
- **Hooks shipped in tarball** — `hooks/` directory (post-commit auto-refresh +
  `agentmap-nudge.mjs` PreToolUse hook for Claude Code) now listed in `package.json` `files`;
  installed into a repo via `agentmap --install-hooks`.
- **Apache-2.0 attribution** — `LICENSE-APACHE` and `NOTICE` added to credit Aider's
  PageRank / identifier-graph algorithm that agentmap ports.
- **Test suite** — `test/` directory with `node --test` runner; `npm test` entry point added
  to `package.json`.
- **CI** — GitHub Actions workflow running tests and a dry-run `npm pack` on every push.

### Fixed
- Corrected all npm-fetch references to use the scoped name `@raymondchins/agentmap`
  (the bare name `agentmap` on npm is an unrelated tool).
- Stale-cache robustness: cache invalidation now detects monorepo roots, path aliases,
  symlinked node_modules, spaces in paths, and large repos (>10 k files).
- `--print` JSON output now includes top-level `fileCount`.
- Unknown flags now print to stderr and exit 2 instead of silently rebuilding.
- Exit codes formalized: 0 = success, 1 = zero-result query, 2 = usage error.

### Changed
- Internal rename: entry file `repomap.mjs` → `agentmap.mjs`, cache file `.claude/repomap.json`
  → `.claude/agentmap.json`, and PreToolUse nudge hook `repomap-nudge.mjs` →
  `agentmap-nudge.mjs` — aligns all internal filenames with the published binary name.
- `package.json` `files` allowlist expanded from `["agentmap.mjs"]` to include `mcp.mjs`,
  `hooks/`, `LICENSE-APACHE`, and `NOTICE`.
- `.npmignore` removed — the `files` allowlist fully governs the tarball.

### Performance
- Faster cold builds: `skipFileDependencyResolution` plus `git ls-files`-based source
  enumeration (replacing an expensive full-tree FS glob) make a full build net faster
  than v0.1.0 while indexing the same-or-more files.

[0.2.3]: https://github.com/raymondchins/agentmap/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/raymondchins/agentmap/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/raymondchins/agentmap/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/raymondchins/agentmap/compare/v0.1.0...v0.2.0
