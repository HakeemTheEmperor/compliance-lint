#!/usr/bin/env node

import * as fs from "node:fs";
import { parse } from "@typescript-eslint/typescript-estree";
import { EngineRunner } from "./engine/runner";
import { getFiles } from "./engine/file-discovery";
import { allRules } from "./rules";
import { reportToConsole, FileReport } from "./reporters/console";
import { LinterCache } from "./engine/cache";
import { loadConfig } from "./config/config-loader";

function runCli(): void {
  const args = process.argv.slice(2);
  const targetDir = args[0] || "src";

  const config = loadConfig(process.cwd());

  const files = getFiles(targetDir, config.ignore);
  const runner = new EngineRunner(allRules, config.rules);
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

  const hasErrors = reportToConsole(reports, config);
  process.exit(hasErrors ? 1 : 0);
}

runCli();
