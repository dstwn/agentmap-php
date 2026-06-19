---
phase: 3
name: php-commands
shipped_in: 25ad25f, 6083081
date: 2026-06-19
requirements_completed: [PHP-05, PHP-06, PHP-07]
key_files:
  modified:
    - agentmap.mjs
    - src/Core/cli.mjs
    - src/Core/map-builder.mjs
one_liner: Wired PHP files into all CLI commands — --any router, --map, --digest, --relates, --find, --hub, --symbols all surface PHP results alongside TS/JS.
---

# Phase 3 Summary: PHP Commands

## What Was Built

PHP files now flow through every existing CLI command:

| Command | PHP Behavior |
|---------|-------------|
| `--any <target>` | Routes PHP files/symbols/features through same logic as TS/JS |
| `--map` | PHP files included in token-budgeted repo map |
| `--digest` | PHP files included in compact digest |
| `--relates <file>` | PHP imports show as edges; cross-language edges supported |
| `--find <symbol>` | Returns PHP class/function definitions |
| `--hub` | PHP hub files surface in PageRank top-N |
| `--symbols` | PHP symbols listed alongside TS/JS |

## Implementation

PhpParser registered alongside existing TS/JS parser in the language-parser pipeline. File discovery (git ls-files + FS walk) already returns `.php` files; the parser registry routes them to `PhpParser`.

## Tests

Existing CLI tests (`any-routing.test.mjs`, `json.test.mjs`, etc.) exercised against PHP fixtures — all pass without command-level code changes beyond parser registration.

## Decisions

| Decision | Rationale |
|----------|-----------|
| No new CLI flags for PHP | Goal is unified UX — PHP is just another language to existing commands |
| File discovery shared with TS/JS | Single source of truth for repo file enumeration |
