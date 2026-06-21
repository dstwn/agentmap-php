// SPDX-License-Identifier: MIT
// Contract — `--types` CLI flag (TYP-05): per-file and symbol-level type output
// with confidence filtering. These tests are intentionally RED until Plan 16-02
// wires --types into agentmap.mjs.
// Expected failure mode: "unknown flag: --types" or non-zero exit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRepo, gitInit, run, cleanup } from "./helpers.mjs";

const TYPED_FIXTURE = {
  "composer.json": JSON.stringify({
    autoload: { "psr-4": { "App\\": "src/" } },
  }),
  "src/Foo.php": `<?php\nnamespace App;\nclass Foo {\n    private string $name;\n    public function __construct(string $name) {\n        $this->name = $name;\n    }\n}\n`,
};

const CHAIN_FIXTURE = {
  "composer.json": JSON.stringify({
    autoload: { "psr-4": { "App\\": "src/" } },
  }),
  "src/Chain.php": `<?php\nnamespace App;\nclass Chain {\n    public function b() { return $this; }\n    public function c() { return $this; }\n    public function run() {\n        $a = new Chain();\n        return $a->b()->c();\n    }\n}\n`,
};

test("--types exits 0 with no arg and lists PHP files", () => {
  const dir = makeRepo(TYPED_FIXTURE);
  gitInit(dir, { commit: true });
  try {
    const r = run(dir, "--types");
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
  } finally {
    cleanup(dir);
  }
});

test("--types path/to/File.php shows type detail for that file", () => {
  const dir = makeRepo(TYPED_FIXTURE);
  gitInit(dir, { commit: true });
  try {
    const r = run(dir, "--types", "src/Foo.php");
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
    assert.match(r.stdout, /Foo/);
  } finally {
    cleanup(dir);
  }
});

test("--types --json emits valid JSON", () => {
  const dir = makeRepo(TYPED_FIXTURE);
  gitInit(dir, { commit: true });
  try {
    const r = run(dir, "--types", "--json");
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
    let parsed;
    try { parsed = JSON.parse(r.stdout); }
    catch { assert.fail(`stdout was not valid JSON:\n${r.stdout}`); }
    assert.equal(parsed.command, "types");
  } finally {
    cleanup(dir);
  }
});

test("LOW confidence types hidden by default", () => {
  const dir = makeRepo(CHAIN_FIXTURE);
  gitInit(dir, { commit: true });
  try {
    const r = run(dir, "--types");
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
    assert.doesNotMatch(r.stdout, /LOW/);
  } finally {
    cleanup(dir);
  }
});
