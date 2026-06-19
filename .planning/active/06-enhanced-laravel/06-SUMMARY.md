---
phase: 6
name: enhanced-laravel
shipped_in: 25ad25f, 6083081
date: 2026-06-19
requirements_completed: [LARAV-05, LARAV-06, LARAV-07, LARAV-08, LARAV-09, LARAV-10, LARAV-11, LARAV-12, LARAV-13, LARAV-14, LARAV-15, TEST-05]
key_files:
  created:
    - src/Core/EnhancedLaravelParser.mjs
    - test/enhanced-laravel.test.mjs
  modified:
    - agentmap.mjs
one_liner: EnhancedLaravelParser adds Blade directive parsing, Livewire bindings, DDD/Action/Repository/Service detection, Artisan signature parsing, middleware tracing, migration schema extraction, declared-type inference, and method-call tracing.
---

# Phase 6 Summary: Enhanced Laravel

## What Was Built

`src/Core/EnhancedLaravelParser.mjs` (483 lines) — extends `PhpParser` (not LaravelParser, by design):

| Method | Line | Capability |
|--------|------|------------|
| `parseBlade()` | 98 | Blade directives + `@include`/`@extends` resolution + Livewire `wire:*` bindings |
| `parseMigration()` | 149 | `Schema::create('table')` + column types + foreign keys |
| `parseArtisan()` | 201 | `$signature` string → command name + args + options |
| `_parseSignature()` | 255 | Parses `mail:send {user} {--queue}` syntax |
| `detectDDD()` | 277 | Action/Domain/Repository/Service/DTO/Query/Command/Policy/Observer/Job/Event/Listener/Notification/Resource/Cast/Rule |
| `detectMiddleware()` | 317 | Route::middleware, ->middleware, ->withoutMiddleware chains |
| `traceMethodCalls()` | 375 | function_call / member_call / scoped_call → caller→callee pairs |
| `inferTypes()` | 420 | Declared property/parameter/return types from PHP type hints |

`agentmap.mjs:32` swaps the default PHP parser to `EnhancedLaravelParser` so all PHP files parsed by agentmap get the full Laravel awareness layer.

## Tests

`test/enhanced-laravel.test.mjs` — 15 tests across 11 suites covering all 8 methods + Blade-file discovery + migration-file discovery.

## Decisions

| Decision | Rationale |
|----------|-----------|
| Blade via regex, not tree-sitter-blade | tree-sitter-blade is unmaintained; regex sufficient for directive extraction |
| EnhancedLaravelParser extends PhpParser (not LaravelParser) | Avoid double-inheritance complexity; LaravelParser features (facades, Eloquent, routes) are orthogonal to enhanced features |
| Type inference reads declared types only | Deep inference out-of-scope per REQUIREMENTS; declared types cover the goal-backward use case |
| DDD detection via filename/class substring match | Convention-over-config — Laravel community follows naming conventions strictly |
