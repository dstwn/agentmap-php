# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-19)

**Core value:** Give PHP/Laravel developers the same repo-context superpower that TS/JS projects get from agentmap

**Current focus:** All v1 phases complete — ready for v2 planning (Python/Go/Rust support, advanced analysis)

## Active Phase

None — Phase 6 complete. Awaiting next milestone.

## Completed Phases

- Phase 1: Codebase decomposition — `src/Core/` modules created (LanguageParser, PhpParser, utils, graph, rank, cache, vue)
- Phase 2: PHP parsing engine — tree-sitter-php parser with AST extraction for classes, interfaces, traits, enums, functions, namespaces, imports
- Phase 3: PHP CLI integration — PHP files discovered, parsed, merged into unified graph with PageRank + symbol ranking
- Phase 4: Laravel awareness — Route detection, facade calls, Eloquent relations, service providers
- Phase 5: Mixed projects — TS/JS + PHP unified graph, cross-language support, 5 new test suites
- Phase 6: Enhanced Laravel — Blade templates, Livewire bindings, DDD/Actions/Repository, Artisan, middleware, migrations, type inference, call tracing (15 new tests)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Add PHP to existing Node.js codebase | Preserves all existing TS/JS functionality | Good |
| Use tree-sitter-php v0.22.6 + tree-sitter v0.22.4 | Compatible versions that work together | Good |
| Keep agentmap.mjs intact, add PHP alongside | Avoids breaking 116 existing tests — all still pass | Good |
| PHP files discovered via git ls-files + FS walk | Same approach as TS/JS file discovery | Good |
| PSR-4 resolution via composer.json | Standard PHP autoloading convention | Good |
| Blade parsed via regex, not tree-sitter | tree-sitter-blade unmaintained; regex sufficient | Good |
| EnhancedLaravelParser extends PhpParser | Reuses PSR-4 + AST infrastructure | Good |
| DDD detection via filename/class substring match | Convention-over-config, Laravel idiom | Good |
| Type inference reads PHP type hints only | Deep inference out-of-scope per REQUIREMENTS | Good |

## Notes

- All 154 tests pass (116 original + 8 PHP parser + 7 Laravel + 5 mixed project + 3 more + 15 enhanced Laravel)
- PHP files merged into same `files` object as TS/JS — unified PageRank + symbol ranking
- Laravel: Route::get/post/resource, facade calls (Cache::, DB::, etc.), Eloquent hasMany/belongsTo
- Enhanced Laravel: `.blade.php` extension, `parseBlade/Migration/Artisan`, `detectDDD/Middleware`, `traceMethodCalls`, `inferTypes`
- Dependencies: `tree-sitter@0.22.4`, `tree-sitter-php@0.22.6`
- Phase 6 documented retroactively from commits `25ad25f`, `6083081` on 2026-06-19
