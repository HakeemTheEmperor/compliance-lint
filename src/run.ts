import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { EngineRunner } from "./engine/runner";
import { getFiles } from "./engine/file-discovery";
import { parseSource } from "./engine/parse-file";
import { applySuppressions } from "./engine/suppress";
import { allRules } from "./rules";
import { reportToConsole, FileReport } from "./reporters/console";
import { formatJson } from "./reporters/json";
import { formatSarif } from "./reporters/sarif";
import { LinterCache, hashContent } from "./engine/cache";
import { loadConfig, ConfigError } from "./config/config-loader";
import { getVersion } from "./version";

const HELP = `complint - static analysis for privacy/compliance risks

Usage: complint [options] [directory]

Arguments:
  directory            Directory to scan (default: "src")

Options:
  -c, --config <file>  Path to a config file (default: ./compliance.json)
  -f, --format <fmt>   Output format: console | json | sarif (default: console)
      --no-cache       Do not read or write the result cache
  -h, --help           Show this help
  -v, --version        Show the version

Exit codes:
  0  no errors found (warnings do not fail the run)
  1  one or more error-level violations
  2  usage, config, or file errors (e.g. a file could not be parsed)
`;

export const EXIT_OK = 0;
export const EXIT_VIOLATIONS = 1;
export const EXIT_FAILURE = 2;

export function runCli(argv: string[], cwd: string = process.cwd()): number {
  let values;
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        config: { type: "string", short: "c" },
        format: { type: "string", short: "f", default: "console" },
        "no-cache": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
        version: { type: "boolean", short: "v", default: false },
      },
    }));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error('Run "complint --help" for usage.');
    return EXIT_FAILURE;
  }

  if (values.help) {
    console.log(HELP);
    return EXIT_OK;
  }
  if (values.version) {
    console.log(getVersion());
    return EXIT_OK;
  }

  const format = values.format;
  if (!["console", "json", "sarif"].includes(format)) {
    console.error(`Unknown format "${format}". Use console, json or sarif.`);
    return EXIT_FAILURE;
  }

  const targetDir = positionals[0] || "src";
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    console.error(`Target directory not found: ${path.resolve(cwd, targetDir)}`);
    return EXIT_FAILURE;
  }

  let config;
  try {
    config = loadConfig(cwd, values.config);
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      return EXIT_FAILURE;
    }
    throw err;
  }

  const files = getFiles(targetDir, config.ignore);
  const runner = new EngineRunner(allRules, config.rules);
  const cache = values["no-cache"]
    ? null
    : new LinterCache(
        path.join(cwd, ".gdpr-cache.json"),
        hashContent(
          JSON.stringify({
            version: getVersion(),
            rules: allRules.map((r) => r.id),
            config: config.rules,
          }),
        ),
      );
  const reports: FileReport[] = [];
  let failedFiles = 0;

  for (const file of files) {
    let code: string;
    try {
      code = fs.readFileSync(file, "utf-8");
    } catch (err) {
      console.error(`Failed to read file: ${file}`, err);
      failedFiles++;
      continue;
    }

    const cached = cache?.getCachedViolations(file, code);
    if (cached) {
      reports.push({ filePath: file, violations: cached });
      continue;
    }

    try {
      const { ast, comments } = parseSource(code, file);
      const violations = applySuppressions(runner.run(ast), comments);

      cache?.setCachedViolations(file, code, violations);
      reports.push({ filePath: file, violations });
    } catch (err) {
      console.error(`Failed to parse file: ${file}`, err);
      failedFiles++;
    }
  }

  cache?.saveCache();

  let hasErrors: boolean;
  if (format === "json") {
    const result = formatJson(reports);
    console.log(result.output);
    hasErrors = result.hasErrors;
  } else if (format === "sarif") {
    const result = formatSarif(reports, allRules, getVersion());
    console.log(result.output);
    hasErrors = result.hasErrors;
  } else {
    hasErrors = reportToConsole(reports, config);
  }

  if (failedFiles > 0) {
    console.error(`${failedFiles} file(s) could not be analysed.`);
    return EXIT_FAILURE;
  }
  return hasErrors ? EXIT_VIOLATIONS : EXIT_OK;
}
