---
plan: 17-01
phase: 17-ci-glob-fix
status: complete
tags: [ci, testing, glob]
subsystem: ci
completed: 2026-06-21T16:50:02Z
duration: 5m
tasks_completed: 1
tasks_total: 1
files_changed: 1
key-decisions:
  - "Use npm test in CI to delegate glob expansion to package.json scripts.test"
requires: []
provides: [ci-correct-test-glob]
affects: []
tech-stack:
  added: []
  patterns: ["npm test delegates to package.json scripts"]
key-files:
  modified:
    - .github/workflows/ci.yml
---

# Phase 17 Plan 01: Fix CI Test Glob Summary

One-liner: Changed CI `Run tests` step from bare glob to `npm test` so all 256 tests (including test/vue-sfc/) run on every push/PR.

## What was done

Changed `.github/workflows/ci.yml` `Run tests` step from `node --test test/*.test.mjs` to `npm test`.

## Why

The bare glob `test/*.test.mjs` does not recurse into subdirectories in non-interactive bash on GitHub Actions. The `test/vue-sfc/` directory (9 files, 43 tests) was silently skipped. Using `npm test` delegates glob expansion to package.json which already has the correct two-glob pattern (`test/*.test.mjs test/**/*.test.mjs`).

## Result

All 256 tests now run on every push/PR. CI test count matches `npm test` locally.

## Files changed

- `.github/workflows/ci.yml` — Run tests step updated (line 32: `run: npm test`)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `.github/workflows/ci.yml` modified ✓
- Commit e324897 exists ✓
- `npm test` locally: 256 pass, 0 fail ✓
