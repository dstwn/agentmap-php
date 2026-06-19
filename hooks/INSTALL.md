# agentmap — agent-loop install

The differentiator over "pack the repo into a prompt" tools is **agent-loop
integration**: the map stays fresh on its own (git `post-commit`) and the agent
is *nudged* to use it instead of serial grep (Claude Code `PreToolUse` hook).
Two small, dependency-free files wire both up.

```
hooks/
  agentmap-nudge.mjs  PreToolUse(Grep) nudge → "use agentmap --any first"
  post-commit         git hook → rebuilds .claude/agentmap.json after each commit
  INSTALL.md          ← you are here
```

Both are pure Node/POSIX sh stdlib. The only runtime dependency is `agentmap`
itself (`ts-morph` for TS/JS, `tree-sitter` + `tree-sitter-php` for PHP), used
when the map (re)builds. No PHP runtime is required — tree-sitter parses PHP
source directly.

---

## 0. Prerequisites

- **Node 18+** on PATH.
- **agentmap-php available in the repo.** Either:
  - drop `agentmap.mjs` at the repo root (or `scripts/agentmap.mjs`), or
  - clone the `agentmap-php` fork and reference it: `node /path/to/agentmap-php/agentmap.mjs`.
- **For TS/JS repos:** a `tsconfig.json` (agentmap reads it to find source files).
- **For PHP/Laravel repos:** a `composer.json` (agentmap reads `autoload.psr-4` to
  resolve namespaces to file paths). PHP files are discovered via `git ls-files` +
  filesystem walk — the same mechanism as TS/JS. A repo with neither config still
  works; PSR-4 resolution simply degrades to path-based discovery.

**What gets parsed in a Laravel repo:**

- `app/**/*.php` — classes, interfaces, traits, enums, Eloquent models, controllers,
  Actions/Services/Repositories (DDD detection by convention)
- `routes/*.php` — `web.php`, `api.php` route definitions linked to controller handlers
- `resources/views/**/*.blade.php` — Blade directives, `@include`/`@extends`/`@component`
  graph edges, `@livewire` components and `wire:*` bindings
- `database/migrations/*.php` — table schemas, column types, foreign keys
- Artisan command classes — `$signature` parsed into name/arguments/options

**Caveats:**

- **git hooks run under a non-login shell.** If you manage Node via `nvm`,
  `nvm` won't be sourced and `node` may not be on PATH inside the hook. Use
  a system-level Node install (or Volta / Corepack) so the hook can find
  `node` without shell profile sourcing. Add an explicit `export PATH=...`
  line at the top of the hook if needed.
- **Windows:** Git for Windows runs hooks under its bundled `sh`, not bash.
  The hook script is POSIX sh — do **not** use bash-specific syntax if you
  customise it.

Smoke-test it builds (TS/JS or PHP/Laravel — same command):

```bash
node agentmap.mjs        # or: node /path/to/agentmap-php/agentmap.mjs
# → agentmap: N files | M features | top hub: ...
```

This writes `.claude/agentmap.json`. Add it to `.gitignore` (it's a derived
artifact, rebuilt on every commit):

```bash
echo ".claude/agentmap.json" >> .gitignore
```

---

## 1. PreToolUse nudge (Claude Code)

Steers `who-imports` / dependency / reuse / `<Component>` greps toward
`agentmap --any` before the agent fans out into serial grep. **Non-blocking** —
it only injects a reminder, never denies the Grep.

### a. Place the hook script

Keep it in the repo so it's version-controlled and path-stable:

```bash
mkdir -p .claude/hooks
cp hooks/agentmap-nudge.mjs .claude/hooks/agentmap-nudge.mjs
```

### b. Register it in `.claude/settings.json`

Add (or merge) this `hooks` block. The matcher `Grep` runs the hook before
every Grep tool call; the script decides whether to nudge.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Grep",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/agentmap-nudge.mjs\""
          }
        ]
      }
    ]
  }
}
```

`$CLAUDE_PROJECT_DIR` is set by Claude Code to the project root, so the path
resolves no matter the agent's cwd. Restart the session (or `/hooks` →
reload) to pick it up.

### c. Verify

```bash
echo '{"tool_input":{"pattern":"<Heading"}}' | node .claude/hooks/agentmap-nudge.mjs
# → {"hookSpecificOutput":{...,"additionalContext":"This Grep looks like ..."}}

