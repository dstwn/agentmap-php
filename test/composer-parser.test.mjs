import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// PSR4Resolver tests
// ---------------------------------------------------------------------------
describe("PSR4Resolver", () => {
  it("resolves FQCN to absolute path when file exists", async () => {
    const { PSR4Resolver } = await import("../src/Core/PSR4Resolver.mjs");
    const dir = mkdtempSync(join(tmpdir(), "psr4-test-"));
    mkdirSync(join(dir, "app", "Http", "Controllers"), { recursive: true });
    writeFileSync(join(dir, "app", "Http", "Controllers", "UserController.php"), "<?php");
    const result = new PSR4Resolver().resolve(
      "App\\Http\\Controllers\\UserController",
      dir,
      { "App\\": "app/" }
    );
    assert.equal(result, join(dir, "app", "Http", "Controllers", "UserController.php"));
    rmSync(dir, { recursive: true });
  });

  it("returns null when file does not exist", async () => {
    const { PSR4Resolver } = await import("../src/Core/PSR4Resolver.mjs");
    const dir = mkdtempSync(join(tmpdir(), "psr4-test-"));
    const result = new PSR4Resolver().resolve(
      "App\\Http\\Controllers\\UserController",
      dir,
      { "App\\": "app/" }
    );
    assert.equal(result, null);
    rmSync(dir, { recursive: true });
  });

  it("returns null with empty psr4Map", async () => {
    const { PSR4Resolver } = await import("../src/Core/PSR4Resolver.mjs");
    const dir = mkdtempSync(join(tmpdir(), "psr4-test-"));
    const result = new PSR4Resolver().resolve("Foo\\Bar", dir, {});
    assert.equal(result, null);
    rmSync(dir, { recursive: true });
  });

  it("handles trailing backslash in prefix key", async () => {
    const { PSR4Resolver } = await import("../src/Core/PSR4Resolver.mjs");
    const dir = mkdtempSync(join(tmpdir(), "psr4-test-"));
    mkdirSync(join(dir, "tests", "Unit"), { recursive: true });
    writeFileSync(join(dir, "tests", "Unit", "FooTest.php"), "<?php");
    const result = new PSR4Resolver().resolve(
      "Tests\\Unit\\FooTest",
      dir,
      { "Tests\\": "tests/" }
    );
    assert.equal(result, join(dir, "tests", "Unit", "FooTest.php"));
    rmSync(dir, { recursive: true });
  });

  it("iterates array-valued dirs and returns first hit", async () => {
    const { PSR4Resolver } = await import("../src/Core/PSR4Resolver.mjs");
    const dir = mkdtempSync(join(tmpdir(), "psr4-test-"));
    mkdirSync(join(dir, "src", "app", "Models"), { recursive: true });
    writeFileSync(join(dir, "src", "app", "Models", "User.php"), "<?php");
    const result = new PSR4Resolver().resolve(
      "App\\Models\\User",
      dir,
      { "App\\": ["app/", "src/app/"] }
    );
    assert.equal(result, join(dir, "src", "app", "Models", "User.php"));
    rmSync(dir, { recursive: true });
  });
});

