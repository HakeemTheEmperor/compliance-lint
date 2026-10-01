import * as fs from "node:fs";
import * as path from "node:path";
import { ComplianceConfig, RuleSeverity } from "../engine/types";

export const DEFAULT_CONFIG: ComplianceConfig = {
  ignore: [
    "node_modules",
    "dist",
    "**/*.spec.ts",
    "**/*.test.ts",
    "**/*.spec.tsx",
    "**/*.test.tsx",
    "**/*.spec.js",
    "**/*.test.js",
  ],
  rules: {
    "gdpr/pii-unhashed-storage": "error",
    "gdpr/minimal-data-collected": "error",
    "gdpr/data-retention-missing": "warn",
    "gdpr/explicit-pii-logging": "error",
    "gdpr/overly-broad-select": "warn",
    "gdpr/missing-consent-flag": "error",
    "gdpr/missing-erasure-cascade": "error",
    "gdpr/third-party-pii-leak": "error",
    "gdpr/unencrypted-pii-column": "error",
    "gdpr/unprotected-export-route": "error",
  },
};

const SEVERITIES: RuleSeverity[] = ["error", "warn", "off"];

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Loads and validates the config. A missing file yields the defaults; a file
 * that exists but is malformed throws a ConfigError rather than silently
 * weakening the checks. Unknown rule ids are reported via `warn` (they may
 * belong to a rule set that is not installed).
 *
 * A user-supplied `ignore` list replaces the default one.
 */
export function loadConfig(
  cwd: string = process.cwd(),
  configFile?: string,
  warn: (message: string) => void = console.warn,
): ComplianceConfig {
  const configPath = configFile
    ? path.resolve(cwd, configFile)
    : path.join(cwd, "compliance.json");

  if (!fs.existsSync(configPath)) {
    if (configFile) throw new ConfigError(`Config file not found: ${configPath}`);
    return { ...DEFAULT_CONFIG, rules: { ...DEFAULT_CONFIG.rules } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (err) {
    throw new ConfigError(
      `Failed to parse ${configPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConfigError(`${configPath} must contain a JSON object.`);
  }
  const raw = parsed as { ignore?: unknown; rules?: unknown };

  let ignore = DEFAULT_CONFIG.ignore;
  if (raw.ignore !== undefined) {
    if (
      !Array.isArray(raw.ignore) ||
      !raw.ignore.every((p) => typeof p === "string")
    ) {
      throw new ConfigError(`"ignore" in ${configPath} must be an array of strings.`);
    }
    ignore = raw.ignore;
  }

  const rules: Record<string, RuleSeverity> = { ...DEFAULT_CONFIG.rules };
  if (raw.rules !== undefined) {
    if (!raw.rules || typeof raw.rules !== "object" || Array.isArray(raw.rules)) {
      throw new ConfigError(`"rules" in ${configPath} must be an object.`);
    }
    for (const [id, severity] of Object.entries(raw.rules)) {
      if (!SEVERITIES.includes(severity as RuleSeverity)) {
        throw new ConfigError(
          `Invalid severity ${JSON.stringify(severity)} for rule "${id}" in ${configPath}. Use "error", "warn" or "off".`,
        );
      }
      if (!(id in DEFAULT_CONFIG.rules)) {
        warn(`[Warning] Unknown rule "${id}" in ${configPath}.`);
      }
      rules[id] = severity as RuleSeverity;
    }
  }

  return { ignore, rules };
}
