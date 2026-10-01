import { test } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { LinterCache } from "@/src/engine/cache";

void test("LinterCache is invalidated when the fingerprint changes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "complint-cache-"));
  const file = path.join(dir, "cache.json");
  try {
    const a = new LinterCache(file, "config-a");
    a.setCachedViolations("f.ts", "x", []);
    a.saveCache();

    assert.deepStrictEqual(
      new LinterCache(file, "config-a").getCachedViolations("f.ts", "x"),
      [],
    );
    assert.strictEqual(
      new LinterCache(file, "config-b").getCachedViolations("f.ts", "x"),
      null,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
