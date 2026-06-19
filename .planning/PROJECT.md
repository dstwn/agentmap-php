# agentmap-php

## What This Is

A fork of [agentmap](https://github.com/raymondchins/agentmap) that extends the repo-mapping tool to PHP and Laravel codebases — providing import graphs, symbol ranking, token-budgeted context digests, Laravel-aware analysis (facades, Eloquent, routes, Blade, Livewire, DDD, Artisan, middleware, migrations), and AI-agent integration on par with TypeScript/JavaScript support.

## Core Value

Give PHP/Laravel developers (and their AI coding agents) the same repo-context superpower TS/JS projects get from agentmap — ranked import graphs, queryable code maps, and dramatically reduced token budgets for understanding a codebase.

## Current State (v1.0)

**Shipped:** 2026-06-19 via [PR #1](https://github.com/dstwn/agentmap-php/pull/1)

- 196/196 tests passing
- Modular `src/Core/` (12 modules, 2065 LOC)
- All v1 requirements (30/30) satisfied
- Available languages: TS/JS, Vue SFC, PHP, Laravel (full stack)

## Business Context

- **Customer:** PHP/Laravel developers using AI coding agents (Claude Code, Cursor, Copilot, etc.)
- **Revenue model:** Open-source (MIT), public fork
- **Success metric:** PHP/Laravel codebases pass all existing agentmap tests + new PHP-specific tests ✓ (achieved 196/196)
- **Strategy:** Public fork on GitHub; documented for the Laravel community

## Requirements

### Validated (v1.0)

- ✓ DECOMP-01: Decomposed `agentmap.mjs` into `src/Core/` with plugin interface — v1.0
- ✓ DECOMP-02: All existing CLI flags and output formats unchanged — v1.0
- ✓ PHP-01..04: Full PHP parsing (AST, imports, PSR-4, ranking) — v1.0
- ✓ PHP-05..07: PHP wired into all CLI commands — v1.0
- ✓ LARAV-01..04: Facade resolution, Eloquent, routes, providers — v1.0
- ✓ LARAV-05..15: Blade, Livewire, DDD, Artisan, middleware, migrations, types, call tracing — v1.0
- ✓ MIXED-01..02: Unified TS/JS+PHP graph, cross-language references — v1.0
- ✓ TEST-01..05: All test suites pass (196/196) — v1.0

### Active (v1.1+)

To be defined via `/gsd-new-milestone`. Candidate themes from REQUIREMENTS.md v2 section:

- Python support (LANG-01)
- Go support (LANG-02)
- Rust support (LANG-03)
- Full PHP type resolution beyond declared types (ADV-01)
- Composer package dependency graph (ADV-04)

### Out of Scope

- Rewriting agentmap in PHP — core stays Node.js
- Deep static type inference engine (declared types only suffice)
- npm/Packagist publish (v1 ships as GitHub fork; publish later)

## Context

- **Tech stack:** Node.js >= 18, ESM modules (`.mjs`), tree-sitter (PHP + JS grammar families)
- **Tests:** 196 passing — 116 original TS/JS, 8 PHP parser, 7 Laravel, 5 mixed, 15 enhanced Laravel, 45 hooks/install/integration
- **Architecture:** `src/Core/` plugin pattern — new languages add a parser module, no core changes
- **Current parser stack:** EnhancedLaravelParser (PHP) → LaravelParser → PhpParser → LanguageParser

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Add PHP to existing Node.js codebase | Preserves all TS/JS functionality | ✓ Good |
| tree-sitter-php for parsing | Mature, no PHP runtime dependency | ✓ Good |
| Decompose monolith into `src/Core/` | Plugin architecture for future languages | ✓ Good |
| Public fork (not PR upstream) | agentmap is TS/JS-only by design | ✓ Good |
| Blade via regex (not tree-sitter-blade) | tree-sitter-blade unmaintained | ✓ Good |
| EnhancedLaravelParser extends PhpParser (not LaravelParser) | Avoid double-inheritance | ✓ Good |
| DDD detection by naming convention | Laravel community follows conventions strictly | ✓ Good — projects with custom names extend `DDD_MARKERS` |
| Type inference reads declared types only | Deep inference out-of-scope | ✓ Good |
| Static facade map (not runtime resolution) | Stable Laravel API | ⚠️ Revisit — may need updates for new Laravel versions |

## Constraints

- **Compatibility:** All existing CLI flags and output formats must remain unchanged (achieved ✓)
- **Performance:** PHP parsing comparable to TS/JS speed (achieved ✓)
- **Dependencies:** Minimize additions — only `tree-sitter` + `tree-sitter-php` added

---
*Last updated: 2026-06-19 after v1.0 milestone*
