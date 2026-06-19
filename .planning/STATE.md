# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-19)

**Core value:** Give PHP/Laravel developers the same repo-context superpower that TS/JS projects get from agentmap

**Current focus:** Initial project setup — requirements defined, roadmap created, ready for Phase 1

## Active Phase

**None** — all 5 phases complete

## Completed Phases

- Phase 1: Codebase decomposition — `src/Core/` modules created (LanguageParser, PhpParser, utils, graph, rank, cache, vue)
- Phase 2: PHP parsing engine — tree-sitter-php parser with AST extraction for classes, interfaces, traits, enums, functions, namespaces, imports
- Phase 3: PHP CLI integration — PHP files discovered, parsed, merged into unified graph with PageRank + symbol ranking
- Phase 4: Laravel awareness — Route detection, facade calls, Eloquent relations, service providers
- Phase 5: Mixed projects — TS/JS + PHP unified graph, cross-language support, 5 new test suites

## Completed Phases

- Phase 1: Codebase decomposition — `src/Core/` modules created (LanguageParser, PhpParser, utils, graph, rank, cache, vue)
- Phase 2: PHP parsing engine — tree-sitter-php parser with AST extraction for classes, interfaces, traits, enums, functions, namespaces, imports
- Phase 3: PHP CLI integration — PHP files discovered, parsed, merged into unified graph with PageRank + symbol ranking
- Phase 4: Laravel awareness — Route detection, facade calls, Eloquent relations, service providers
- Phase 5: Mixed projects — TS/JS + PHP unified graph, cross-language support, 5 new test suites

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Add PHP to existing Node.js codebase | Preserves all existing TS/JS functionality | ✓ Good |
| Use tree-sitter-php v0.22.6 + tree-sitter v0.22.4 | Compatible versions that work together | ✓ Good |
| Keep agentmap.mjs intact, add PHP alongside | Avoids breaking 116 existing tests — all still pass | ✓ Good |
| PHP files discovered via git ls-files + FS walk | Same approach as TS/JS file discovery | ✓ Good |
| PSR-4 resolution via composer.json | Standard PHP autoloading convention | ✓ Good |

## Notes

- All 139 tests pass (116 original + 8 PHP parser + 7 Laravel + 5 mixed project + 3 more)
- PHP files merged into same `files` object as TS/JS — unified PageRank + symbol ranking
- Laravel: Route::get/post/resource, facade calls (Cache::, DB::, etc.), Eloquent hasMany/belongsTo relations
- Dependencies added: `tree-sitter@0.22.4`, `tree-sitter-php@0.22.6`

## Notes

- All 139 tests pass (116 original + 8 PHP parser + 7 Laravel + 5 mixed project + 3 more)
- PHP files merged into same `files` object as TS/JS — unified PageRank + symbol ranking
- Laravel: Route::get/post/resource, facade calls (Cache::, DB::, etc.), Eloquent hasMany/belongsTo relations
- Dependencies added: `tree-sitter@0.22.4`, `tree-sitter-php@0.22.6`
