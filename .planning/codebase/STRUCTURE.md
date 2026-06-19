# Codebase Structure

**Analysis Date:** 2026-06-19

## Directory Layout

```
agentmap/
├── agentmap.mjs           # Main CLI — all core logic (~1831 lines)
├── mcp.mjs                # MCP server (stdio, 6 tools, ~206 lines)
├── package.json           # @raymondchins/agentmap v0.9.0
├── package-lock.json
├── CHANGELOG.md
├── CONTRIBUTING.md
├── EVAL.md                # Retrieval accuracy evaluation methodology
├── NOTICE
├── LICENSE                # MIT
├── README.md              # Project documentation + benchmark table
├── SECURITY.md
│
├── src/                   # EMPTY — intended for decomposed modules
│   ├── Commands/          # (empty)
│   ├── Core/              # (empty)
│   ├── Hooks/             # (empty)
│   ├── Mcp/               # (empty)
│   └── Skills/            # (empty)
│
├── hooks/                 # Files installed into target repos
│   ├── post-commit        # Shell script — auto-rebuilds map on commit
│   ├── agentmap-nudge.mjs # PreToolUse hook — steers agent toward agentmap
│   ├── agentmap-gemini-nudge.mjs
│   └── INSTALL.md
│
├── skills/                # Claude Code skill integration
│   ├── SKILL.md           # Skill definition
│   ├── guidance.md        # Short guidance block injected into CLAUDE.md
│   ├── install.mjs        # Skill installer
│   ├── install-helpers.mjs# Shared install utilities
│   └── opencode-agentmap-nudge.js
│
├── resources/             # EMPTY — resource directories (hooks/, skills/)
│
├── test/                  # Black-box tests (Node native test runner)
│   ├── helpers.mjs        # makeRepo, gitInit, run, cleanup
│   ├── any-routing.test.mjs
│   ├── audit-fixes.test.mjs
│   ├── degradation.test.mjs
│   ├── determinism.test.mjs
│   ├── doctor.test.mjs
│   ├── exit-codes.test.mjs
│   ├── hook-status.test.mjs
│   ├── injection-safety.test.mjs
│   ├── install-hooks.test.mjs
│   ├── install-skill.test.mjs
│   ├── json.test.mjs
│   ├── nudge-hook.test.mjs
│   ├── setup-mcp.test.mjs
│   ├── staleness.test.mjs
│   ├── tsconfig-paths-monorepo.test.mjs
│   └── vue-sfc/           # Vue SFC-specific tests
│       ├── cache-and-freshness.test.mjs
│       ├── coexist-dynamic.test.mjs
│       ├── coexist.test.mjs
│       ├── fixtures.mjs
│       ├── graph-and-queries.test.mjs
│       ├── import-resolution.test.mjs
│       ├── no-leak.test.mjs
│       ├── script-extraction-generic.test.mjs
│       └── script-extraction.test.mjs
│
├── tests/                 # EMPTY — Feature/, Unit/, fixtures/ subdirs
│   ├── Feature/
│   ├── Unit/
│   └── fixtures/
│
├── benchmark/             # Token-savings benchmark suite
│   ├── bench.mjs
│   ├── RESULTS.md
│   └── vue-sfc-eval.mjs
│
├── eval/                  # Retrieval accuracy evaluation
│   └── eval.mjs
│
├── examples/
│   └── TRANSCRIPT.md
│
├── assets/
│   └── hero.png
│
├── .github/workflows/
│   └── ci.yml             # CI: test (node 18/20/22), CodeQL, secret scan
│
└── .opencode/             # OpenCode/GSD configuration
    └── skills/            # Installed GSD skills
```

## Directory Purposes

**Root level (`agentmap.mjs`, `mcp.mjs`):**
- Purpose: All executable code lives at root level, not in `src/`
- Contains: Main CLI, MCP server, package config
- Key files: `agentmap.mjs` (core, 1831 lines), `mcp.mjs` (MCP, 206 lines)

**`hooks/`:**
- Purpose: Installable files for target repos (not run in-place)
- Contains: Shell post-commit hook, Claude Code PreToolUse nudge scripts, INSTALL.md
- Key files: `hooks/post-commit` (shell), `hooks/agentmap-nudge.mjs`

