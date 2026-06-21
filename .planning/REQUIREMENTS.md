# Requirements: agentmap-php

**Defined:** 2026-06-21
**Core Value:** Give PHP/Laravel developers the same repo-context superpower TS/JS projects get from agentmap

## v1.3 Requirements

Requirements for v1.3 CI Integration Testing milestone. Each maps to roadmap phases.

### CI Pipeline

- [ ] **CI-01**: CI runs all 256 tests on every push/PR (currently 43 in test/vue-sfc/ are silently skipped by glob)
- [ ] **CI-02**: CI glob is quoted or uses `npm test` to avoid non-interactive bash globstar expansion trap

### Integration Tests

- [x] **INTG-01**: User can verify `--packages` flag works end-to-end against a real Laravel repo in CI
- [x] **INTG-02**: User can verify `--types` flag works end-to-end against a real Laravel repo in CI
- [x] **INTG-03**: User can verify `--legacy` flag works end-to-end against a real Laravel repo in CI
- [x] **INTG-04**: Integration tests skip gracefully when laravel/framework fixture is absent (no CI failure on missing fixture)

### Coverage

- [ ] **COV-01**: Coverage summary (text) appears in CI logs on every run
- [ ] **COV-02**: `c8` collects coverage across subprocess boundary so `src/Core/` modules are included in report
- [ ] **COV-03**: Coverage threshold enforcement deferred to v1.4 (baseline unknown; document expected low % in plan)

## Future Requirements (v1.4+)

### Coverage

- **COV-04**: Coverage threshold enforcement — `--test-coverage-lines=N` on Node 22 leg after baseline measured
- **COV-05**: Coverage upload to Coveralls or lcov PR annotation for trend tracking

### Integration Tests

- **INTG-05**: Full laravel/framework integration suite covering all CLI flags (beyond --packages/--types/--legacy)
- **INTG-06**: Test sharding for parallel execution when suite grows

## Out of Scope

| Feature | Reason |
|---------|--------|
| External coverage service (Coveralls/Codecov) in v1.3 | Overkill until contributor base grows; baseline unknown |
| Coverage threshold enforcement in v1.3 | Subprocess architecture means low % until NODE_V8_COVERAGE confirmed; defer to v1.4 |
| Full laravel/framework clone in CI for all flags | Too slow; scope to three v1.2 flags only |
| Test sharding | Not a bottleneck at current scale |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CI-01 | Phase 17 | Pending |
| CI-02 | Phase 17 | Pending |
| INTG-01 | Phase 18 | Complete |
| INTG-02 | Phase 18 | Complete |
| INTG-03 | Phase 18 | Complete |
| INTG-04 | Phase 18 | Complete |
| COV-01 | Phase 19 | Pending |
| COV-02 | Phase 19 | Pending |
| COV-03 | Phase 19 | Pending |

**Coverage:**

- v1.3 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-21*
*Last updated: 2026-06-21 after initial definition*
