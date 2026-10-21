import * as fs from "node:fs";
import * as path from "node:path";
import { ComplianceConfig, RuleSeverity } from "../engine/types";

/** Files and folders skipped when the config has no `ignore` of its own. */
export const DEFAULT_IGNORE: readonly string[] = [
  "node_modules",
  "dist",
  "**/*.spec.ts",
  "**/*.test.ts",
  "**/*.spec.tsx",
  "**/*.test.tsx",
  "**/*.spec.js",
  "**/*.test.js",
];

const SEVERITIES: RuleSeverity[] = ["error", "warn", "off"];

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** What the user wrote in compliance.json, validated but not yet merged with defaults. */
export interface UserConfig {
  ignore?: string[];
  rules: Record<string, RuleSeverity>;
  plugins: string[];
}

/**
 * Reads and validates compliance.json. A missing file yields an empty user
 * config; a file that exists but is malformed throws a ConfigError rather than
 * silently weakening the checks.
 */
export function readConfig(
  cwd: string = process.cwd(),
  configFile?: string,
): UserConfig {
  const configPath = configFile
    ? path.resolve(cwd, configFile)
    : path.join(cwd, "compliance.json");

  if (!fs.existsSync(configPath)) {
    if (configFile) throw new ConfigError(`Config file not found: ${configPath}`);
    return { rules: {}, plugins: [] };
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
  const raw = parsed as { ignore?: unknown; rules?: unknown; plugins?: unknown };

  let ignore: string[] | undefined;
  if (raw.ignore !== undefined) {
    if (
      !Array.isArray(raw.ignore) ||
      !raw.ignore.every((p) => typeof p === "string")
    ) {
      throw new ConfigError(`"ignore" in ${configPath} must be an array of strings.`);
    }
    ignore = raw.ignore;
  }

  const rules: Record<string, RuleSeverity> = {};
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
      rules[id] = severity as RuleSeverity;
    }
  }

  let plugins: string[] = [];
  if (raw.plugins !== undefined) {
    if (
      !Array.isArray(raw.plugins) ||
      !raw.plugins.every((p) => typeof p === "string" && p.trim() !== "")
    ) {
      throw new ConfigError(
        `"plugins" in ${configPath} must be an array of non-empty strings.`,
      );
    }
    plugins = raw.plugins as string[];
    const duplicate = plugins.find((p, i) => plugins.indexOf(p) !== i);
    if (duplicate !== undefined) {
      throw new ConfigError(`"plugins" in ${configPath} lists "${duplicate}" twice.`);
    }
  }

  return { ignore, rules, plugins };
}

/**
 * Merges the user's config over the defaults supplied by the rule sets that
 * are loaded. A user-supplied `ignore` list replaces the default one.
 */
export function resolveConfig(
  user: UserConfig,
  defaultRules: Readonly<Record<string, RuleSeverity>> = {},
): ComplianceConfig {
  return {
    ignore: user.ignore ?? [...DEFAULT_IGNORE],
    rules: { ...defaultRules, ...user.rules },
    plugins: user.plugins,
  };
}

/** Reads the config file and merges it over `defaultRules`. */
export function loadConfig(
  cwd: string = process.cwd(),
  configFile?: string,
  defaultRules: Readonly<Record<string, RuleSeverity>> = {},
): ComplianceConfig {
  return resolveConfig(readConfig(cwd, configFile), defaultRules);
}

/** Rule ids named in the config that no loaded rule provides. */
export function findUnknownRules(
  config: ComplianceConfig,
  knownRuleIds: Iterable<string>,
): string[] {
  const known = new Set(knownRuleIds);
  return Object.keys(config.rules).filter((id) => !known.has(id));
}
