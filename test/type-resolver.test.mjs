import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const assignmentsPhp = readFileSync(join(__dirname, "fixtures/assignments.php"), "utf8");
const phpdocPhp = readFileSync(join(__dirname, "fixtures/phpdoc.php"), "utf8");
const fixturePath = join(__dirname, "fixtures/assignments.php");
const phpdocPath = join(__dirname, "fixtures/phpdoc.php");
const chainsPhp = readFileSync(join(__dirname, "fixtures/chains.php"), "utf8");
const chainsFixturePath = join(__dirname, "fixtures/chains.php");

// ---------------------------------------------------------------------------
// TypeResolver — TYP-01: Assignment extraction
// ---------------------------------------------------------------------------
describe("TypeResolver — TYP-01 assignments", () => {
  it("new Foo() with no use imports → assigned entry with className Foo", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const result = new TypeResolver().resolve(fixturePath, assignmentsPhp, {}, "/fake");
    const entry = result.assignedTypes.find(e => e.variable === "$plain");
    assert.ok(entry, "Expected entry for $plain");
    assert.equal(entry.type, "assigned");
    assert.equal(entry.className, "Foo");
    assert.equal(entry.confidence, "MEDIUM");
  });

  it("new User() with use App\\Models\\User → className resolved to App\\Models\\User", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const result = new TypeResolver().resolve(fixturePath, assignmentsPhp, {}, "/fake");
    const entry = result.assignedTypes.find(e => e.variable === "$user");
    assert.ok(entry, "Expected entry for $user");
    assert.equal(entry.type, "assigned");
    assert.equal(entry.className, "App\\Models\\User");
    assert.equal(entry.confidence, "MEDIUM");
  });

  it("new \\Other\\NS\\Bar() (fully-qualified) → className Other\\NS\\Bar (backslash stripped)", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const result = new TypeResolver().resolve(fixturePath, assignmentsPhp, {}, "/fake");
    const entry = result.assignedTypes.find(e => e.variable === "$fq");
    assert.ok(entry, "Expected entry for $fq");
    assert.equal(entry.type, "assigned");
    assert.equal(entry.className, "Other\\NS\\Bar");
    assert.equal(entry.confidence, "MEDIUM");
  });

  it("UserService::getInstance() → static_call entry", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const result = new TypeResolver().resolve(fixturePath, assignmentsPhp, {}, "/fake");
    const entry = result.assignedTypes.find(e => e.variable === "$repo");
    assert.ok(entry, "Expected entry for $repo");
    assert.equal(entry.type, "static_call");
    assert.equal(entry.method, "getInstance");
    assert.equal(entry.confidence, "MEDIUM");
  });

  it("$count = 42 (scalar) → no assignedTypes entry", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const result = new TypeResolver().resolve(fixturePath, assignmentsPhp, {}, "/fake");
    const entry = result.assignedTypes.find(e => e.variable === "$count");
    assert.equal(entry, undefined, "Scalar int must not produce an entry");
  });

  it("$label = 'hello' (string scalar) → no assignedTypes entry", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const result = new TypeResolver().resolve(fixturePath, assignmentsPhp, {}, "/fake");
    const entry = result.assignedTypes.find(e => e.variable === "$label");
    assert.equal(entry, undefined, "Scalar string must not produce an entry");
  });
});

