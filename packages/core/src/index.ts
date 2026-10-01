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
  ConfigError,
  DEFAULT_CONFIG,
} from "./config/config-loader";
export { reportToConsole } from "./reporters/console";
export type { FileReport } from "./reporters/console";
export { formatJson } from "./reporters/json";
export { formatSarif } from "./reporters/sarif";
