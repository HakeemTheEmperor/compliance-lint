import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { Rule } from "@/src/engine/types";
import { FileReport } from "./console";

/** SARIF 2.1.0 report for GitHub code scanning and similar tools. */
export function formatSarif(
  reports: FileReport[],
  rules: Rule[],
  version: string,
): { output: string; hasErrors: boolean } {
  let hasErrors = false;

  const results = reports.flatMap((report) =>
    report.violations.map((v) => {
      if (v.severity === "error") hasErrors = true;
      return {
        ruleId: v.ruleId,
        level: v.severity === "error" ? "error" : "warning",
        message: { text: v.message },
        locations: [
          {
            physicalLocation: {
              artifactLocation: {
                uri: pathToFileURL(path.resolve(report.filePath)).href,
              },
              region: {
                startLine: Math.max(v.line, 1),
                startColumn: v.column + 1, // SARIF columns are 1-based
              },
            },
          },
        ],
      };
    }),
  );

  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "complinter",
            version,
            rules: rules.map((r) => ({
              id: r.id,
              shortDescription: { text: r.description },
            })),
          },
        },
        results,
      },
    ],
  };

  return { output: JSON.stringify(sarif, null, 2), hasErrors };
}
