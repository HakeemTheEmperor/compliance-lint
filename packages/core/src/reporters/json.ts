import * as path from "node:path";
import { FileReport } from "./console";

/** Machine-readable report. Returns true when any error-level violation exists. */
export function formatJson(reports: FileReport[]): {
  output: string;
  hasErrors: boolean;
} {
  let errorCount = 0;
  let warningCount = 0;

  const results = reports
    .filter((r) => r.violations.length > 0)
    .map((r) => {
      for (const v of r.violations) {
        if (v.severity === "error") errorCount++;
        else warningCount++;
      }
      return { filePath: path.resolve(r.filePath), messages: r.violations };
    });

  return {
    output: JSON.stringify({ results, errorCount, warningCount }, null, 2),
    hasErrors: errorCount > 0,
  };
}
