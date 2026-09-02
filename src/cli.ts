#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "@typescript-eslint/typescript-estree";
import { EngineRunner } from "@/src/engine/runner";
import { allRules } from "@/src/rules";
import { reportToConsole, FileReport } from "@/src/reporters/console";
import { LinterCache } from "@/src/engine/cache";

function getFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name !== "node_modules" &&
        entry.name !== "dist" &&
        entry.name !== ".git"
      ) {
        files = files.concat(getFiles(fullPath));
      }
    } else if (entry.isFile() && fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

function runCli(): void {
  const args = process.argv.slice(2);
  const targetDir = args[0] || "src";

  const files = getFiles(targetDir);
  const runner = new EngineRunner(allRules);
  const cache = new LinterCache();
  const reports: FileReport[] = [];

  for (const file of files) {
    const code = fs.readFileSync(file, "utf-8");

    const cachedViolations = cache.getCachedViolations(file, code);
    if (cachedViolations) {
      reports.push({ filePath: file, violations: cachedViolations });
      continue;
    }

    try {
      const ast = parse(code, { loc: true, jsx: true });
      const violations = runner.run(ast);

      cache.setCachedViolations(file, code, violations);
      reports.push({ filePath: file, violations });
    } catch (err) {
      console.error(`Failed to parse file: ${file}`, err);
    }
  }

  cache.saveCache();

  const hasErrors = reportToConsole(reports);
  process.exit(hasErrors ? 1 : 0);
}

runCli();
