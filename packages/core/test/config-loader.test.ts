import { test } from "node:test";
import * as assert from "node:assert";
import * as fs from "fs";
import * as path from "path";
import {
  loadConfig,
  readConfig,
  resolveConfig,
  findUnknownRules,
  ConfigError,
  DEFAULT_IGNORE,
} from "../src/config/config-loader";
import { RuleSeverity } from "../src/engine/types";

// Defaults come from the loaded rule sets (core itself knows no rule ids).
const DEFAULTS: Record<string, RuleSeverity> = {
  "gdpr/pii-unhashed-storage": "error",
  "gdpr/minimal-data-collected": "error",
};

void test("Config Loader", async (t) => {
  const testDir = path.join(__dirname, "mock-env");

  await t.test("returns the supplied defaults when no file exists", () => {
    const config = loadConfig(
      "/fake/path/that/does/not/exist",
      undefined,
      DEFAULTS,
    );
    assert.strictEqual(config.rules["gdpr/pii-unhashed-storage"], "error");
    assert.deepStrictEqual(config.ignore, [...DEFAULT_IGNORE]);
    assert.deepStrictEqual(config.plugins, []);
  });

  await t.test("merges user config with defaults", () => {
    // Setup mock directory and file
    fs.mkdirSync(testDir, { recursive: true });
    const mockConfig = { rules: { "gdpr/pii-unhashed-storage": "warn" } };
    fs.writeFileSync(
      path.join(testDir, "compliance.json"),
      JSON.stringify(mockConfig),
    );

    const config = loadConfig(testDir, undefined, DEFAULTS);

    // Should override this specific rule to 'warn'
    assert.strictEqual(config.rules["gdpr/pii-unhashed-storage"], "warn");
    // Should keep the default for missing rules
    assert.strictEqual(config.rules["gdpr/minimal-data-collected"], "error");

    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
  });
});

void test("Config Loader validation", async (t) => {
  const dir = path.join(__dirname, "mock-env-invalid");
  fs.mkdirSync(dir, { recursive: true });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const write = (c: unknown) =>
    fs.writeFileSync(
      path.join(dir, "compliance.json"),
      typeof c === "string" ? c : JSON.stringify(c),
    );

  await t.test("throws on malformed JSON", () => {
    write("{ nope");
    assert.throws(() => loadConfig(dir), ConfigError);
  });

  await t.test("throws on invalid severity and bad ignore type", () => {
    write({ rules: { "gdpr/missing-consent-flag": "loud" } });
    assert.throws(() => loadConfig(dir), ConfigError);
    write({ ignore: "dist" });
    assert.throws(() => loadConfig(dir), ConfigError);
  });

  await t.test("accepts rule ids it has never heard of", () => {
    write({ rules: { "other/thing": "warn" } });
    const config = loadConfig(dir);
    assert.strictEqual(config.rules["other/thing"], "warn");
  });

  await t.test("--config path must exist", () => {
    assert.throws(() => loadConfig(dir, "missing.json"), ConfigError);
  });

  await t.test("a custom ignore list replaces the default one", () => {
    write({ ignore: ["only-this"] });
    assert.deepStrictEqual(loadConfig(dir).ignore, ["only-this"]);
  });
});

void test("Config Loader: plugins key", async (t) => {
  const dir = path.join(__dirname, "mock-env-plugins");
  fs.mkdirSync(dir, { recursive: true });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const write = (c: unknown) =>
    fs.writeFileSync(path.join(dir, "compliance.json"), JSON.stringify(c));

  await t.test("reads a list of plugin specifiers", () => {
    write({ plugins: ["@scope/plugin", "./local.js"] });
    assert.deepStrictEqual(readConfig(dir).plugins, [
      "@scope/plugin",
      "./local.js",
    ]);
  });

  await t.test("defaults to no plugins", () => {
    write({});
    assert.deepStrictEqual(readConfig(dir).plugins, []);
  });

  await t.test("rejects non-arrays, non-strings, blanks and duplicates", () => {
    for (const bad of ["plugin", [1], [""], ["a", "a"]]) {
      write({ plugins: bad });
      assert.throws(() => readConfig(dir), ConfigError, JSON.stringify(bad));
    }
  });
});

void test("resolveConfig and findUnknownRules", () => {
  const config = resolveConfig(
    { rules: { "x/y": "warn" }, plugins: [] },
    { "gdpr/a": "error" },
  );
  assert.deepStrictEqual(config.rules, { "gdpr/a": "error", "x/y": "warn" });
  assert.deepStrictEqual(findUnknownRules(config, ["gdpr/a"]), ["x/y"]);
  assert.deepStrictEqual(findUnknownRules(config, ["gdpr/a", "x/y"]), []);
});
