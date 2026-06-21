// SPDX-License-Identifier: MIT
// Contract — `--legacy` CLI flag (LEG-03): legacy directory detection, text and
// JSON output. These tests are intentionally RED until Plan 16-02 wires --legacy
// into agentmap.mjs. Expected failure mode: "unknown flag: --legacy" or non-zero exit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRepo, gitInit, run, cleanup } from "./helpers.mjs";

const CLEAN_FIXTURE = {
  "composer.json": JSON.stringify({
    autoload: { "psr-4": { "App\\": "src/" } },
  }),
  "src/Foo.php": `<?php\nnamespace App;\nclass Foo {}\n`,
};

const LEGACY_FIXTURE = {
  "composer.json": JSON.stringify({
    autoload: { "psr-4": { "App\\": "src/" } },
  }),
  "classes/OldFoo.php": `<?php\nclass OldFoo {}\n`,
  "src/Foo.php": `<?php\nnamespace App;\nclass Foo {}\n`,
};

const CLASSMAP_FIXTURE = {
  "composer.json": JSON.stringify({
    autoload: {
      "psr-4": { "App\\": "src/" },
      classmap: ["lib/"],
    },
  }),
  "lib/Helper.php": `<?php\nclass Helper {}\n`,
  "src/Foo.php": `<?php\nnamespace App;\nclass Foo {}\n`,
};

test("--legacy exits 0 with no legacy issues", () => {
  const dir = makeRepo(CLEAN_FIXTURE);
  gitInit(dir, { commit: true });
  try {
    const r = run(dir, "--legacy");
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
  } finally {
    cleanup(dir);
  }
});

test("--legacy reports legacy-dir warnings", () => {
  const dir = makeRepo(LEGACY_FIXTURE);
  gitInit(dir, { commit: true });
  try {
    const r = run(dir, "--legacy");
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
    assert.match(r.stdout, /classes/);
  } finally {
    cleanup(dir);
  }
});

test("--legacy --json emits valid JSON with legacyWarnings array", () => {
  const dir = makeRepo(LEGACY_FIXTURE);
  gitInit(dir, { commit: true });
  try {
    const r = run(dir, "--legacy", "--json");
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
    let parsed;
    try { parsed = JSON.parse(r.stdout); }
    catch { assert.fail(`stdout was not valid JSON:\n${r.stdout}`); }
    assert.ok(Array.isArray(parsed.legacyWarnings), "legacyWarnings must be an array");
  } finally {
    cleanup(dir);
  }
});

test("--legacy shows classmap entry", () => {
  const dir = makeRepo(CLASSMAP_FIXTURE);
  gitInit(dir, { commit: true });
  try {
    const r = run(dir, "--legacy");
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
    assert.match(r.stdout, /classmap|lib/);
  } finally {
    cleanup(dir);
  }
});
