---
plan: 19-02
status: complete
---
# Summary: Plan 19-02 — CI Coverage Step

## What was done
Added two steps to .github/workflows/ci.yml after `Run tests`, both conditioned on `matrix.node-version == 20`:
- `Coverage report`: runs `npx c8 --reporter=text --reporter=lcov npm test`
- `Upload coverage artifact`: uploads coverage/lcov.info as CI artifact (name: coverage-lcov)

## COV-03 note
No threshold enforcement added. Coverage % baseline is unknown until first CI run. Threshold flags to be added in v1.4 after baseline measurement.

## Files changed
- `.github/workflows/ci.yml` — 2 coverage steps added

## Self-Check: PASSED
- fa23c0d: ci: add c8 coverage report step on node-20 leg
- ci.yml contains Coverage report step, upload-artifact@v4, npx c8, matrix.node-version == 20 conditions
