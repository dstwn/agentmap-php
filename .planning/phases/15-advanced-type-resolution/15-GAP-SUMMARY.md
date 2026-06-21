---
phase: "15"
plan: "GAP"
subsystem: "type-resolver-tests"
tags: ["tdd", "gap-closure", "behavioral-tests", "TYP-03"]
status: complete
completed: "2026-06-21T15:10:59Z"
---

# Phase 15 GAP: TYP-03 Behavioral Test Upgrade Summary

## One-liner

Upgraded 9 existence-only TYP-03 test stubs to real behavioral assertions exercising `_walkChain()` with PSR4 resolution, depth truncation, cycle detection, and confidence/source shape — 200/200 suite GREEN.

## What Was Fixed

### Problem

TYP-03 tests (lines 164–227 of the original `test/type-resolver.test.mjs`) all asserted only:

```js
assert.ok(typeof typeResolver.resolveChain === "function", "resolveChain must be a method");
```

Eight tests (TYP-03 tests 2–9 plus TYP-04 test 2) were existence-only stubs that exercised zero behavioral logic — the RED→GREEN TDD cycle had been completed but the tests were never upgraded to real assertions.

### Fix

Replaced all existence-only stubs with real invocations of `_walkChain()` and `resolveChain()` backed by actual on-disk PHP fixture files.

## Fixture Files Created

New directory `test/fixtures/chains/` with 16 per-class PHP stubs under `namespace Chains`:

| File | Purpose |
|------|---------|
| `Builder1.php` | 1-level chain root: `build(): Result1` |
| `Result1.php` | Terminal for 1-level chain |
| `Builder2.php` | 2-level chain root: `step1(): Step2` |
| `Step2.php` | Mid-step: `step2(): Result2` |
| `Result2.php` | Terminal for 2-level chain |
| `Builder3.php` | 3-level chain root: `a(): Mid3A` |
| `Mid3A.php` | Mid-step: `b(): Mid3B` |
| `Mid3B.php` | Mid-step: `c(): Result3` |
| `Result3.php` | Terminal for 3-level chain |
| `Builder4.php` | 4-level chain root: `w(): Step4A` |
| `Step4A.php` | Mid-step: `x(): Step4B` |
| `Step4B.php` | Mid-step: `y(): Step4C` |
| `Step4C.php` | Mid-step: `z(): Result4` |
| `CycleA.php` | Cycle fixture: `next(): CycleB` |
| `CycleB.php` | Cycle fixture: `next(): CycleA` |
| `BrokenA.php` | Unknown-return fixture: `go()` (no annotation) |

PSR4 mapping used in tests: `{ "Chains\\": "chains" }` with `projectRoot = test/fixtures`.

## Behavioral Coverage Added

| Test | Behavior Verified |
|------|------------------|
| 1-level chain | `_walkChain` returns 1 entry, `returnType: "Result1"` |
| 2-level chain | 2 entries, intermediate `Step2` and final `Result2` |
| 3-level chain at limit | All 3 entries resolved, no truncation at `DEFAULT_CHAIN_DEPTH=3` |
| >3-level chain truncation | Only 3 entries returned; `stderr` contains `"chain depth limit"` |
| Cycle detection | `visited` Set prevents re-entry; `CycleA::next` and `CycleB::next` both recorded |
| Unknown return type | Chain stops at `null` returnType; second step never reached |
| Empty psr4Map | `resolveChain()` returns `[]` without throwing |
| confidence/source shape | Resolved entries carry `confidence: "LOW"` and `source: "chain"` |

## Key Decisions

- Used `_walkChain()` directly (not private in JS) rather than subclassing or mocking PSR4Resolver — cleaner and tests the real traversal path
- Cycle visited-set keys are `currentClass::method` where `currentClass` is the raw return type annotation (not FQCN after first hop) — test assertions match actual implementation behavior
- Per-class fixture files (not one monolithic file) so PSR4 can resolve each class independently via `existsSync`

## Verification

```
node --test test/type-resolver.test.mjs  → 26/26 pass
node --test test/*.mjs                   → 200/200 pass
```

## Commit

`44cac90` — `test(15): upgrade TYP-03 tests to behavioral assertions`

## Self-Check: PASSED

- All 16 fixture files exist in `test/fixtures/chains/`
- Commit `44cac90` exists in git log
- 200/200 tests pass
