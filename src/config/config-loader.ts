import * as fs from "fs";
import * as path from "path";
import { ComplianceConfig } from "../engine/types";

const DEFAULT_CONFIG: ComplianceConfig = {
  ignore: ["node_modules", "dist", "**/*.spec.ts", "**/*.test.ts"],
  rules: {
    "gdpr/pii-unhashed-storage": "error",
    "gdpr/minimal-data-collected": "error",
    "gdpr/data-retention-missing": "warn",
    "gdpr/explicit-pii-logging": "error",
  },
};

export function loadConfig(cwd: string = process.cwd()): ComplianceConfig {
  const configPath = path.join(cwd, "compliance.json");

  if (fs.existsSync(configPath)) {
    try {
      const fileContent = fs.readFileSync(configPath, "utf-8");
      const parsedConfig = JSON.parse(fileContent) as Partial<ComplianceConfig>;

      // Merge with defaults to ensure we always have a valid config object
      return {
        ignore: parsedConfig.ignore || DEFAULT_CONFIG.ignore,
        rules: { ...DEFAULT_CONFIG.rules, ...parsedConfig.rules },
      };
    } catch {
      console.warn(
        `[Warning] Failed to parse compliance.json. Using default configurations.`,
      );
      return DEFAULT_CONFIG;
    }
  }

  return DEFAULT_CONFIG;
}
