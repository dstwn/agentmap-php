import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// ComposerParser — covers CMP-01, CMP-02, CMP-03, LEG-01
// ---------------------------------------------------------------------------
describe("ComposerParser", () => {
  it("parses require edges", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "cmp-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "acme/app",
      require: { "laravel/framework": "^10.0" },
    }));
    const result = new ComposerParser().parse(dir);
    assert.ok(result.packages.some(p => p.type === "require" && p.to === "laravel/framework"));
    rmSync(dir, { recursive: true });
  });

  it("parses require-dev edges", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "cmp-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "acme/app",
      "require-dev": { "phpunit/phpunit": "^10.0" },
    }));
    const result = new ComposerParser().parse(dir);
    assert.ok(result.packages.some(p => p.type === "require-dev" && p.to === "phpunit/phpunit"));
    rmSync(dir, { recursive: true });
  });

  it("parses all 6 link types", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "cmp-test-"));
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

  it("constraint is raw string", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "cmp-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "acme/app",
      require: { "laravel/framework": "^10.0" },
    }));
    const result = new ComposerParser().parse(dir);
    const edge = result.packages.find(p => p.to === "laravel/framework");
    assert.equal(edge.constraint, "^10.0");
    rmSync(dir, { recursive: true });
  });

  it("merges lock resolved versions from packages", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "cmp-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "acme/app",
      require: { "laravel/framework": "^10.0" },
    }));
    writeFileSync(join(dir, "composer.lock"), JSON.stringify({
      packages: [{ name: "laravel/framework", version: "10.48.22" }],
      "packages-dev": [],
    }));
    const result = new ComposerParser().parse(dir);
    const edge = result.packages.find(p => p.to === "laravel/framework");
    assert.equal(edge.resolvedVersion, "10.48.22");
    rmSync(dir, { recursive: true });
  });

  it("merges lock resolved versions from packages-dev", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "cmp-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "acme/app",
      "require-dev": { "phpunit/phpunit": "^10.0" },
    }));
    writeFileSync(join(dir, "composer.lock"), JSON.stringify({
      packages: [],
      "packages-dev": [{ name: "phpunit/phpunit", version: "10.5.20" }],
    }));
    const result = new ComposerParser().parse(dir);
    const edge = result.packages.find(p => p.to === "phpunit/phpunit");
    assert.equal(edge.resolvedVersion, "10.5.20");
    rmSync(dir, { recursive: true });
  });

  it("missing composer.json returns empty result", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "cmp-test-"));
    const result = new ComposerParser().parse(dir);
    assert.deepEqual(result.packages, []);
    rmSync(dir, { recursive: true });
  });

  it("corrupt composer.json returns empty result", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "cmp-test-"));
    writeFileSync(join(dir, "composer.json"), "{invalid");
    const result = new ComposerParser().parse(dir);
    assert.deepEqual(result.packages, []);
    rmSync(dir, { recursive: true });
  });

  it("autoload psr4Map extracted", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "cmp-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "acme/app",
      autoload: { "psr-4": { "App\\": "app/" } },
    }));
    const result = new ComposerParser().parse(dir);
    assert.ok("App\\" in result.psr4Map);
    assert.equal(result.psr4Map["App\\"], "app/");
    rmSync(dir, { recursive: true });
  });

  it("autoload classmap extracted", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "cmp-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "acme/app",
      autoload: { classmap: ["database/seeders/"] },
    }));
    const result = new ComposerParser().parse(dir);
    assert.ok(result.classmaps.includes("database/seeders/"));
    rmSync(dir, { recursive: true });
  });

  it("autoload files extracted", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "cmp-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "acme/app",
      autoload: { files: ["app/helpers.php"] },
    }));
    const result = new ComposerParser().parse(dir);
    assert.ok(result.autoFiles.includes("app/helpers.php"));
    rmSync(dir, { recursive: true });
  });

  it("autoload-dev classmap extracted", async () => {
    const { ComposerParser } = await import("../src/Core/ComposerParser.mjs");
    const dir = mkdtempSync(join(tmpdir(), "cmp-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      name: "acme/app",
      "autoload-dev": { classmap: ["tests/fixtures/"] },
    }));
    const result = new ComposerParser().parse(dir);
    assert.ok(result.classmaps.includes("tests/fixtures/"));
    rmSync(dir, { recursive: true });
  });
});

