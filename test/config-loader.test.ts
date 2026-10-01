import { test } from "node:test";
import * as assert from "node:assert";
import * as fs from "fs";
import * as path from "path";
import { loadConfig, ConfigError } from "@/src/config/config-loader";

void test("Config Loader", async (t) => {
  const testDir = path.join(__dirname, "mock-env");

  await t.test("returns default config when no file exists", () => {
    const config = loadConfig("/fake/path/that/does/not/exist");
    assert.strictEqual(config.rules["gdpr/pii-unhashed-storage"], "error");
  });

  await t.test("merges user config with defaults", () => {
    // Setup mock directory and file
    fs.mkdirSync(testDir, { recursive: true });
    const mockConfig = { rules: { "gdpr/pii-unhashed-storage": "warn" } };
    fs.writeFileSync(
      path.join(testDir, "compliance.json"),
      JSON.stringify(mockConfig),
    );

    const config = loadConfig(testDir);

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

  await t.test("warns about unknown rule ids but still loads", () => {
    write({ rules: { "other/thing": "warn" } });
    const warnings: string[] = [];
    const config = loadConfig(dir, undefined, (m) => warnings.push(m));
    assert.strictEqual(config.rules["other/thing"], "warn");
    assert.strictEqual(warnings.length, 1);
  });

  await t.test("--config path must exist", () => {
    assert.throws(() => loadConfig(dir, "missing.json"), ConfigError);
  });
});