// ---------------------------------------------------------------------------
// ComposerParser tests
// ---------------------------------------------------------------------------
describe("ComposerParser", () => {
  it("parses require edges from composer.json", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "composer-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "vendor/project",
      require: { "laravel/framework": "^10.0" },
      "require-dev": { "phpunit/phpunit": "^10.0" },
    }));
    const result = new ComposerParser().parse(dir);
    assert.ok(result.packages.some(p => p.type === "require" && p.to === "laravel/framework"));
    assert.ok(result.packages.some(p => p.type === "require-dev" && p.to === "phpunit/phpunit"));
    assert.equal(result.packages.find(p => p.to === "laravel/framework").constraint, "^10.0");
    rmSync(dir, { recursive: true });
  });

  it("uses json.name as 'from' field", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "composer-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "vendor/project",
      require: { "laravel/framework": "^10.0" },
    }));
    const result = new ComposerParser().parse(dir);
    assert.equal(result.packages[0].from, "vendor/project");
    rmSync(dir, { recursive: true });
  });

  it("uses '(root)' as 'from' when name absent", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "composer-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      require: { "laravel/framework": "^10.0" },
    }));
    const result = new ComposerParser().parse(dir);
    assert.equal(result.packages[0].from, "(root)");
    rmSync(dir, { recursive: true });
  });

  it("parses all 6 link types", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "composer-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "acme/app",
      require: { "laravel/framework": "^10.0" },
      "require-dev": { "phpunit/phpunit": "^10.0" },
      conflict: { "old/package": "<2.0" },
      replace: { "other/package": "self.version" },
      provide: { "psr/log-implementation": "3.0" },
      suggest: { "ext-redis": "Required for Redis cache driver" },
    }));
    const result = new ComposerParser().parse(dir);
    const types = result.packages.map(p => p.type);
    assert.ok(types.includes("require"));
    assert.ok(types.includes("require-dev"));
    assert.ok(types.includes("conflict"));
    assert.ok(types.includes("replace"));
    assert.ok(types.includes("provide"));
    assert.ok(types.includes("suggest"));
    rmSync(dir, { recursive: true });
  });

  it("stores constraint verbatim (no normalization)", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "composer-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "acme/app",
      require: { "some/pkg": "~1.4" },
      suggest: { "ext-redis": "Required for Redis cache driver" },
    }));
    const result = new ComposerParser().parse(dir);
    assert.equal(result.packages.find(p => p.to === "some/pkg").constraint, "~1.4");
    assert.equal(result.packages.find(p => p.to === "ext-redis").constraint, "Required for Redis cache driver");
    rmSync(dir, { recursive: true });
  });

  it("merges resolvedVersion from composer.lock packages", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "composer-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "acme/app",
      require: { "laravel/framework": "^10.0" },
    }));
    writeFileSync(join(dir, "composer.lock"), JSON.stringify({
      packages: [{ name: "laravel/framework", version: "10.48.22" }],
      "packages-dev": [],
    }));
    const result = new ComposerParser().parse(dir);
    assert.equal(result.packages.find(p => p.to === "laravel/framework").resolvedVersion, "10.48.22");
    rmSync(dir, { recursive: true });
  });

  it("resolvedVersion from packages-dev in composer.lock (Pitfall 1)", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "composer-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "acme/app",
      "require-dev": { "phpunit/phpunit": "^10.0" },
    }));
    writeFileSync(join(dir, "composer.lock"), JSON.stringify({
      packages: [],
      "packages-dev": [{ name: "phpunit/phpunit", version: "10.5.20" }],
    }));
    const result = new ComposerParser().parse(dir);
    assert.equal(result.packages.find(p => p.to === "phpunit/phpunit").resolvedVersion, "10.5.20");
    rmSync(dir, { recursive: true });
  });

  it("resolvedVersion is null when not in lock", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "composer-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "acme/app",
      require: { "laravel/framework": "^10.0" },
    }));
    const result = new ComposerParser().parse(dir);
    assert.equal(result.packages.find(p => p.to === "laravel/framework").resolvedVersion, null);
    rmSync(dir, { recursive: true });
  });

  it("returns empty result with stderr warning when composer.json missing", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "no-composer-"));
    const result = new ComposerParser().parse(dir);
    assert.deepEqual(result.packages, []);
    assert.deepEqual(result.psr4Map, {});
    assert.deepEqual(result.classmaps, []);
    assert.deepEqual(result.autoFiles, []);
    rmSync(dir, { recursive: true });
  });

  it("returns empty result when composer.json is corrupt JSON", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "bad-composer-"));
    writeFileSync(join(dir, "composer.json"), "{ not valid json }");
    const result = new ComposerParser().parse(dir);
    assert.deepEqual(result.packages, []);
    rmSync(dir, { recursive: true });
  });

  it("extracts psr4Map, classmaps, autoFiles from autoload", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "composer-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "acme/app",
      autoload: {
        "psr-4": { "App\\": "app/", "Database\\Factories\\": "database/factories/" },
        classmap: ["database/seeders/"],
        files: ["app/helpers.php"],
      },
      "autoload-dev": {
        "psr-4": { "Tests\\": "tests/" },
        classmap: ["tests/fixtures/"],
        files: ["tests/helpers.php"],
      },
    }));
    const result = new ComposerParser().parse(dir);
    assert.ok("App\\" in result.psr4Map);
    assert.ok("Tests\\" in result.psr4Map);
    assert.ok(result.classmaps.includes("database/seeders/"));
    assert.ok(result.classmaps.includes("tests/fixtures/"));
    assert.ok(result.autoFiles.includes("app/helpers.php"));
    assert.ok(result.autoFiles.includes("tests/helpers.php"));
    rmSync(dir, { recursive: true });
  });

  it("package edges have shape {from, to, type, constraint, resolvedVersion}", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "composer-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "acme/app",
      require: { "laravel/framework": "^10.0" },
    }));
    const result = new ComposerParser().parse(dir);
    const edge = result.packages[0];
    assert.ok("from" in edge);
    assert.ok("to" in edge);
    assert.ok("type" in edge);
    assert.ok("constraint" in edge);
    assert.ok("resolvedVersion" in edge);
    rmSync(dir, { recursive: true });
  });
});