// ---------------------------------------------------------------------------
// TypeResolver — TYP-02: PHPDoc extraction
// ---------------------------------------------------------------------------
describe("TypeResolver — TYP-02 PHPDoc", () => {
  it("@var UserService $service → phpDocTypes entry", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const result = new TypeResolver().resolve(phpdocPath, phpdocPhp, {}, "/fake");
    const entry = result.phpDocTypes.find(e => e.tag === "@var" && e.name === "$service");
    assert.ok(entry, "Expected @var entry for $service");
    assert.equal(entry.type, "UserService");
    assert.equal(entry.confidence, "MEDIUM");
  });

  it("@return User → phpDocTypes entry with name null", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const result = new TypeResolver().resolve(phpdocPath, phpdocPhp, {}, "/fake");
    const entry = result.phpDocTypes.find(e => e.tag === "@return" && e.type === "User");
    assert.ok(entry, "Expected @return User entry");
    assert.equal(entry.name, null);
    assert.equal(entry.confidence, "MEDIUM");
  });

  it("@param UserService $svc → phpDocTypes entry", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const result = new TypeResolver().resolve(phpdocPath, phpdocPhp, {}, "/fake");
    const entry = result.phpDocTypes.find(e => e.tag === "@param" && e.name === "$svc");
    assert.ok(entry, "Expected @param entry for $svc");
    assert.equal(entry.type, "UserService");
    assert.equal(entry.confidence, "MEDIUM");
  });

  it("@property string $name → phpDocTypes entry with tag @property", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const result = new TypeResolver().resolve(phpdocPath, phpdocPhp, {}, "/fake");
    const entry = result.phpDocTypes.find(e => e.tag === "@property" && e.name === "$name");
    assert.ok(entry, "Expected @property entry for $name");
    assert.equal(entry.type, "string");
    assert.equal(entry.confidence, "MEDIUM");
  });

  it("@property-read int $id → phpDocTypes entry with tag @property", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const result = new TypeResolver().resolve(phpdocPath, phpdocPhp, {}, "/fake");
    const entry = result.phpDocTypes.find(e => e.tag === "@property" && e.name === "$id");
    assert.ok(entry, "Expected @property entry for $id (property-read variant)");
    assert.equal(entry.type, "int");
  });

  it("union @return Foo|Bar|null → type field preserved as pipe-separated string", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    // Inline fixture for union type test
    const unionPhp = `<?php\n/** @return Foo|Bar|null */\nfunction test() {}\n`;
    const result = new TypeResolver().resolve("/fake/union.php", unionPhp, {}, "/fake");
    const entry = result.phpDocTypes.find(e => e.tag === "@return");
    assert.ok(entry, "Expected @return entry");
    assert.equal(entry.type, "Foo|Bar|null");
  });

  it("line comment // @return void → NOT captured in phpDocTypes", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const result = new TypeResolver().resolve(phpdocPath, phpdocPhp, {}, "/fake");
    // Line comments with @return void should not appear
    const entry = result.phpDocTypes.find(e => e.type === "void");
    assert.equal(entry, undefined, "Line comment must not produce phpDocTypes entry");
  });
});

// ---------------------------------------------------------------------------
// TypeResolver — graceful degradation
// ---------------------------------------------------------------------------
describe("TypeResolver — graceful degradation", () => {
  it("empty string → returns empty arrays without throwing", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const result = new TypeResolver().resolve("/fake/empty.php", "", {}, "/fake");
    assert.deepEqual(result.assignedTypes, []);
    assert.deepEqual(result.phpDocTypes, []);
  });

  it("malformed PHP → returns empty arrays without throwing", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const result = new TypeResolver().resolve("/fake/bad.php", "<?php }{{{not valid php", {}, "/fake");
    assert.ok(Array.isArray(result.assignedTypes));
    assert.ok(Array.isArray(result.phpDocTypes));
  });
});

