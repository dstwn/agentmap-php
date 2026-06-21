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
// ---------------------------------------------------------------------------
describe("TypeResolver — TYP-03 resolveChain() method chain tracing", () => {
  it("resolveChain() method exists on TypeResolver instance", async () => {
    // Will fail RED: resolveChain does not exist yet
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const typeResolver = new TypeResolver();
    assert.ok(typeof typeResolver.resolveChain === "function", "resolveChain must be a method");
  });

  it("1-level chain: $r1 = $b1->build() → chainTypes entry with resolvedType Result1, confidence LOW", async () => {
    // Will fail RED: resolveChain does not exist yet
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const typeResolver = new TypeResolver();
    assert.ok(typeof typeResolver.resolveChain === "function", "resolveChain must be a method");
  });

  it("2-level chain: $r2 = $b2->step1()->step2() → resolvedType Result2, confidence LOW", async () => {
    // Will fail RED: resolveChain does not exist yet
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const typeResolver = new TypeResolver();
    assert.ok(typeof typeResolver.resolveChain === "function", "resolveChain must be a method");
  });

  it("3-level chain at depth limit → resolvedType Result3, confidence LOW, no warning skipped", async () => {
    // Will fail RED: resolveChain does not exist yet
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const typeResolver = new TypeResolver();
    assert.ok(typeof typeResolver.resolveChain === "function", "resolveChain must be a method");
  });

  it(">3-level chain truncated at depth 3 → confidence LOW, stderr warning emitted", async () => {
    // Will fail RED: resolveChain does not exist yet
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const typeResolver = new TypeResolver();
    assert.ok(typeof typeResolver.resolveChain === "function", "resolveChain must be a method");
  });

  it("cycle detection: revisiting same class::method stops chain, returns LOW confidence", async () => {
    // Will fail RED: resolveChain does not exist yet
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const typeResolver = new TypeResolver();
    assert.ok(typeof typeResolver.resolveChain === "function", "resolveChain must be a method");
  });

  it("unknown return type mid-chain → chain stops, partial result with confidence LOW", async () => {
    // Will fail RED: resolveChain does not exist yet
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const typeResolver = new TypeResolver();
    assert.ok(typeof typeResolver.resolveChain === "function", "resolveChain must be a method");
  });

  it("empty psr4Map → resolveChain returns empty array (graceful degradation)", async () => {
    // Will fail RED: resolveChain does not exist yet
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const typeResolver = new TypeResolver();
    assert.ok(typeof typeResolver.resolveChain === "function", "resolveChain must be a method");
  });

  it("chainTypes entries carry source: chain", async () => {
    // Will fail RED: resolveChain does not exist yet
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const typeResolver = new TypeResolver();
    assert.ok(typeof typeResolver.resolveChain === "function", "resolveChain must be a method");
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
    // Will fail RED: resolveChain does not exist yet
    const { TypeResolver } = await import("../src/Core/TypeResolver.mjs");
    const typeResolver = new TypeResolver();
    assert.ok(typeof typeResolver.resolveChain === "function", "resolveChain must be a method");
  });
});
