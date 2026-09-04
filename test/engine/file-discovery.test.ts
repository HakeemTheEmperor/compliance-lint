import { test } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getFiles } from "@/src/engine/file-discovery";

void test("File discovery", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "compliance-lint-"));

  try {
    fs.mkdirSync(path.join(rootDir, "nested"));
    fs.mkdirSync(path.join(rootDir, "node_modules"));
    fs.writeFileSync(path.join(rootDir, "included.ts"), "");
    fs.writeFileSync(path.join(rootDir, "nested", "ignored.test.ts"), "");
    fs.writeFileSync(path.join(rootDir, "nested", "included.ts"), "");
    fs.writeFileSync(path.join(rootDir, "node_modules", "dependency.ts"), "");

    const files = getFiles(rootDir, ["node_modules", "**/*.test.ts"]);

    assert.deepStrictEqual(
      files.sort(),
      [
        path.join(rootDir, "included.ts"),
        path.join(rootDir, "nested", "included.ts"),
      ].sort(),
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
