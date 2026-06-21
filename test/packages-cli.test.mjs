// SPDX-License-Identifier: MIT
// Contract — `--packages` CLI flag (CMP-05) + `--any` routing for package names.
// These tests are intentionally RED until Plan 16-02 wires --packages into agentmap.mjs.
// Expected failure mode: "unknown flag: --packages" or non-zero exit + no output.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRepo, gitInit, run, cleanup } from "./helpers.mjs";

const COMPOSER_FIXTURE = {
  "composer.json": JSON.stringify({
    require: { "laravel/framework": "^10.0" },
    autoload: { "psr-4": { "App\\": "src/" } },
  }),
  "src/Foo.php": `<?php\nnamespace App;\nclass Foo {}\n`,
};

test("--packages exits 0 and prints package name in text output", () => {
  const dir = makeRepo(COMPOSER_FIXTURE);
  gitInit(dir, { commit: true });
  try {
    const r = run(dir, "--packages");
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
    assert.match(r.stdout, /laravel\/framework/);
  } finally {
    cleanup(dir);
  }
});

test("--packages --json emits valid JSON with packages array", () => {
  const dir = makeRepo(COMPOSER_FIXTURE);
  gitInit(dir, { commit: true });
  try {
    const r = run(dir, "--packages", "--json");
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
    let parsed;
    try { parsed = JSON.parse(r.stdout); }
    catch { assert.fail(`stdout was not valid JSON:\n${r.stdout}`); }
    assert.ok(Array.isArray(parsed.packages), "packages must be an array");
    assert.ok(
      parsed.packages.some((p) => p.to === "laravel/framework"),
      "expected laravel/framework in packages array"
    );
  } finally {
    cleanup(dir);
  }
});

test("--packages with no composer.json exits 0 and shows empty list", () => {
  const dir = makeRepo({ "src/Foo.php": `<?php\nclass Foo {}\n` });
  gitInit(dir, { commit: true });
  try {
    const r = run(dir, "--packages");
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
  } finally {
    cleanup(dir);
  }
});

test("--any with package name returns package results", () => {
  const dir = makeRepo(COMPOSER_FIXTURE);
  gitInit(dir, { commit: true });
  try {
    const r = run(dir, "--any", "laravel");
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
    assert.match(r.stdout, /laravel/);
  } finally {
    cleanup(dir);
  }
});