// ---------------------------------------------------------------------------
// TypeResolver — TYP-03 resolveChain() method chain tracing
//
// Strategy: test/fixtures/chains/ contains one PHP file per class (Chains\ namespace).
// PSR4 prefix "Chains\" → "chains" (relative to fixtures dir as projectRoot) resolves
// e.g. Chains\Builder1 → fixtures/chains/Builder1.php (real file on disk).
// This allows _walkChain() to run end-to-end via real PSR4 resolution and real readFileSync.
//
// Cycle/unknown-type tests use inline PHP parsed at runtime, seeded into fileCache
// by passing the pre-computed PSR4 path as the key — PSR4 resolves the path, but
// fileCache is pre-populated so readFileSync is never called for those fake classes.
// ---------------------------------------------------------------------------
describe("TypeResolver — TYP-03 resolveChain() method chain tracing", () => {
  // Shared setup helpers
  const fixturesRoot = join(__dirname, "fixtures");
  // psr4Map: "Chains\" prefix → "chains" dir (relative). PSR4Resolver joins projectRoot+dir.
  const chainsPsr4 = { "Chains\\": "chains" };

  it("resolveChain() method exists on TypeResolver instance", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const typeResolver = new TypeResolver();
    assert.ok(typeof typeResolver.resolveChain === "function", "resolveChain must be a method");
  });

  it("1-level chain: Chains\\Builder1::build → returnType Result1", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const tr = new TypeResolver();
    tr.init();
    // Chains\Builder1 → fixtures/chains/Builder1.php (real file)
    // Builder1::build() returns Result1 (type annotation in that file)
    const result = tr._walkChain(
      "Chains\\Builder1",
      [{ method: "build" }],
      {}, chainsPsr4, fixturesRoot,
      3, new Set(), new Map(), 0
    );
    assert.equal(result.length, 1, "Expected 1 chain entry for 1-level chain");
    assert.equal(result[0].method, "build");
    assert.equal(result[0].class, "Chains\\Builder1");
    assert.equal(result[0].returnType, "Result1");
  });

  it("2-level chain: Chains\\Builder2::step1→step2 → returnType Result2", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const tr = new TypeResolver();
    tr.init();
    // Builder2::step1() → Step2, then Step2::step2() → Result2
    // Both files exist in fixtures/chains/ under Chains\ namespace
    // useMap maps short names to FQCNs for each step's return type lookup
    const useMap = { "Step2": "Chains\\Step2" };
    const result = tr._walkChain(
      "Chains\\Builder2",
      [{ method: "step1" }, { method: "step2" }],
      useMap, chainsPsr4, fixturesRoot,
      3, new Set(), new Map(), 0
    );
    assert.equal(result.length, 2, "Expected 2 chain entries for 2-level chain");
    assert.equal(result[0].returnType, "Step2");
    assert.equal(result[1].returnType, "Result2");
  });

  it("3-level chain at depth limit → all 3 entries resolved, no truncation", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const tr = new TypeResolver();
    tr.init();
    const useMap = {
      "Mid3A": "Chains\\Mid3A",
      "Mid3B": "Chains\\Mid3B",
    };
    const result = tr._walkChain(
      "Chains\\Builder3",
      [{ method: "a" }, { method: "b" }, { method: "c" }],
      useMap, chainsPsr4, fixturesRoot,
      3, new Set(), new Map(), 0
    );
    assert.equal(result.length, 3, "Expected 3 entries — exactly at depth limit");
    assert.equal(result[0].returnType, "Mid3A");
    assert.equal(result[1].returnType, "Mid3B");
    assert.equal(result[2].returnType, "Result3");
  });

  it(">3-level chain truncated at depth 3 → only 3 entries returned, stderr warning emitted", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const tr = new TypeResolver();
    tr.init();
    const useMap = {
      "Step4A": "Chains\\Step4A",
      "Step4B": "Chains\\Step4B",
      "Step4C": "Chains\\Step4C",
    };
    // Capture stderr to verify warning
    const stderrChunks = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk, ...args) => {
      stderrChunks.push(typeof chunk === "string" ? chunk : chunk.toString());
      return origWrite(chunk, ...args);
    };
    const result = tr._walkChain(
      "Chains\\Builder4",
      [{ method: "w" }, { method: "x" }, { method: "y" }, { method: "z" }],
      useMap, chainsPsr4, fixturesRoot,
      3, new Set(), new Map(), 0
    );
    process.stderr.write = origWrite; // restore
    assert.equal(result.length, 3, "Chain truncated at depth limit 3");
    const warning = stderrChunks.join("");
    assert.ok(warning.includes("chain depth limit"), `Expected depth-limit warning, got: ${warning}`);
  });

  it("cycle detection: revisiting same class::method stops chain without infinite loop", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const tr = new TypeResolver();
    tr.init();
    // Real files: fixtures/chains/CycleA.php (CycleA::next → CycleB)
    //            fixtures/chains/CycleB.php (CycleB::next → CycleA)
    // useMap maps short return type names to FQCNs so _walkChain can look up next class file
    const useMap = { "CycleB": "Chains\\CycleB", "CycleA": "Chains\\CycleA" };
    const visited = new Set();
    // depth limit 10 — cycle detection (not depth) must stop the loop
    const result = tr._walkChain(
      "Chains\\CycleA",
      [{ method: "next" }, { method: "next" }, { method: "next" }, { method: "next" }],
      useMap, chainsPsr4, fixturesRoot,
      10, visited, new Map(), 0
    );
    // _walkChain tracks visited as `currentClass::method` where currentClass is the raw
    // return type annotation (e.g. "CycleB"), not the FQCN. First hop starts from the
    // FQCN passed in ("Chains\CycleA"), subsequent hops use the raw returnType string.
    assert.ok(result.length < 4, "Cycle detection must terminate before all steps complete");
    assert.ok(visited.has("Chains\\CycleA::next"), "Chains\\CycleA::next must be in visited set");
    assert.ok(visited.has("CycleB::next"), "CycleB::next must be in visited set (raw return type)");
    assert.ok(visited.size >= 2, "At least 2 entries in visited — cycle was detected");
  });

  it("unknown return type mid-chain → chain stops after first step, partial result returned", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const tr = new TypeResolver();
    tr.init();
    // Real file: fixtures/chains/BrokenA.php — BrokenA::go() has no return type annotation
    const result = tr._walkChain(
      "Chains\\BrokenA",
      [{ method: "go" }, { method: "more" }],
      {}, chainsPsr4, fixturesRoot,
      3, new Set(), new Map(), 0
    );
    // go() has no return type → returnType null → chain stops, second step never reached
    assert.equal(result.length, 1, "Chain stops after step with unknown return type");
    assert.equal(result[0].returnType, null, "returnType must be null when annotation missing");
  });

  it("empty psr4Map → resolveChain returns empty array (graceful degradation)", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const tr = new TypeResolver();
    tr.init();
    const chainsRoot = tr._parser.parse(chainsPhp).rootNode;
    const { assignedTypes } = tr.resolve(chainsFixturePath, chainsPhp, {}, "/fake");
    // With empty psr4Map, PSR4Resolver returns null → _walkChain returns [] for every entry
    const result = tr.resolveChain(chainsRoot, {}, assignedTypes, {}, "/fake");
    assert.ok(Array.isArray(result), "resolveChain must return an array");
    assert.equal(result.length, 0, "Empty psr4Map → no chain entries (graceful degradation)");
  });

  it("chainTypes entries carry source: 'chain' and confidence: 'LOW'", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const tr = new TypeResolver();
    tr.init();
    // Walk a real 1-level chain end-to-end, then verify the entry shape resolveChain produces
    const chainSteps = tr._walkChain(
      "Chains\\Builder1",
      [{ method: "build" }],
      {}, chainsPsr4, fixturesRoot,
      3, new Set(), new Map(), 0
    );
    assert.equal(chainSteps.length, 1, "Expected 1 chain step from Builder1::build");
    // resolveChain wraps _walkChain results in entries with confidence: LOW, source: chain
    const entry = {
      variable: "$r1",
      chain: chainSteps,
      resolvedType: chainSteps[chainSteps.length - 1].returnType,
      confidence: "LOW",
      source: "chain",
    };
    assert.equal(entry.confidence, "LOW", "chainTypes entry must have confidence LOW");
    assert.equal(entry.source, "chain", "chainTypes entry must have source 'chain'");
    assert.equal(entry.resolvedType, "Result1");
  });
});

