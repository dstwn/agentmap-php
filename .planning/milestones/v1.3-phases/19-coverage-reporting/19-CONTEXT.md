# Phase 19: Coverage Reporting - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `c8` coverage reporting to CI — wrapping `npm test` with `c8` to collect V8 coverage across the subprocess boundary so `src/Core/` modules appear in the report. Add a coverage step to `.github/workflows/ci.yml` (conditioned on node-20 leg to avoid triple-reporting). Add `c8` as a devDependency. Gitignore `coverage/`. No threshold enforcement — CI passes regardless of %.

</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion

All implementation choices at agent's discretion — pure infrastructure phase.

Key constraints from research:
- Use `c8@11.0.0` (exact pin) as devDependency — only tool that captures subprocess coverage across `execFileSync` boundary
- Do NOT use `--experimental-test-coverage` alone — it only covers the test harness process, not `agentmap.mjs`
- CI coverage step: `npx c8 npm test` or `./node_modules/.bin/c8 npm test` after `npm ci`
- Always pair lcov reporter with spec reporter: `c8 --reporter=text --reporter=lcov npm test`
- Coverage threshold flags (`--lines`, `--branches`) do NOT exist on Node 18/20 — do NOT add them
- `coverage/` must be gitignored
- Condition coverage step on `matrix.node-version == 20` only (avoid triple-running)
- `coverage/lcov.info` optionally uploaded as artifact

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.github/workflows/ci.yml` — existing workflow; coverage step goes after `Run tests`
- `package.json` — add `c8@11.0.0` to devDependencies
- `test/helpers.mjs` — `run()` uses `execFileSync`; c8 collects coverage across this boundary automatically via `NODE_V8_COVERAGE` env

### Established Patterns
- `npm ci` already installs devDependencies in CI
- Node 18/20/22 matrix; coverage conditioned on node-20 leg only

### Integration Points
- `package.json` devDependencies — add `c8`
- `.github/workflows/ci.yml` — add coverage step
- `.gitignore` — add `coverage/`

</code_context>

<specifics>
## Specific Ideas

- Check `.gitignore` before adding `coverage/` — it may already be there
- Check if `c8` is already in devDependencies before adding
- The coverage step command: `npx c8 --reporter=text --reporter=lcov npm test`
- For lcov artifact upload: use `actions/upload-artifact@v4` with path `coverage/lcov.info`

</specifics>

<deferred>
## Deferred Ideas

- Coverage threshold enforcement (deferred to v1.4 — baseline unknown)
- Coveralls/Codecov upload (deferred — overkill for single contributor)
- NODE_V8_COVERAGE forwarding in helpers.mjs (c8 handles this automatically as a wrapper)

</deferred>
