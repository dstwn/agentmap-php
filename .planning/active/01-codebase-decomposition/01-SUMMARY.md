---
phase: 1
name: codebase-decomposition
shipped_in: 25ad25f, 6083081
date: 2026-06-19
requirements_completed: [DECOMP-01, DECOMP-02, TEST-01]
key_files:
  created:
    - src/Core/index.mjs
    - src/Core/language-parser.mjs
    - src/Core/PhpParser.mjs
    - src/Core/cli.mjs
    - src/Core/map-builder.mjs
    - src/Core/graph.mjs
    - src/Core/rank.mjs
    - src/Core/cache.mjs
    - src/Core/utils.mjs
    - src/Core/vue.mjs
    - src/Core/constants.mjs
  modified:
    - agentmap.mjs
    - package.json
one_liner: Decomposed agentmap.mjs monolith into src/Core/ modules with LanguageParser plugin interface; agentmap.mjs re-exports preserve all existing CLI behavior.
---

# Phase 1 Summary: Codebase Decomposition

## What Was Built

Extracted the monolithic `agentmap.mjs` (~1831 lines) into modular `src/Core/`:

- `language-parser.mjs` — abstract LanguageParser contract (extension point for new languages)
- `PhpParser.mjs` — concrete implementation (built in this phase, used by Phase 2+)
- `map-builder.mjs` — repo map generation
- `graph.mjs` — import graph construction
- `rank.mjs` — PageRank + symbol ranking
- `cache.mjs` — file-stat-based cache
- `cli.mjs` — argument parsing and command dispatch
- `utils.mjs`, `vue.mjs`, `constants.mjs` — supporting modules

`agentmap.mjs` re-exports the surface area unchanged — all 116 existing TS/JS tests pass without modification.

## Decisions

| Decision | Rationale |
|----------|-----------|
| Plugin interface via `LanguageParser` base | Open/closed: new languages add a parser, no core changes |
| Keep `agentmap.mjs` as facade | Zero breakage for existing imports / installs |
| ESM modules (`.mjs`) | Matches existing project convention |

## Verification

- 116 original TS/JS tests still pass (no behavioral regression)
- Module structure visible at `src/Core/` (12 files, 2065 LOC including PHP/Laravel parsers)
