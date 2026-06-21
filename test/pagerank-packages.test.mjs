// SPDX-License-Identifier: MIT
// Contract — package→file PageRank edge merging (CMP-04).
// These tests are intentionally RED until Plan 16-02 wires package nodes into
// the PageRank graph. Expected failure mode: parsed.packages missing or lacks
// pagerank field.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRepo, gitInit, run, cleanup } from "./helpers.mjs";

const FIXTURE = {
  "composer.json": JSON.stringify({
    require: { "vendor/pkg": "^1.0" },
    autoload: { "psr-4": { "App\\": "src/" } },
  }),
  "src/A.php": `<?php\nnamespace App;\nclass A {}\n`,
  "src/B.php": `<?php\nnamespace App;\nclass B {}\n`,
};

test("package nodes appear in --print output after build", () => {
  const dir = makeRepo(FIXTURE);
  gitInit(dir, { commit: true });
  try {
    const r = run(dir, "--print");
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
    let parsed;
    try { parsed = JSON.parse(r.stdout); }
    catch { assert.fail(`stdout was not valid JSON:\n${r.stdout}`); }
    assert.ok(Array.isArray(parsed.packages), "parsed.packages must be an array");
    assert.ok(parsed.packages.length > 0, "packages array must be non-empty");
  } finally {
    cleanup(dir);
  }
});

test("package nodes carry pagerank field after edge merging", () => {
  const dir = makeRepo(FIXTURE);
  gitInit(dir, { commit: true });
  try {
    const r = run(dir, "--print");
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
    let parsed;
    try { parsed = JSON.parse(r.stdout); }
    catch { assert.fail(`stdout was not valid JSON:\n${r.stdout}`); }
    assert.ok(Array.isArray(parsed.packages), "parsed.packages must be an array");
    assert.ok(parsed.packages.length > 0, "packages array must be non-empty");
    const pkg = parsed.packages[0];
    assert.ok("pagerank" in pkg, "package node must have a pagerank field");
    assert.equal(typeof pkg.pagerank, "number", "pagerank must be a number");
  } finally {
    cleanup(dir);
  }
});
