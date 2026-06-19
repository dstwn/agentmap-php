# Phase 6: UAT

**Status:** Retroactive — verified against shipped code on 2026-06-19.

## Acceptance Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `.blade.php` files parsed; directives extracted | Pass | `parseBlade()` + "extracts blade directives" test |
| 2 | Livewire components recognized; `wire:*` bindings traced | Pass | "detects @livewire directives", "detects wire:model and wire:click bindings" |
| 3 | DDD structure detected (Domains/Actions/Repositories/Services/DTOs) | Pass | `detectDDD()` + "detects Action classes", "detects Repository and Service classes" |
| 4 | Artisan commands parsed (`$signature`, args, options) | Pass | `parseArtisan()` + "extracts command signature and arguments" |
| 5 | Middleware traced — route assignments + class resolution | Pass | `detectMiddleware()` + "detects middleware calls in routes" |
| 6 | Migration files parsed — schemas, columns, FKs | Pass | `parseMigration()` + "extracts table creation and columns" |
| 7 | Basic type inference — return/param/property types | Pass | `inferTypes()` + "extracts property types", "extracts parameter types" |
| 8 | Method call tracing — controller→service→repository chains | Pass | `traceMethodCalls()` + "traces method calls in controller" |
| 9 | All existing tests (139) still pass | Pass | Commit `6083081`: "wire EnhancedLaravelParser into agentmap and fix all 15 tests" |

## Test Run

```
$ node --test test/enhanced-laravel.test.mjs
# tests 15
# pass 15
# fail 0
# duration_ms 87.95
```

## Open Items

None. All LARAV-05..15 + TEST-05 requirements satisfied.