// ---------------------------------------------------------------------------
// PSR4Resolver — covers PSR4Resolver utility (Phase 14 consumer)
// ---------------------------------------------------------------------------
describe("PSR4Resolver", () => {
  it("resolves FQCN to file path when file exists", async () => {
    const { PSR4Resolver } = await import("../src/Core/PSR4Resolver.mjs");
    const dir = mkdtempSync(join(tmpdir(), "psr4-test-"));
    mkdirSync(join(dir, "app", "Http", "Controllers"), { recursive: true });
    writeFileSync(join(dir, "app", "Http", "Controllers", "UserController.php"), "<?php class UserController {}");
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
      "App\\Http\\Controllers\\MissingController",
      dir,
      { "App\\": "app/" }
    );
    assert.equal(result, null);
    rmSync(dir, { recursive: true });
  });

  it("returns null for empty psr4Map", async () => {
    const { PSR4Resolver } = await import("../src/Core/PSR4Resolver.mjs");
    const dir = mkdtempSync(join(tmpdir(), "psr4-test-"));
    const result = new PSR4Resolver().resolve("App\\Foo", dir, {});
    assert.equal(result, null);
    rmSync(dir, { recursive: true });
  });

  it("handles array-valued psr4 dirs", async () => {
    const { PSR4Resolver } = await import("../src/Core/PSR4Resolver.mjs");
    const dir = mkdtempSync(join(tmpdir(), "psr4-test-"));
    mkdirSync(join(dir, "app", "Models"), { recursive: true });
    writeFileSync(join(dir, "app", "Models", "User.php"), "<?php class User {}");
    const result = new PSR4Resolver().resolve(
      "App\\Models\\User",
      dir,
      { "App\\": ["src/", "app/"] }
    );
    assert.equal(result, join(dir, "app", "Models", "User.php"));
    rmSync(dir, { recursive: true });
  });
});

// ---------------------------------------------------------------------------
// LegacyDetector — covers LEG-02
// ---------------------------------------------------------------------------
describe("LegacyDetector", () => {
  it("flags legacy dir that exists without psr-4 coverage", async () => {
    const { LegacyDetector } = await import("../src/Core/LegacyDetector.mjs");
    const dir = mkdtempSync(join(tmpdir(), "leg-test-"));
    mkdirSync(join(dir, "lib"));
    const warnings = new LegacyDetector().detect(dir, {}, [], []);
    assert.ok(warnings.some(w => w.type === "legacy-dir" && w.directory === "lib/"));
    rmSync(dir, { recursive: true });
  });

  it("does not flag psr-4-covered src dir", async () => {
    const { LegacyDetector } = await import("../src/Core/LegacyDetector.mjs");
    const dir = mkdtempSync(join(tmpdir(), "leg-test-"));
    mkdirSync(join(dir, "src"));
    const warnings = new LegacyDetector().detect(dir, { "App\\": "src/" }, [], []);
    assert.ok(!warnings.some(w => w.type === "legacy-dir" && w.directory === "src/"));
    rmSync(dir, { recursive: true });
  });

  it("reports classmap entries", async () => {
    const { LegacyDetector } = await import("../src/Core/LegacyDetector.mjs");
    const dir = mkdtempSync(join(tmpdir(), "leg-test-"));
    const warnings = new LegacyDetector().detect(dir, {}, ["database/seeders/"], []);
    assert.ok(warnings.some(w => w.type === "classmap" && w.entry === "database/seeders/"));
    rmSync(dir, { recursive: true });
  });

  it("reports autoload files entries", async () => {
    const { LegacyDetector } = await import("../src/Core/LegacyDetector.mjs");
    const dir = mkdtempSync(join(tmpdir(), "leg-test-"));
    const warnings = new LegacyDetector().detect(dir, {}, [], ["app/helpers.php"]);
    assert.ok(warnings.some(w => w.type === "autoload-file" && w.entry === "app/helpers.php"));
    rmSync(dir, { recursive: true });
  });

  it("skips vendor entries in classmap", async () => {
    const { LegacyDetector } = await import("../src/Core/LegacyDetector.mjs");
    const dir = mkdtempSync(join(tmpdir(), "leg-test-"));
    const warnings = new LegacyDetector().detect(dir, {}, ["vendor/some/lib/"], []);
    assert.deepEqual(warnings, []);
    rmSync(dir, { recursive: true });
  });

  it("returns empty array when nothing flagged", async () => {
    const { LegacyDetector } = await import("../src/Core/LegacyDetector.mjs");
    // tmpdir with no LEGACY_DIRS subdirs, no classmaps, no autoFiles
    const dir = mkdtempSync(join(tmpdir(), "leg-test-"));
    const warnings = new LegacyDetector().detect(dir, {}, [], []);
    assert.deepEqual(warnings, []);
    rmSync(dir, { recursive: true });
  });
});
