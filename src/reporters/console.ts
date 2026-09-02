import * as path from "node:path";
import { Violation, ComplianceConfig, RuleSeverity } from "@/src/engine/types";

export interface FileReport {
  filePath: string;
  violations: Violation[];
}

export function reportToConsole(
  reports: FileReport[],
  config?: ComplianceConfig,
): boolean {
  let totalErrors = 0;
  let totalWarnings = 0;

  reports.forEach((report) => {
    if (report.violations.length === 0) return;

    console.log(`\n\x1b[4m${path.resolve(report.filePath)}\x1b[0m`);

    report.violations.forEach((v) => {
      const configuredSeverity: RuleSeverity =
        config?.rules[v.ruleId] ?? "error";

      if (configuredSeverity === "off") return;

      const isError = configuredSeverity === "error";
      if (isError) totalErrors++;
      else totalWarnings++;

      const severityLabel = isError
        ? "\x1b[31merror\x1b[0m"
        : "\x1b[33mwarn\x1b[0m";

      const location = `  ${v.line}:${v.column}`;
      const message = v.message;
      const ruleId = `\x1b[2m${v.ruleId}\x1b[0m`;

      console.log(
        `${location.padEnd(10)} ${severityLabel.padEnd(12)} ${message}  ${ruleId}`,
      );
    });
  });

  const totalProblems = totalErrors + totalWarnings;
  console.log(
    `\n\x1b[1m✖ ${totalProblems} problems (${totalErrors} errors, ${totalWarnings} warnings)\x1b[0m\n`,
  );

  return totalErrors > 0;
}
