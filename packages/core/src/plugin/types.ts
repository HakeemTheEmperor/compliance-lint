import type { AnyAdapter, AnyRule } from "../engine/language";
import type { RuleSeverity } from "../engine/types";

/**
 * Generation of the plugin API this core understands. A plugin states the
 * version it was written for; any other value is rejected. The API is
 * experimental until v1 and this number is bumped on every breaking change.
 */
export const PLUGIN_API_VERSION = 1;

/** A bundle of rules (and optionally language adapters) loaded into the engine. */
export interface Plugin {
  /** Human-readable name, usually the package name. */
  name: string;
  /** Optional version; read from package.json for npm plugins when omitted. */
  version?: string;
  /** Must equal PLUGIN_API_VERSION of the running core. */
  apiVersion: number;
  /** Prefix of every rule id this plugin provides, e.g. "nestjs". */
  namespace: string;
  rules: readonly AnyRule[];
  /** Language adapters this plugin adds (their ids must be unique). */
  adapters?: readonly AnyAdapter[];
  /** Severity for each rule when the user's config does not say; default is "error". */
  defaultSeverities?: Readonly<Record<string, RuleSeverity>>;
}

/** Identity helper that gives plugin authors type checking. */
export function definePlugin(plugin: Plugin): Plugin {
  return plugin;
}

/** A plugin could not be found, loaded, or failed validation. */
export class PluginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginError";
  }
}

/** A plugin plus how it was loaded, used for caching and diagnostics. */
export interface LoadedPlugin {
  plugin: Plugin;
  /** The specifier from the config, or "builtin". */
  spec: string;
  /** Plugin version (declared, from package.json, or "unknown"). */
  version: string;
  /** Content hash of the entry file for local (./) plugins. */
  contentHash?: string;
}
