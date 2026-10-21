// Public entry point of @complinter/core. Everything other packages may use
// is exported from here; deep imports into this package's files are not part
// of the supported surface.
export type {
  Rule,
  RuleContext,
  Violation,
  RuleSeverity,
  ComplianceConfig,
} from "./engine/types";
export { EngineRunner } from "./engine/runner";
export { LinterCache, hashContent } from "./engine/cache";
export { getFiles, SOURCE_EXTENSIONS } from "./engine/file-discovery";
export { applySuppressions } from "./engine/suppress";
export {
  loadConfig,
  readConfig,
  resolveConfig,
  findUnknownRules,
  ConfigError,
  DEFAULT_IGNORE,
} from "./config/config-loader";
export type { UserConfig } from "./config/config-loader";
export { reportToConsole } from "./reporters/console";
export type { FileReport } from "./reporters/console";
export { formatJson } from "./reporters/json";
export { formatSarif } from "./reporters/sarif";
export type {
  NodeMap,
  Visitors,
  TsNodes,
} from "./engine/types";
export { DEFAULT_LANGUAGE } from "./engine/types";
export type {
  LanguageAdapter,
  AnyAdapter,
  AnyRule,
  ParseResult,
  SourceComment,
} from "./engine/language";
export {
  assertLanguagesRegistered,
  createRuleFactory,
  eraseAdapter,
} from "./engine/language";
export { walkTypedTree } from "./engine/walk";
export { PLUGIN_API_VERSION, definePlugin, PluginError } from "./plugin/types";
export type { Plugin, LoadedPlugin } from "./plugin/types";
export { validatePlugin } from "./plugin/validate";
export {
  loadPlugins,
  assemblePlugins,
  classifyPluginSpec,
} from "./plugin/loader";
export type { AssembledPlugins, PluginSpec } from "./plugin/loader";
export { createCacheFingerprint } from "./plugin/fingerprint";
export type { FingerprintInput } from "./plugin/fingerprint";
