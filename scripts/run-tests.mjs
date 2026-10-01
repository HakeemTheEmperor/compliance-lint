// Runs every packages/*/test/**/*.test.ts through tsx using node:test.
// Expands the file list itself so it behaves the same on every Node version
// and shell (node:test only gained glob support in Node 21).
//
// Usage: node scripts/run-tests.mjs [test-file ...]
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function collect(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "fixtures") continue;
      collect(full, out);
    } else if (entry.name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
}

let files = process.argv.slice(2);
if (files.length === 0) {
  const packagesDir = path.join(root, "packages");
  for (const pkg of fs.readdirSync(packagesDir)) {
    collect(path.join(packagesDir, pkg, "test"), files);
  }
  files.sort();
}

const result = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--import",
    "tsconfig-paths/register",
    "--test",
    ...files,
  ],
  { cwd: root, stdio: "inherit" },
);

process.exit(result.status ?? 1);
