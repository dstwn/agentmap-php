---
name: agentmap
description: >-
  Use for PHP/Laravel and TypeScript/JavaScript codebase navigation — symbol
  lookup, blast radius, reuse checks, and repo orientation. Knows Laravel:
  facades, Eloquent relations, routes, Blade templates, Livewire components,
  DDD/Action/Repository patterns, Artisan commands, middleware, migrations.
  Prefer agentmap before serial grep when exploring imports, exports, use
  statements, or where a symbol lives. This is the agentmap-php fork
  (raymondchins/agentmap + tree-sitter-php).
---

# agentmap-php

Queryable, ranked **import graph** for PHP/Laravel and TS/JS repos (PageRank hubs, symbol ranking, token-budgeted digest). Faster and more accurate than grep for structural questions. Laravel-aware: facades, Eloquent, routes, Blade, Livewire, DDD, Artisan, middleware, migrations.

## When to use

- **Where is X defined?** / **who imports this file?** / **what breaks if I edit this?**
- **Reuse check** before adding a util, component, PHP class, Action, or Repository
- **Laravel structure** — which controller handles a route, what a model relates to, which Blade view a directive includes
- **Session start** — orient to a large monorepo or Laravel app cheaply

## When not to use

- Raw string / config value search (try `agentmap --any` first — layer 4 is live `git grep`)
- Runtime call graphs or full semantic "how does it work?" (use codebase search; PHP method-call tracing is shallow caller→callee pairs)
- Next-style `--feature` on TanStack Router / non-`app/` layouts (often empty)

## Commands (run in repo root)

```bash
# Smart router — default first move (works on .ts/.js and .php/.blade.php)
agentmap --any <query>

# Reuse / symbol definition — e.g. a Laravel Action or Repository
agentmap --find UserRepository

# Blast radius (exports, imports, dependents, related files)
agentmap --relates app/Http/Controllers/UserController.php
agentmap --relates src/lib/utils.ts

# Token-budgeted ranked digest
agentmap --map --tokens 400
agentmap --map --focus app/Models --tokens 400

# Hub files (PageRank)
agentmap --hubs

# JSON for tools
agentmap --json --any <query>
```

Install: clone the `agentmap-php` fork and run `node /path/to/agentmap.mjs`. Map cache: `.claude/agentmap/map.json` (gitignored; legacy fallback `.claude/agentmap.json`).

## Agent platforms

| Platform | Setup |
|----------|--------|
| **Claude Code** | `agentmap --install-hooks` (post-commit refresh + PreToolUse grep nudge) |
| **Cursor / MCP clients** | `agentmap --mcp` in MCP config, or Shell + commands above |
| **This skill** | `agentmap --install-skill` |

## Workflow

1. If the map may be stale after edits, run `agentmap` (no flags) or rely on post-commit hook.
2. Start with `agentmap --any <symbol or topic>` — works for PHP classes, Laravel facades, Blade views, and TS/JS symbols alike.
3. Before editing a hub file (a Model, Service, or shared util), run `agentmap --relates <that-file>`.
4. Fall back to grep only when agentmap returns no useful structure hit.

## Fork note

```bash
node /path/to/agentmap-php/agentmap.mjs --any UserController
# agentmap-php = raymondchins/agentmap + PHP/Laravel via tree-sitter-php
# NOT: npm install agentmap  (different, unrelated package)
```
