---
phase: 15
slug: advanced-type-resolution
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-21
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js native test runner (node:test) |
| **Config file** | none — invoked directly |
| **Quick run command** | `node --test test/type-resolver.test.mjs` |
| **Full suite command** | `node --test test/*.test.mjs` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test test/type-resolver.test.mjs`
- **After every plan wave:** Run `node --test test/*.test.mjs`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Automated Command | File Exists | Status |
|---------|------|------|-------------|-------------------|-------------|--------|
| 15-01-T1 | 01 | 1 | TYP-03, TYP-04 | `node --test test/type-resolver.test.mjs` | ❌ W0 | ⬜ pending |
| 15-01-T2 | 01 | 1 | TYP-03, TYP-04 | `node --test test/type-resolver.test.mjs` | ❌ W0 | ⬜ pending |
| 15-02-T1 | 02 | 2 | TYP-03, TYP-04 | `node --test test/type-resolver.test.mjs` | ✅ | ⬜ pending |
| 15-02-T2 | 02 | 2 | TYP-03, TYP-04 | `node --test test/*.test.mjs` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/fixtures/chains.php` — chain fixtures for TYP-03 (1/2/3/>3-level chains)
- [ ] Chain test cases in `test/type-resolver.test.mjs` — TYP-03 chain resolution + TYP-04 confidence backfill

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