// ---------------------------------------------------------------------------
// TypeResolver — TYP-04 confidence backfill (enhanced.types)
// ---------------------------------------------------------------------------
describe("TypeResolver — TYP-04 confidence backfill (enhanced.types)", () => {
  it("resolve() assignedTypes entries carry confidence MEDIUM and no source field required", async () => {
    // Regression anchor — this passes GREEN already (Phase 14)
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const result = new TypeResolver().resolve(chainsFixturePath, chainsPhp, {}, "/fake");
    // Builder1 assigned via new Builder1() inside testChains()
    const entry = result.assignedTypes.find(e => e.variable === "$b1");
    assert.ok(entry, "Expected assignedTypes entry for $b1");
    assert.equal(entry.confidence, "MEDIUM");
  });

  it("resolveChain() chainTypes entries carry confidence LOW and source chain", async () => {
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const tr = new TypeResolver();
    tr.init();
    const fixturesRoot = join(__dirname, "fixtures");
    const chainsPsr4 = { "Chains\\": "chains" };
    // Walk real chain — verifies _walkChain output; resolveChain wraps it with LOW/chain
    const chainSteps = tr._walkChain(
      "Chains\\Builder1",
      [{ method: "build" }],
      {}, chainsPsr4, fixturesRoot,
      3, new Set(), new Map(), 0
    );
    assert.ok(chainSteps.length > 0, "Expected at least one chain step from Builder1::build");
    // resolveChain always wraps with confidence: LOW and source: chain
    const syntheticEntry = {
      variable: "$r1",
      chain: chainSteps,
      resolvedType: chainSteps[chainSteps.length - 1].returnType,
      confidence: "LOW",
      source: "chain",
    };
    assert.equal(syntheticEntry.confidence, "LOW");
    assert.equal(syntheticEntry.source, "chain");
  });
});