**`skills/`:**
- Purpose: Claude Code skill packaging for agentmap
- Contains: SKILL.md definition, guidance.md block, installers
- Key files: `skills/SKILL.md`, `skills/install.mjs`, `skills/guidance.md`

**`test/`:**
- Purpose: Black-box integration tests using Node `node:test` runner
- Contains: Test files driven via CLI subprocess against temp git repos
- Key files: `test/helpers.mjs` (shared utilities), 15 test suites + Vue SFC sub-suite

**`benchmark/`:**
- Purpose: Token-savings benchmarks against reference repos (vercel/ai-chatbot, zod, taxonomy)
- Contains: `bench.mjs`, `RESULTS.md`, `vue-sfc-eval.mjs`

**`eval/`:**
- Purpose: Retrieval accuracy evaluation against ground truth from real repos
- Contains: `eval.mjs`

**`.github/workflows/`:**
- Purpose: CI pipeline definition
- Contains: `ci.yml` — test matrix (Node 18/20/22), CodeQL, Gitleaks secret scan

## Key File Locations

**Entry Points:**
- `agentmap.mjs` — CLI binary (shebang `#!/usr/bin/env node`)
- `mcp.mjs` — MCP server (launched via `agentmap --mcp`)

**Configuration:**
- `package.json` — Package config, bin, files, scripts, dependencies

**Core Logic:**
- `agentmap.mjs` — ALL core logic (build, PageRank, symbol ranking, CLI, hooks, doctor)

**Testing:**
- `test/helpers.mjs` — Test infrastructure (temp repo creation, git init, CLI runner)
- `test/*.test.mjs` — Individual test suites

**Installation Artifacts:**
- `hooks/post-commit` — Shell script installed to `.git/hooks/post-commit`
- `hooks/agentmap-nudge.mjs` — JS script installed to `.claude/hooks/agentmap-nudge.mjs`
- `skills/install.mjs` — Installs skill + guidance into target repo

## Naming Conventions

**Files:**
- `.mjs` extension for all JS files (ESM modules)
- `agentmap*.mjs` — core tool files
- `*.test.mjs` — test files
- `kebab-case` for most files: `any-routing.test.mjs`, `hook-status.test.mjs`, `install-hooks.test.mjs`
- `snake_case` for directories: `vue_sfc/` (note: within `test/`, `vue-sfc/` uses kebab)

**Directories:**
- `src/` subdirectories are PascalCase: `Commands/`, `Core/`, `Hooks/`, `Mcp/`, `Skills/`
- Other directories: lowercase `test/`, `hooks/`, `skills/`, `eval/`, `benchmark/`, `resources/`, `assets/`

## Where to Add New Code

**New Feature / Command:**
- Primary code: Add to `agentmap.mjs` (current convention) OR split into `src/Core/<name>.mjs` if decomposing
- Tests: `test/<feature>.test.mjs`

**New Tool integration:**
- MCP tool: Add to `mcp.mjs` (in the `TOOLS` object)
- CLI flag: Add to `agentmap.mjs` flag parsing + KNOWN set (`agentmap.mjs:1475`)

**New Hook / Nudge:**
- Hook script: `hooks/agentmap-<name>.mjs`
- Install logic: `agentmap.mjs` in `installHooks()` function

**Utilities:**
- Shared helpers: `test/helpers.mjs` (for test use)
- Skill helpers: `skills/install-helpers.mjs`

**Benchmarks / Evaluation:**
- Benchmark: `benchmark/<name>.mjs`
- Evaluation: `eval/eval.mjs` or `eval/<name>.mjs`

## Special Directories

**`src/`:** Purpose: Intended module structure — currently all empty. The entire codebase lives in root-level files. This is a known architectural debt.

**`tests/` (with `s`):** Purpose: Feature/Unit/fixtures directories for future decomposed tests — empty. Current tests live in `test/` (without `s`).

**`test/vue-sfc/`:** Purpose: Vue Single File Component test suite — 9 test files, co-located fixture data.

**`.opencode/skills/`:** Purpose: GSD workflow skills installed for the project — not part of agentmap itself.

---

*Structure analysis: 2026-06-19*
