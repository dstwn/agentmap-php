---
plan: 18-02
phase: 18-integration-tests
status: complete
subsystem: ci
tags: [ci, integration-tests, laravel]
completed: 2026-06-21T17:13:03Z
duration: ~2m
tasks_completed: 1
tasks_total: 1
files_changed: 1
key-decisions:
  - Clone on node-20 leg only to avoid triple network cost
---

# Phase 18 Plan 02: CI Clone Step Summary

## One-liner
Added depth-1 `laravel/framework` clone step to CI node-20 matrix leg before `Run tests`.

## What was done
Inserted `Clone laravel/framework fixture` step into `.github/workflows/ci.yml` immediately before the `Run tests` step. Step is conditioned on `matrix.node-version == 20` so only one of the three matrix legs clones the fixture (~30s network cost, not 3x).

## Result
- Integration tests in `test/integration-laravel.test.mjs` run on node-20 CI leg against real laravel/framework source
- Node-18 and node-22 legs: fixture absent → `existsSync(LARAVEL)` guard triggers → tests skip, not fail
- All pre-existing CI steps (Checkout, Setup Node, Install deps, Run tests, Smoke, Audit, Pack) unchanged

## Files changed
- `.github/workflows/ci.yml` — clone step added (lines 30–34)

## Deviations from Plan
None — plan executed exactly as written.

## Self-Check: PASSED
- `.github/workflows/ci.yml` contains `Clone laravel/framework fixture` ✓
- `if: matrix.node-version == 20` present ✓
- `git clone --depth 1 https://github.com/laravel/framework tmp/eval/laravel-framework` present ✓
- Clone step appears before `Run tests` ✓
- Commit ae294bd verified ✓
