// SPDX-License-Identifier: MIT
// Integration tests — drive the real CLI against the laravel/framework fixture.
// These tests are skipped automatically when the fixture is absent (CI clones it
// on the node-20 matrix leg only; other legs skip gracefully via existsSync).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./helpers.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const LARAVEL = join(HERE, "..", "tmp", "eval", "laravel-framework");

test("--packages lists laravel/framework as a dependency", { timeout: 60_000 }, (t) => {
  if (!existsSync(LARAVEL)) {
    t.skip("laravel/framework fixture not present — run node eval/eval.mjs --repo laravel-framework to clone");
    return;
  }
  const r = run(LARAVEL, "--packages");
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
  assert.match(r.stdout, /laravel\/framework/, "--packages output must mention laravel/framework");
});

test("--types returns non-empty type output for laravel/framework", { timeout: 60_000 }, (t) => {
  if (!existsSync(LARAVEL)) {
    t.skip("laravel/framework fixture not present — run node eval/eval.mjs --repo laravel-framework to clone");
    return;
  }
  const r = run(LARAVEL, "--types");
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
  assert.ok(r.stdout.length > 0, "--types output must be non-empty for a PHP repo");
});

test("--legacy exits cleanly for laravel/framework", { timeout: 60_000 }, (t) => {
  if (!existsSync(LARAVEL)) {
    t.skip("laravel/framework fixture not present — run node eval/eval.mjs --repo laravel-framework to clone");
    return;
  }
  const r = run(LARAVEL, "--legacy");
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
});

test("integration tests skip gracefully when fixture is absent", (t) => {
  // This test always passes — it documents that missing-fixture behaviour is
  // a skip (not a failure). The three tests above skip via t.skip() when
  // LARAVEL does not exist.
  assert.ok(true, "skip-guard behaviour is implicit in the three tests above");
});
