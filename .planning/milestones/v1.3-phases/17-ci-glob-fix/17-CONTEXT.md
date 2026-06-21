# Phase 17: CI Glob Fix - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the CI workflow glob so all 256 tests run on every push and PR. The current `.github/workflows/ci.yml` uses `test/*.test.mjs` which silently skips the `test/vue-sfc/` subdirectory (43 tests). Fix must use a quoted glob or `npm test` to avoid non-interactive bash globstar expansion. `package.json` `test` script already has the correct two-glob pattern.

</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion

All implementation choices are at the agent's discretion — pure infrastructure phase. Key constraint: quote the glob or use `npm test`; bare unquoted `**` silently degrades in non-interactive bash on GitHub Actions. Research recommends using `npm test` to keep CI in sync with the package.json script automatically.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.github/workflows/ci.yml` — existing CI, line 32: `node --test test/*.test.mjs` (the bug)
- `package.json` scripts.test: `node --test test/*.test.mjs test/**/*.test.mjs` (correct pattern, already has both globs)

### Established Patterns
- Node --test runner with no additional test framework
- Node 18/20/22 matrix (fail-fast: false)
- test/vue-sfc/ is a subdirectory with 9 test files contributing 43 tests

### Integration Points
- Only `.github/workflows/ci.yml` needs to change (the `Run tests` step)
- No source code changes — pure CI configuration fix

</code_context>

<specifics>
## Specific Ideas

Use `npm test` in CI instead of bare `node --test` glob — this keeps CI automatically in sync with package.json and avoids shell glob expansion differences. Alternatively quote both globs as `"test/*.test.mjs" "test/**/*.test.mjs"`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
