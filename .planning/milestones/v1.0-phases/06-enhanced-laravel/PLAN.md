# Phase 6: Enhanced Laravel — Plan

**Status:** Retroactive — work shipped in commits `25ad25f`, `6083081`.

## Plan 06-01: Blade Template Parser + Livewire Bindings

**Requirements:** LARAV-05, LARAV-06, LARAV-07, LARAV-08

**Files:**
- `src/Core/EnhancedLaravelParser.mjs:98` — `parseBlade()`
- `src/Core/EnhancedLaravelParser.mjs:75` — `_discoverBladeFiles()`
- `test/enhanced-laravel.test.mjs:18-71` — Blade + Livewire suites

**Implementation:**
- Regex-based directive extraction (`@<directive>` from `BLADE_DIRECTIVES` whitelist)
- `@include('foo.bar')` resolved to `resources/views/foo/bar.blade.php`
- `@livewire('comp')` extracted as cross-language reference
- `wire:model="prop"` and `wire:click="method"` parsed from HTML attributes

**Verification:** 4 tests pass.

## Plan 06-02: DDD/Repository + Artisan Commands

**Requirements:** LARAV-09, LARAV-10, LARAV-15

**Files:**
- `src/Core/EnhancedLaravelParser.mjs:277` — `detectDDD()`
- `src/Core/EnhancedLaravelParser.mjs:201` — `parseArtisan()`
- `src/Core/EnhancedLaravelParser.mjs:255` — `_parseSignature()`
- `test/enhanced-laravel.test.mjs:97-147` — Artisan + DDD suites

**Implementation:**
- DDD pattern: substring match against `DDD_MARKERS` (Action, Domain, Repository, Service, DTO, Query, Command, Policy, Observer, Job, Event, Listener, Notification, Resource, Cast, Rule)
- Artisan: parse `protected $signature = '...'` string for command name + args + options
- Repository pattern: bind interface→implementation via DDD marker detection

**Verification:** 3 tests pass.

## Plan 06-03: Middleware Tracing + Migration Parsing

**Requirements:** LARAV-11, LARAV-12

**Files:**
- `src/Core/EnhancedLaravelParser.mjs:317` — `detectMiddleware()`
- `src/Core/EnhancedLaravelParser.mjs:149` — `parseMigration()`
- `src/Core/EnhancedLaravelParser.mjs:89` — `_discoverMigrations()`
- `test/enhanced-laravel.test.mjs:72-95, 148-162` — Middleware + Migration suites

**Implementation:**
- Middleware: AST scan for `->middleware('...')` chained calls; resolves middleware aliases from `app/Http/Kernel.php` if present
- Migration: extracts `Schema::create('table', ...)` table names, `$table->type('col')` columns, `$table->foreign(...)` foreign keys

**Verification:** 3 tests pass.

## Plan 06-04: Static Analysis + Tests

**Requirements:** LARAV-13, LARAV-14, TEST-05

**Files:**
- `src/Core/EnhancedLaravelParser.mjs:420` — `inferTypes()`
- `src/Core/EnhancedLaravelParser.mjs:375` — `traceMethodCalls()`
- `test/enhanced-laravel.test.mjs:163-245` — Type + Tracing + Discovery suites

**Implementation:**
- Type inference: walks AST nodes for `property_declaration`, `parameter_declaration`, `return_type` and reads declared PHP type hints (no inference engine; pure declaration extraction)
- Call tracing: AST scan for `member_call_expression` and `scoped_call_expression`, emits `{caller, callee}` pairs
- TEST-05: real Laravel-shaped fixtures created in temp dirs per test

**Verification:** 5 tests pass. Total Phase 6 tests: 15/15. All 139 prior tests still pass per commit `6083081`.

## Total

- 4 plans, all complete
- 15 LARAV requirements satisfied (LARAV-05..15)
- 1 test requirement satisfied (TEST-05)
- 0 regressions
