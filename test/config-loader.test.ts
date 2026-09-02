import { test } from "node:test";
import * as assert from "node:assert";
import * as fs from "fs";
import * as path from "path";
import { loadConfig } from "@/src/config/config-loader";

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
