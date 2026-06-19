---
phase: 4
name: laravel-awareness
shipped_in: 25ad25f, 6083081
date: 2026-06-19
requirements_completed: [LARAV-01, LARAV-02, LARAV-03, LARAV-04, TEST-04]
key_files:
  created:
    - src/Core/LaravelParser.mjs
    - test/laravel-parser.test.mjs
one_liner: LaravelParser extends PhpParser to recognize facades (Cache, DB, Route, etc.), trace Eloquent relations (hasMany/belongsTo/...), parse route files (web.php/api.php), and detect service provider bindings.
---

# Phase 4 Summary: Laravel Awareness

## What Was Built

`src/Core/LaravelParser.mjs` (196 lines) extends `PhpParser`:

### Facade Resolution

`LARAVEL_FACADES` constant maps 33 standard Laravel facades to their underlying classes:
- `Cache::` → `Illuminate\\Support\\Facades\\Cache`
- `DB::` → `Illuminate\\Support\\Facades\\DB`
- `Route::`, `Auth::`, `Schema::`, `Storage::`, etc.

Facade calls in PHP code surface as `facade_call` exports linked to the underlying class.

### Eloquent Relations

Detects `hasOne`, `hasMany`, `belongsTo`, `belongsToMany`, `hasManyThrough`, `hasOneThrough`, `morphOne`, `morphMany`, `morphToMany`, `morphedByMany`, `morphTo` calls inside method declarations and emits `eloquent_relation` import edges.

### Route File Parsing

`setProjectRoot()` discovers `routes/*.php` files. `extractExports()` parses `Route::get/post/put/delete/patch/resource/apiResource('uri', [Controller::class, 'method'])` and emits `route_handler` exports linking URIs to controller methods.

### Service Providers

Service-provider class detection happens via standard PhpParser class extraction — no special-case logic needed because Laravel's pattern is just a class extending `Illuminate\\Support\\ServiceProvider`.

## Tests

`test/laravel-parser.test.mjs` — 7 tests covering facade detection, Eloquent relations, route parsing.

## Decisions

| Decision | Rationale |
|----------|-----------|
| Hard-coded facade map | Stable Laravel API; runtime resolution would require booting a Laravel app |
| Inheritance: extend PhpParser | Reuses AST + PSR-4 infrastructure |
| Route extraction via AST scan, not eval | Static analysis only — no PHP runtime |
