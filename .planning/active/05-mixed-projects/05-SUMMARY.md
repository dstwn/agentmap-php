---
phase: 5
name: mixed-projects
shipped_in: 25ad25f, 6083081
date: 2026-06-19
requirements_completed: [MIXED-01, MIXED-02, TEST-03]
key_files:
  created:
    - test/mixed-project.test.mjs
  modified:
    - src/Core/map-builder.mjs
    - src/Core/graph.mjs
one_liner: Unified TS/JS and PHP files into one graph — file discovery, parser registry, and PageRank pipeline operate cross-language; Inertia-style references between TS/JS components and PHP controllers are detected.
---

# Phase 5 Summary: Mixed Projects

## What Was Built

Repos containing both `.ts`/`.js`/`.vue` and `.php`/`.blade.php` files now produce a single unified graph:

- **File discovery** returns all language extensions in one pass
- **Parser registry** routes each file to its language parser (TS/JS via existing parser, PHP via PhpParser/LaravelParser)
- **Graph construction** merges nodes from all parsers into one symbol/import graph
- **PageRank** runs over the unified graph — a PHP controller importing TS/JS via Inertia surfaces in cross-language hub queries

### Cross-Language References

Inertia integration emits cross-language edges: PHP `Inertia::render('Component')` → TS/JS `resources/js/Pages/Component.tsx`. The graph treats these as ordinary edges; `--relates` and `--hub` traverse them transparently.

## Tests

`test/mixed-project.test.mjs` — 5 tests covering:
- TS+PHP repos produce one graph
- PHP files appear in `--map` alongside TS/JS
- Cross-language `--relates` finds PHP↔TS references
- `--hub` ranks across both languages
- Symbol queries return mixed results

## Decisions

| Decision | Rationale |
|----------|-----------|
| One graph (not parallel graphs) | Cross-language hubs only emerge in unified ranking |
| Inertia detection optional | Most cross-language patterns are project-specific; Inertia is the most common Laravel+TS bridge |