echo '{"tool_input":{"pattern":"bg-white"}}'  | node .claude/hooks/agentmap-nudge.mjs
# → (no output — raw-string sweeps are left alone)
```

---

## 2. post-commit auto-refresh (git)

Rebuilds the map after each commit so the agent never reads a stale map.
Runs detached + silenced (commit returns instantly) and **skips during
rebase / merge / cherry-pick / bisect / revert** so it doesn't fire on every
replayed commit.

**Easiest way — use the built-in installer flag:**

```bash
agentmap --install-hooks
```

This copies `hooks/post-commit` to `.git/hooks/post-commit`, chmods it, ensures
`.claude/agentmap.json` is in `.gitignore`, and auto-wires the Claude Code
`PreToolUse(Grep)` nudge into `.claude/settings.json` (merge-safe — preserves
existing settings, idempotent on re-run) — enforcement on by default, all in one
step. No manual paste needed.

**Manual alternative:**

```bash
cp hooks/post-commit .git/hooks/post-commit
chmod +x .git/hooks/post-commit
```

It auto-locates the builder: `./agentmap.mjs` → `./scripts/agentmap.mjs` →
global `agentmap` → `npx --no-install @raymondchins/agentmap`. If none is found it no-ops.

> **Fork note:** the `npx --no-install @raymondchins/agentmap` fallback resolves the
> **upstream TS/JS-only** package. Since `agentmap-php` ships from GitHub (not npm), keep a
> repo-local `./agentmap.mjs` (or point the hook at your fork checkout) so PHP/Laravel parsing
> is used — the npx fallback will not include PHP support.

### Verify

```bash
git commit --allow-empty -m "test: agentmap post-commit"
# wait a moment for the background rebuild, then:
git rev-parse --short HEAD
node -e "console.log(require('./.claude/agentmap.json').generatedSha)"
# the two SHAs should match
```

> **Husky / shared hooks:** if the repo uses Husky or `core.hooksPath`, append
> the body of `hooks/post-commit` to your existing `post-commit` (e.g.
> `.husky/post-commit`) instead of overwriting `.git/hooks/post-commit`.

---

## 3. One-liner installer (idea)

Drop this as `hooks/install.sh` in your repo (or run inline) to wire both at
once from the repo root:

```sh
#!/usr/bin/env sh
set -eu
ROOT="$(git rev-parse --show-toplevel)"
HOOKS="$ROOT/hooks"   # where these files live in your repo

# PreToolUse nudge
mkdir -p "$ROOT/.claude/hooks"
cp "$HOOKS/agentmap-nudge.mjs" "$ROOT/.claude/hooks/agentmap-nudge.mjs"

# Merge the PreToolUse(Grep) hook into .claude/settings.json (needs jq).
SETTINGS="$ROOT/.claude/settings.json"
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
CMD='node "$CLAUDE_PROJECT_DIR/.claude/hooks/agentmap-nudge.mjs"'
jq --arg cmd "$CMD" '
  .hooks.PreToolUse = ((.hooks.PreToolUse // []) + [{
    matcher: "Grep",
    hooks: [{ type: "command", command: $cmd }]
  }])
' "$SETTINGS" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"

# git post-commit auto-refresh (skip if Husky/core.hooksPath is in use)
cp "$HOOKS/post-commit" "$ROOT/.git/hooks/post-commit"
chmod +x "$ROOT/.git/hooks/post-commit"

# Ignore the derived map + first build
grep -qxF ".claude/agentmap.json" "$ROOT/.gitignore" 2>/dev/null \
  || echo ".claude/agentmap.json" >> "$ROOT/.gitignore"
# Fork ships from GitHub, not npm — prefer a repo-local agentmap.mjs (PHP-aware).
( cd "$ROOT" && node agentmap.mjs ) || true

echo "agentmap wired: PreToolUse nudge + post-commit refresh installed."
```

Run it:

```bash
sh hooks/install.sh
```

(The `jq` merge is idempotent-ish but appends — run once. Without `jq`, paste
the snippet from step 1b by hand.)

---

## How they reinforce each other

1. You commit → **post-commit** rebuilds `.claude/agentmap.json` in the
   background → the map is always current.
2. The agent reaches for a who-imports / reuse / `<Component>` grep →
   **PreToolUse nudge** fires → the agent runs `agentmap --any <query>` and
   reads the fresh map instead of a slow serial grep.

That loop — fresh map + enforced usage — is the part a static "repo digest"
tool can't reproduce.
