# agentmap-php

**The repo map your coding agent is _forced_ to use — now for PHP and Laravel, on par with TS/JS.**

Your AI coding agent re-learns your codebase every session — opening files and grepping to find
what connects to what, burning tokens before it writes a line. **agentmap-php** gives it a
**queryable, ranked code-relationship map for PHP/Laravel repos** (and TypeScript/JavaScript too) —
a tree-sitter import/symbol graph ranked by personalized PageRank. Ask it to *"add a field to the
User model"* or *"fix the checkout action"* and it finds the right files, their imports, Eloquent
relations, Blade includes, and what already exists in **~98% fewer context tokens** — kept current
by a post-commit auto-refresh and actually used via a `PreToolUse(Grep)` hook.

**Laravel-aware out of the box:** facade resolution, Eloquent model hierarchy, route → controller
links, service-provider bindings, Blade `@include`/`@extends` graphs, Livewire `wire:*` bindings,
DDD / Action / Repository / Service detection, Artisan command signatures, middleware tracing,
migration schemas, and declared-type + method-call tracing.

[![License: MIT](https://img.shields.io/badge/License-MIT-green)](./LICENSE)
[![npm](https://img.shields.io/npm/v/@dstwn/agentmap-php)](https://www.npmjs.com/package/@dstwn/agentmap-php)
[![CI](https://github.com/dstwn/agentmap-php/actions/workflows/ci.yml/badge.svg)](https://github.com/dstwn/agentmap-php/actions/workflows/ci.yml)
[![node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](#)

> **A fork of [agentmap](https://github.com/raymondchins/agentmap) by Raymond Surya Chin** maintained by [@dstwn](https://github.com/dstwn). The
> upstream tool is TS/JS-only (`ts-morph`); this fork adds first-class PHP and Laravel support via
> `tree-sitter-php` while preserving every existing TS/JS capability. All credit for the original
> design, PageRank ranking, `--any` router, and agent-loop wiring goes upstream.

> Two runtime dependencies (`ts-morph` for TS/JS, `tree-sitter` + `tree-sitter-php` for PHP). No
> vector DB, no embedding API, no server, no PHP runtime required — tree-sitter parses PHP source
> directly. `node agentmap.mjs --any <query>` and you have a ranked answer for either language.

---

## Benchmark

> **Note on the benchmark below:** these figures are the **upstream TS/JS** numbers, run on a
> Next.js repo. They demonstrate the ranking + digest mechanism this fork inherits unchanged.
> **PHP/Laravel benchmark figures** (token savings on a real Laravel codebase) and **PHP
> retrieval-accuracy** numbers live in [`./benchmark/RESULTS.md`](./benchmark/RESULTS.md) and
> [`EVAL.md`](./EVAL.md) respectively — see those files for the Laravel-specific data.

Every task you hand a coding agent starts with the same hidden step — *find the relevant code*.
Here's the token cost of that step, **reading raw files vs querying agentmap**, on a real 154-file
Next.js app ([vercel/ai-chatbot](https://github.com/vercel/ai-chatbot)). Every figure is captured
tool output (`node benchmark/bench.mjs <repo>` at the pinned sha):

<table width="100%">
<thead>
<tr>
<th align="left">The question the agent has to answer first</th>
<th align="right">Reading files</th>
<th align="right">With agentmap</th>
<th align="right">Saved</th>
</tr>
</thead>
<tbody>
<tr><td align="left">Where is this symbol defined?</td><td align="right">1,950</td><td align="right">20</td><td align="right">99%</td></tr>
<tr><td align="left">Does a helper for this already exist? <i>(reuse)</i></td><td align="right">14,740</td><td align="right">19</td><td align="right">99.9%</td></tr>
<tr><td align="left">What breaks if I change this file? <i>(blast radius)</i></td><td align="right">81,038</td><td align="right">616</td><td align="right">99.2%</td></tr>
<tr><td align="left">What files make up this feature?</td><td align="right">6,121</td><td align="right">1,025</td><td align="right">83.3%</td></tr>
<tr><td align="left">Give me a repo overview</td><td align="right">3,065</td><td align="right">1,127</td><td align="right">63.2%</td></tr>
<tr><td align="left">Load the whole repo into context</td><td align="right">150,281</td><td align="right">1,127</td><td align="right">99.3%</td></tr>
<tr><td align="left">What does this one file import?</td><td align="right">583</td><td align="right">517</td><td align="right">11.3%</td></tr>
<tr><td align="left"><b>All 7 tasks combined</b></td><td align="right"><b>257,778</b></td><td align="right"><b>4,451</b></td><td align="right"><b>98.3%</b></td></tr>
</tbody>
</table>

<sub>Context tokens the agent burns to answer each question — token est = chars/4, applied to both sides.</sub>

That's the agent reaching the same answer on **58× fewer tokens** overall — and the pattern holds
across [zod](https://github.com/colinhacks/zod) (367 files, **99.2%**) and
[taxonomy](https://github.com/shadcn-ui/taxonomy) (125 files, **96.0%**), peaking at **646× fewer**
on a single whole-repo map. Reproducible at pinned shas; full per-scenario tables in
**[`./benchmark/RESULTS.md`](./benchmark/RESULTS.md)**.

> **Methodology note:** the 58× overall figure is dominated by the whole-repo-load scenario
> (Scenario F — 150 K vs 1 K tokens), which skews the combined ratio sharply upward. Excluding it,
> the per-task overall ratio on the same sample repo is approximately 32×. Both numbers are real;
> the headline captures the most common agent worst-case (repo-dump on session start), while the
> per-task average better represents typical individual queries. RESULTS.md has the full breakdown.

**Fewer tokens, but are they the _right_ tokens?** Token efficiency is only half the story — a
separate [`EVAL.md`](./EVAL.md) (`npm run eval`) scores **retrieval accuracy** against ground
truth derived live from real repos (zod, zustand, hono). Headline: agentmap returns the symbol
definition in the **top 3 ~95%** of the time (naive grep ~79%) at **~2.6× fewer tokens**, and
identifies a module's dependents at **~100% precision** (grep ~58%). Honest tradeoffs and method
in EVAL.md.

**Speed:** a cold build (parse + PageRank + symbol graph) takes **~1.2s**; a warm cached query
returns in **~0.1s** (the lazy-loaded path added in 0.2.2) — the agent has a ranked answer back
before it would have finished opening the first handful of files.

Honest notes: the win scales with the work — the small rows above (63%, 11%) are the floor, and a
*trivial single-file* lookup can even cost **more** than `cat`+`grep` (taxonomy's file-import task
hit −313%; we leave it in). Numbers measure **context-token volume**, not answer quality or wall-clock.

---

## Why it's different

Most "repo context" tools are a photocopy: they dump your repository (or a slice of it) into
the prompt once and walk away. The copy goes stale the moment you edit a file, and nothing
makes the agent actually read it.

agentmap is the opposite — a **queryable, ranked, self-refreshing** map the agent interrogates
flag-by-flag, that **rebuilds itself on every commit**, and that a `PreToolUse` hook steers the
agent toward *before* it falls back to serial grep.

| | **agentmap** | Aider repo map | RepoMapper | Repomix | code2prompt |
| --- | --- | --- | --- | --- | --- |
| **Ranking algorithm** | Personalized PageRank (file + symbol graphs) | PageRank (graph ranking) | Importance heuristics | None (file order) | None (file order) |
| **Languages** | **TS/JS (ts-morph) + PHP/Laravel (tree-sitter-php)** | Many (tree-sitter) | Many (tree-sitter) | Language-agnostic (text) | Language-agnostic (text) |
| **Token-budget output** | Yes — `--map [--tokens N]` ranked digest | Yes (built into Aider's context) | Partial | Yes (size caps) | Yes (templates/caps) |
| **Agent-loop integration** | **Yes — post-commit auto-refresh + PreToolUse hook** | In-process (Aider only) | No | No | No |
| **Dependencies** | `ts-morph` + `tree-sitter` + `tree-sitter-php` | Python + tree-sitter stack | Python + tree-sitter | Node | Rust binary |
| **Install** | `npm i @dstwn/agentmap-php` | `pip install aider` | `pip install` | `npx`/global | `cargo`/binary |

What that table is **not** claiming: agentmap-php is a **file-level import graph**, not a full
call-site/reference resolver (see [Scope & limitations](#scope--limitations)). The differentiators
are narrow and honest: **(1)** PHP/Laravel awareness on par with the TS/JS original, **(2)** the
`--any` router, and **(3)** the agent-loop wiring. Everything else is table stakes.

---

## PHP & Laravel awareness

This fork's reason to exist. Beyond the base PHP import graph (classes, interfaces, traits, enums,
functions, namespaces, `use`/`require`, PSR-4 via `composer.json`), agentmap-php recognizes
Laravel's conventions so the ranked map reflects how Laravel apps actually wire together:

| Capability | What it surfaces |
|------------|------------------|
| **Facade resolution** | `Cache::`, `DB::`, `Route::`, `Auth::` … resolved to their underlying `Illuminate\Support\Facades\*` classes |
| **Eloquent relations** | `hasMany` / `belongsTo` / `morphTo` / … traced as graph edges between models |
| **Routes → controllers** | `routes/web.php` + `api.php` parsed; `Route::get('/x', [C::class, 'm'])` links URIs to handlers |
| **Service providers** | provider classes and their bindings recognized |
| **Blade templates** | `.blade.php` directives extracted; `@extends`/`@include`/`@component` resolved to target view files |
| **Livewire** | `@livewire('comp')` components + `wire:model` / `wire:click` bindings traced |
| **DDD / patterns** | Action, Domain, Repository, Service, DTO, Policy, Job, Event, Listener, … detected by convention |
| **Artisan commands** | `$signature` parsed into command name, arguments, and options |
| **Middleware** | `->middleware()` / `Route::middleware()` chains traced |
| **Migrations** | `Schema::create('table')` + column types + foreign keys extracted |
| **Static analysis** | declared property/parameter/return types; controller→service→repository call tracing |

Mixed repos (TS/JS frontend + PHP/Laravel backend) parse into **one unified graph** — Inertia
references between TS/JS pages and PHP controllers are detected as cross-language edges.

---

## The agent loop (the actual point)

Here's the quiet failure of every other repo-map tool: it builds a beautiful map, and then the
agent forgets it exists and greps anyway. A map the agent doesn't open is just dead weight.

agentmap closes that loop. Two hooks (in [`./hooks/`](./hooks/)) do the work: the map
**refreshes itself after every commit**, and the agent gets **nudged to query it before it
serial-greps**. You wire it once — then it stays current on its own, and stays used.

### 1. Auto-refresh on commit

[`hooks/post-commit`](./hooks/post-commit) rebuilds `.claude/agentmap.json` after each
commit, detached + silenced so it never slows the commit. It skips during
rebase/merge/cherry-pick and no-ops if Node is missing.

The hooks ship inside the npm package. The simplest setup:

```bash
npx @dstwn/agentmap-php --install-hooks
```

This copies `hooks/post-commit` into `.git/hooks/`, sets it executable, ensures
`.claude/agentmap.json` is in `.gitignore`, and **auto-wires the `PreToolUse` nudge
hook into `.claude/settings.json`** (merge-safe + idempotent) so map enforcement is
on by default — no manual paste. Manual alternative for just the post-commit hook:

```bash
# from your repo root
cp hooks/post-commit .git/hooks/post-commit
chmod +x .git/hooks/post-commit
```

The hook auto-locates the builder: a local `agentmap.mjs`, then `scripts/agentmap.mjs`, then
the installed `agentmap` binary, then `npx --no-install @dstwn/agentmap-php`.

### 2. Force the agent to use it — `PreToolUse` hook

[`hooks/agentmap-nudge.mjs`](./hooks/agentmap-nudge.mjs) is a **non-blocking** hook for
Claude Code that covers **both** the `Grep` tool and raw Bash text-searchers
(`grep`/`rg`/`egrep`/`fgrep`/`ag`/`ack`). When either looks like a dependency /
who-imports / component-usage / reuse / where-is-symbol search, it injects a reminder
steering the agent to `agentmap --any` first. It never denies the call, and stays silent
for raw-string / Tailwind-class / lowercase-HTML-tag sweeps and for pipe-filtered commands
like `ps aux | grep node` — so it's high-signal, not nagging.

**Fires on:** `import`/`require`/`export`/`from '...'` patterns, JSX component tags
(`<Hero`, `<ProviderCard`), explicit intent words (`where is`, `who imports`, `reuse`,
`existing component`), and — in the Bash branch — bare multi-hump PascalCase identifiers
(`ProviderCard`, `TopProviders`) that almost always mean "where is this symbol / who uses
it". The Bash branch only fires when the searcher is the *primary* command (at the start,
or after `;`/`&&`); piped log-filters stay silent.

`--install-hooks` writes both matchers into `.claude/settings.json` for you (merge-safe —
preserves existing settings, won't duplicate on re-run). The single hook file dispatches
internally on `tool_name`. For reference, or to wire it by hand:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Grep",
        "hooks": [{ "type": "command", "command": "node ./hooks/agentmap-nudge.mjs" }]
      },
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "node ./hooks/agentmap-nudge.mjs" }]
      }
    ]
  }
}
```

That's the "forced to use it" in the tagline: the map stays current on its own, and the
agent is steered to it the moment it reaches for a dependency-shaped grep or Bash search.

### 3. Agent skills (Cursor, Claude Code, Codex, OpenCode, Gemini, Antigravity, Copilot)

```bash
npx @dstwn/agentmap-php --install-skill
```

Copies packaged **SKILL.md** files and a **Cursor rule** (`.cursor/rules/agentmap.mdc`,
`alwaysApply: true`) into the current repo or global agent directories. Paths follow
each platform's official skill-directory conventions. Options:

```bash
agentmap --install-skill --platform cursor           # Cursor rule only (project)
agentmap --install-skill --platform claude           # .claude/skills/agentmap/SKILL.md
agentmap --install-skill --platform codex            # .codex/skills/ (project) or ~/.codex/skills/ (global)
agentmap --install-skill --platform opencode         # .opencode/skills/ (project) or ~/.config/opencode/skills/ (global)
agentmap --install-skill --platform gemini           # .gemini/skills/ (project); global ~/.gemini/skills/ (Windows global: ~/.agents/skills/)
agentmap --install-skill --platform antigravity      # .agents/skills/ (project) or ~/.gemini/config/skills/ (global)
agentmap --install-skill --platform copilot          # .copilot/skills/ or ~/.copilot/skills/
agentmap --install-skill --global --platform claude  # ~/.claude/skills/...
agentmap --install-skill --platform agents           # legacy .agents/skills/ (project or global); excluded from default `all`
agentmap --install-skill --dry-run                   # preview paths, no writes
```

`--platform all` installs: claude, cursor, codex, opencode, gemini, antigravity, copilot (not legacy `agents`).

Some platforms also get **always-on** docs and hooks in the same command:

| `--platform` | Skill | Also installs (project) | Global docs |
|--------------|-------|-------------------------|-------------|
| `gemini` | `.gemini/skills/…/SKILL.md` | `GEMINI.md` + `.gemini/settings.json` BeforeTool nudge | `~/.gemini/GEMINI.md` |
| `codex` | `.codex/skills/…/SKILL.md` | `AGENTS.md` merge-safe `<!-- agentmap:begin/end -->` block | `~/.codex/AGENTS.md` |
| `opencode` | `.opencode/skills/…/SKILL.md` | `AGENTS.md` + `.opencode/plugins/agentmap-nudge.js` | `~/.config/opencode/AGENTS.md` |

Codex and OpenCode share one repo-root `AGENTS.md` on project install. Existing content outside the marked block is preserved.

Pair with `--install-hooks` (Claude Code) or `--mcp` (Cursor MCP).

---

## Quickstart

**Install from npm:**

```bash
npm install @dstwn/agentmap-php
```

Then run against any repo:

```bash
npx agentmap --any <query>
```

Or run it directly from your repo root after installing locally:

```bash
node node_modules/@dstwn/agentmap-php/agentmap.mjs --any <query>
```

**Or clone the repo and run directly:**

```bash
git clone https://github.com/dstwn/agentmap-php
node /path/to/agentmap-php/agentmap.mjs --any <query>
```

The first run builds and caches the map to `.claude/agentmap.json` (add it to
`.gitignore`). Subsequent runs serve the cache when the tree is clean and `HEAD` is
unchanged, and silently rebuild from disk when there are uncommitted `.ts/.tsx/.js/.php/.blade.php`
edits — so queries always reflect your in-flight work.

Run with no flag to build + print a one-line summary:

```
$ node agentmap.mjs
agentmap: 154 files | 4 features | top hub: lib/utils.ts (deg 52, pr 0.105171)
```

**On a Laravel app** the same commands surface PHP/Laravel structure:

```bash
# Where is a model / controller / action defined?
node agentmap.mjs --any UserController

# Reuse check before writing a new action or repository
node agentmap.mjs --find Repository

# Blast radius of a model — who relates to it (Eloquent + imports)
node agentmap.mjs --relates app/Models/User.php

# Token-budgeted ranked digest of the whole Laravel app
node agentmap.mjs --map --tokens 400
```

---

## The `--any` router

Don't want to learn eight flags? You don't have to. Throw anything at `--any` — a filename, a
function, a feature, even a raw string — and it figures out what you meant, returning the first
layer that hits:

```
--any <query>
   │
   ├─ 1. FILE     exact path → unique basename → unique substring
   ├─ 2. SYMBOL   exported name contains the query (across all files)
   ├─ 3. FEATURE  app/-router feature name contains the query
   └─ 4. CONTENT  live `git grep` (tracked + untracked) — never stale
```

Layers 1–3 read the cached structural map (fast, ranked). Layer 4 is a **live disk read**
via `git grep -F`, so raw strings, copy, Tailwind classes, and config values the structural
graph never indexes still resolve instead of coming up empty.

**Symbol hit** (query resolved to a symbol → full block):

```
$ node agentmap.mjs --any cn
[structure] 1 symbol, 0 feature match for "cn"
  lib/utils.ts → cn (FunctionDeclaration)
```

**Ambiguous file hit** (query matched multiple files → narrow it):

```
$ node agentmap.mjs --any utils
[structure] "utils" matched 3 files — narrow it:
  lib/utils.ts
  lib/db/utils.ts
  tests/prompts/utils.ts
```

**Content fallback** (no file/symbol/feature match → live git-grep):

```
$ node agentmap.mjs --any streamText
[content] 13 lines:
app/(chat)/api/chat/route.ts:8:  streamText,
app/(chat)/api/chat/route.ts:194:        const result = streamText({
artifacts/code/server.ts:1:import { streamText } from "ai";
artifacts/code/server.ts:18:    const { fullStream } = streamText({
artifacts/code/server.ts:40:    const { fullStream } = streamText({
artifacts/sheet/server.ts:1:import { streamText } from "ai";
artifacts/sheet/server.ts:11:    const { fullStream } = streamText({
```

---

## Commands

Every snippet below is **representative output** (long lists trimmed) from running agentmap against the public
154-file Next.js repo [vercel/ai-chatbot](https://github.com/vercel/ai-chatbot) (sha 2becdb4).

### `--any <q>` — the router (file → symbol → feature → live content)

See [The `--any` router](#the---any-router) above. Default first move for any
"where/what/who" question.

### `--find <q>` — reuse-before-rebuild symbol search

Find every exported symbol whose name contains the query. Use it before writing a new util
or component to check what already exists.

```
$ node agentmap.mjs --find Message
find "Message": 55 match
  hooks/use-messages.tsx → useMessages (FunctionDeclaration)
  lib/errors.ts → getMessageByErrorCode (FunctionDeclaration)
  lib/types.ts → messageMetadataSchema (VariableDeclaration)
  lib/types.ts → MessageMetadata (TypeAliasDeclaration)
  lib/types.ts → ChatMessage (TypeAliasDeclaration)
  lib/utils.ts → convertToUIMessages (FunctionDeclaration)
  lib/utils.ts → getTextFromMessage (FunctionDeclaration)
  tests/helpers.ts → generateTestMessage (FunctionDeclaration)
  app/(chat)/actions.ts → generateTitleFromUserMessage (FunctionDeclaration)
  …
```

### `--relates <path>` — blast radius + transitive relevance

The file's own block (exports / imports / direct dependents) **plus** a random-walk
relevance list (personalized PageRank on the bidirectional import graph) — the files most
related to the target, transitively, not just its direct importers.

```
$ node agentmap.mjs --relates lib/db/schema.ts
relates: lib/db/schema.ts  (pr 0.073744)
exports (14): user(VariableDeclaration), User(TypeAliasDeclaration), chat(VariableDeclaration), Chat(TypeAliasDeclaration), message(VariableDeclaration), DBMessage(TypeAliasDeclaration), …
imports (0): —
dependents (21): hooks/use-active-chat.tsx, lib/types.ts, lib/utils.ts, components/chat/artifact.tsx, components/chat/message.tsx, lib/db/queries.ts, app/(chat)/api/chat/route.ts, …
related (random-walk relevance):
  lib/utils.ts (0.0476)
  lib/types.ts (0.0376)
  components/chat/artifact.tsx (0.0372)
  components/chat/icons.tsx (0.0264)
  components/chat/message.tsx (0.0237)
  lib/db/queries.ts (0.0225)
  app/(chat)/api/chat/route.ts (0.0218)
  …
```

### `--feature <name>` — files that make up a feature

Resolves a Next.js `app/`-router feature to its file set, plus the external files that
depend on it.

```
$ node agentmap.mjs --feature api
feature "api": 11 files
  app/(chat)/api/chat/route.ts
  app/(chat)/api/chat/schema.ts
  app/(chat)/api/document/route.ts
  app/(chat)/api/history/route.ts
  app/(chat)/api/messages/route.ts
  app/(chat)/api/models/route.ts
  app/(chat)/api/suggestions/route.ts
  app/(chat)/api/vote/route.ts
  app/(auth)/api/auth/guest/route.ts
  app/(chat)/api/files/upload/route.ts
  app/(chat)/api/chat/[id]/stream/route.ts
external dependents (0): —
```

### `--features` — list features by size

```
$ node agentmap.mjs --features
features (4):
  api (11 files)
  login (1 files)
  register (1 files)
  chat (1 files)
```

### `--hubs` — most important files (PageRank)

The files that matter most, ranked by PageRank importance (raw dependent degree shown
alongside).

```
$ node agentmap.mjs --hubs
agentmap: 154 files (sha 2becdb4)
hubs (PageRank importance):
  lib/utils.ts (deg 52, pr 0.105171)
  lib/db/schema.ts (deg 21, pr 0.073744)
  lib/types.ts (deg 23, pr 0.067589)
  components/chat/artifact.tsx (deg 15, pr 0.036882)
  components/chat/icons.tsx (deg 27, pr 0.035378)
  lib/errors.ts (deg 9, pr 0.032787)
  lib/db/queries.ts (deg 14, pr 0.030085)
  …
```

### `--symbols [N]` — top ranked symbols (Aider-style)

The most important individual symbols across the repo, ranked by the identifier graph
(defaults to 30).

```
$ node agentmap.mjs --symbols 10
top 10 ranked symbols (Aider-style):
  0.109902  lib/utils.ts → cn (FunctionDeclaration)
  0.036013  lib/types.ts → ChatMessage (TypeAliasDeclaration)
  0.025686  components/chat/artifact.tsx → ArtifactKind (TypeAliasDeclaration)
  0.022461  lib/errors.ts → ChatbotError (ClassDeclaration)
  0.021068  lib/types.ts → CustomUIDataTypes (TypeAliasDeclaration)
  0.020872  lib/db/schema.ts → Document (TypeAliasDeclaration)
  0.020555  components/ai-elements/suggestion.tsx → Suggestion (VariableDeclaration)
  0.020555  lib/db/schema.ts → Suggestion (TypeAliasDeclaration)
  0.018124  lib/db/schema.ts → DBMessage (TypeAliasDeclaration)
  0.015034  lib/errors.ts → ErrorCode (TypeAliasDeclaration)
```

### `--map [--tokens N] [--focus <path>]` — token-budgeted ranked digest

The token-budgeted digest (Aider's killer feature): a ranked, files-and-symbols summary
that fits a token budget. Default budget is 8192 (1024 with `--focus`). `--focus <path>`
personalizes the ranking toward a file you're working on.

```
$ node agentmap.mjs --map --tokens 400
# agentmap (154 files, sha 2becdb4) — focus: global, budget ~400 tok

lib/utils.ts:
  cn (FunctionDeclaration)
  generateUUID (FunctionDeclaration)

lib/types.ts:
  ChatMessage (TypeAliasDeclaration)
  CustomUIDataTypes (TypeAliasDeclaration)
  ChatTools (TypeAliasDeclaration)
  Attachment (TypeAliasDeclaration)

components/chat/artifact.tsx:
  ArtifactKind (TypeAliasDeclaration)
  UIArtifact (TypeAliasDeclaration)
  Artifact (VariableDeclaration)

lib/errors.ts:
  ChatbotError (ClassDeclaration)
  ErrorCode (TypeAliasDeclaration)

lib/db/schema.ts:
  Document (TypeAliasDeclaration)
  Suggestion (TypeAliasDeclaration)
  DBMessage (TypeAliasDeclaration)

# ~387 tokens (14 files shown)
```

Focused on a working file — the ranking re-centers on what `lib/db/queries.ts` actually touches:

```
$ node agentmap.mjs --map --focus lib/db/queries.ts --tokens 350
# agentmap (154 files, sha 2becdb4) — focus: lib/db/queries.ts, budget ~350 tok

lib/utils.ts:
  cn (FunctionDeclaration)
  generateUUID (FunctionDeclaration)
  getDocumentTimestampByIndex (FunctionDeclaration)
  fetcher (VariableDeclaration)
  getTextFromMessage (FunctionDeclaration)
  convertToUIMessages (FunctionDeclaration)
  fetchWithErrorHandlers (FunctionDeclaration)
  sanitizeText (FunctionDeclaration)

lib/db/schema.ts:
  DBMessage (TypeAliasDeclaration)
  Suggestion (TypeAliasDeclaration)
  Document (TypeAliasDeclaration)
  Chat (TypeAliasDeclaration)
  User (TypeAliasDeclaration)
  chat (VariableDeclaration)
  document (VariableDeclaration)
  message (VariableDeclaration)

lib/errors.ts:
  ChatbotError (ClassDeclaration)
  ErrorCode (TypeAliasDeclaration)

# ~324 tokens (8 files shown)
```

### `--print` — full map as JSON

Dumps the cached map (`hubs`, `features`, `rankedSymbols`, `files`) as one JSON object —
for piping into other tools. Also includes a top-level `fileCount`.

```
$ node agentmap.mjs --print | jq '.hubs[0]'
"lib/utils.ts (deg 52, pr 0.105171)"
```

### Global flags

| Flag | Description |
|------|-------------|
| `--help` / `-h` | Print a usage block listing every flag and exit 0. |
| `--version` / `-v` | Print the version from `package.json` and exit 0. |
| `--json` | **Global modifier.** When present, every command prints exactly one JSON object to stdout (no prose). Shapes vary per command: `--json --hubs` → `{command,fileCount,sha,hubs:[string]}`, `--json --find X` → `{command,query,matches:[{file,name,kind}]}`, `--json --relates X` → `{command,file,pagerank,exports,imports,dependents,related}`, `--json --any X` → `{command,query,kind,…payload}`, etc. Bare `--json` (no query flag) → `{command:"build",fileCount,features,topHub}`. |
| `--install-hooks` | Copy `hooks/post-commit` into `.git/hooks/` (chmod 0755), ensure `.claude/agentmap.json` is in `.gitignore`, and auto-wire the Claude Code `PreToolUse(Grep)` nudge into `.claude/settings.json` (merge-safe + idempotent). Exit 0 on success, stderr + exit 1 on failure. |
| `--hook-status` | Report whether the post-commit hook, PreToolUse nudge, and `.gitignore` entry are installed (no writes). |
| `--doctor` | Read-only harness health report: git/Claude hook wiring, installed skills + Cursor rule freshness vs `package.json` version, MCP config entries for OpenCode/Antigravity, and map-cache presence/freshness hints. Always exits 0; suggests fix commands (`agentmap --install-hooks`, `--install-skill`, `--setup-mcp`, `agentmap`) but never runs them. Combine with `--json` for a structured report. |
| `--install-skill` | Install skills + always-on docs/hooks per platform (`--platform claude\|cursor\|codex\|opencode\|gemini\|antigravity\|copilot\|agents\|all`, default `all`; `--project` default, or `--global`; `--dry-run` preview). |
| `--mcp` | Start agentmap as a **stdio MCP server** so non-Claude-Code agents (Cursor, Cline, any MCP client) can call every flag as a first-class tool. |

**Exit-code contract:** `0` = success / match / help / version; `1` = query returned zero results (`--any`, `--find`, `--relates`, `--feature` with no match); `2` = usage error (missing required arg, unknown flag). Any token starting with `-` that matches no known flag prints an error to stderr and exits 2.

---

## Scope & limitations

Honesty first — this is deliberately a small, sharp tool, not a universal code-graph.

- **TS/JS (via `ts-morph`) and PHP/Laravel (via `tree-sitter-php`).** No Python, Go, Rust, etc.
  yet — those are a possible future direction. For other languages, use a tree-sitter-based tool.
- **File-level import graph, not a full reference graph.** Edges come from static
  `import` / `use` / re-export declarations and the named symbols crossing them. It does **not**
  do call-site or full reference resolution — `--relates` tells you which files import a
  module, not every line that calls a given function. (PHP method-call tracing is shallow:
  caller→callee pairs, not a resolved call graph.)
- **PHP type inference is declared-types-only.** Property, parameter, and return type *hints* are
  extracted as written; there is no type-flow analysis through assignments or returns.
- **Blade parsing is regex-based directive extraction**, not a full Blade compiler — it reliably
  detects directives and `@include`/`@extends`/`@livewire` targets, but does not evaluate nested
  PHP expressions inside directive arguments.
- **Laravel DDD detection is convention-based** (class/dir naming: `*Action`, `*Repository`,
  `*Service`, `Domains/`, …). Projects using non-standard names can extend the marker list.
- **PageRank + symbol ranking are real and implemented** (damping 0.85, deterministic
  power iteration; personalized variants for `--relates` and `--map --focus`). The symbol
  ranking is a faithful port of Aider's identifier-graph approach (credit:
  [Aider](https://github.com/Aider-AI/aider), Apache-2.0).
- **Feature detection assumes the Next.js `app/` router.** Repos without an `app/` directory
  simply report zero features — every other command still works (PHP/Laravel included).
- **Token counts are estimates** (`chars / 4`), not a real BPE tokenizer. Treat
  `--map`/`--tokens` budgets as approximate (±10%).
- The PreToolUse hook is **Claude Code-specific** (it speaks Claude Code's hook JSON). The
  post-commit hook is generic git.

---

## Works well with

agentmap-php reduces **what** goes into context. These tools reduce **how much** everything else costs — they stack multiplicatively.

| Tool | What it does | Token saving |
|------|-------------|-------------|
| **agentmap-php** (this) | Replaces full file dumps with a ranked repo map | **99%+ on context** |
| **[rtk](https://github.com/rtk-ai/rtk)** | Compresses CLI command output (`git diff`, `ls`, docker, kubectl, etc.) | 10–90% per command |
| **[caveman](https://github.com/juliusbrussee/caveman)** | Compresses prompt/response language to terse caveman style | ~65% per message |

Used together, they attack token cost at three different layers — context, tool output, and language — without any overlap or conflict.

### Benchmark: laravel/framework (2947 PHP files, real numbers)

| Scenario | Without agentmap | With agentmap | Saving |
|----------|-----------------|---------------|--------|
| Session start (full repo dump) | ~1,782,828 tok | ~1,496 tok (`--map`) | **99.9%** |
| Find Auth subsystem | ~45,733 tok (grep 66 files) | ~7,318 tok (`--any Auth`) | **84%** |
| Dependency graph | ~1,782,828 tok | ~2,771 tok (`--packages`) | **99.8%** |

**rtk** savings vary by command — most impactful on noisy outputs (`docker ps`, `kubectl get pods`, `npm install`); modest on already-compact code commands. **caveman** stacks on top for response verbosity. **agentmap is the dominant saving** for PHP/Laravel codebases.

**Install all three:**

```bash
# agentmap-php
npm install @dstwn/agentmap-php
npx agentmap --install-hooks

# rtk (Rust binary — see https://github.com/rtk-ai/rtk for install)

# caveman (Claude Code skill — see https://github.com/juliusbrussee/caveman for install)
```

---

## Contributing

Issues and PRs welcome. High-value directions:

- Retrieval-accuracy eval — **done** ([`EVAL.md`](./EVAL.md), `npm run eval`). Next: a
  type-aware dependents mode (the eval excludes type-only edges to match the value-import
  graph) and an `app/`-router fixture so `--feature` retrieval can be scored too.
- A real tokenizer behind the `--map` budget.
- Hardening feature detection for non-`app/`-router layouts.

Keep the dependency footprint minimal — `ts-morph` is the only runtime dependency (it bundles
the TypeScript compiler, ~10 MB installed), and keeping it that way is a feature.

## License

[MIT](./LICENSE). Symbol-ranking algorithm credit: [Aider](https://github.com/Aider-AI/aider) (Apache-2.0).
