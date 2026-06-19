# agentmap-php

## What This Is

A fork of [agentmap](https://github.com/raymondchins/agentmap) v0.9.0 that extends the repo-mapping tool to support PHP and Laravel codebases — providing import graphs, symbol ranking, token-budgeted context digests, and AI-agent integration for PHP projects, on par with the existing TypeScript/JavaScript support.

## Core Value

Give PHP/Laravel developers (and their AI coding agents) the same repo-context superpower that TS/JS projects get from agentmap — ranked import graphs, queryable code maps, and dramatically reduced token budgets for understanding a codebase.

## Business Context

- **Customer**: PHP/Laravel developers using AI coding agents (Claude Code, Cursor, Copilot, etc.)
- **Revenue model**: Open-source (MIT), public fork
- **Success metric**: PHP/Laravel codebases pass all existing agentmap tests plus new PHP-specific tests
- **Strategy notes**: Public fork published to npm/packagist, documented for Laravel community

## Requirements

### Validated

- Import graph for TS/JS projects (inherited)
- PageRank hub detection (inherited)
- Symbol ranking / identifier graph (inherited)
- Token-budgeted repo map digest (inherited)
- `--any` router (file → symbol → feature → live grep) (inherited)
- MCP server (inherited)
- Post-commit auto-refresh hook (inherited)
- Agent nudge hooks (inherited)
- Doctor health report (inherited)

### Active

- [ ] **PHP-01**: Parse PHP files — extract classes, functions, namespaces, imports
- [ ] **PHP-02**: Build import graph for `.php` files (use/require/include)
- [ ] **PHP-03**: PageRank and symbol ranking for PHP code
- [ ] **PHP-04**: Laravel-aware analysis (facades, Eloquent, routes, service providers, Artisan commands)
- [ ] **PHP-05**: Mixed-project support (TS/JS + PHP in same repo)
- [ ] **PHP-06**: All existing agentmap commands work with PHP files
- [ ] **PHP-07**: All existing tests continue to pass
- [ ] **PHP-08**: PHP-specific test suite

### Out of Scope

- Rewriting agentmap in PHP — the core remains Node.js/TypeScript with tree-sitter-php added
- Full PHP type system analysis — import graph + symbol ranking, not deep static analysis
- Other languages (Python, Go, Rust, etc.) — PHP first, others later

## Context

- agentmap is a single-file CLI (`agentmap.mjs`, ~1831 lines) with all logic in one file — this design debt should be addressed by decomposing into `src/Core/` modules
- Currently uses `ts-morph` (TypeScript compiler wrapper) for all language analysis — PHP support requires a different parser (tree-sitter-php)
- The `src/` directory exists but is currently empty — intentional decomposition target
- Laravel has specific patterns (facades, Eloquent, routes, service providers) that need special handling for meaningful symbol ranking
- tree-sitter-php is mature and has Node.js bindings (`web-tree-sitter` or `tree-sitter` npm package)

## Constraints

- **Tech stack**: Node.js >= 18, ESM modules (.mjs), tree-sitter-php for parsing
- **Compatibility**: All existing CLI flags and output formats must remain unchanged
- **Performance**: PHP parsing must be comparable to TS/JS parsing speed
- **Dependencies**: Minimize new dependencies — tree-sitter-php + PHP grammar is the main addition

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Add PHP to existing Node.js codebase | Preserves all existing TS/JS functionality; avoids rewriting from scratch | ✓ Good |
| Use tree-sitter-php for parsing | Mature, fast, has Node.js bindings, already used in similar tools | — Pending |
| Decompose monolith during PHP work | `src/` dir is already scaffolded — extract modules as part of this work | — Pending |
| Public fork, not PR upstream | agentmap is TS/JS-only by design; PHP support is a fork's value | ✓ Good |

---
*Last updated: 2026-06-19 after initial definition*
