import * as path from "node:path";
import { Violation, ComplianceConfig } from "../engine/types";

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
    const visible = report.violations.filter(
      (v) => config?.rules[v.ruleId] !== "off",
    );
    if (visible.length === 0) return;

    console.log(`\n\x1b[4m${path.resolve(report.filePath)}\x1b[0m`);

    visible.forEach((v) => {
      const isError = v.severity === "error";
      if (isError) totalErrors++;
      else totalWarnings++;

      const severityLabel = isError
        ? "\x1b[31merror\x1b[0m"
        : "\x1b[33mwarn\x1b[0m";

      const location = `  ${v.line}:${v.column}`;
      const ruleId = `\x1b[2m${v.ruleId}\x1b[0m`;

      console.log(
        `${location.padEnd(10)} ${severityLabel.padEnd(12)} ${v.message}  ${ruleId}`,
      );
    });
  });

  const totalProblems = totalErrors + totalWarnings;
  console.log(
    `\n\x1b[1m✖ ${totalProblems} problems (${totalErrors} errors, ${totalWarnings} warnings)\x1b[0m\n`,
  );

  return totalErrors > 0;
}
