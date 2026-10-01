// Public plugin API, published as "complinter/plugin-api".
//
// Plugin authors import from here (and list `complinter` as a peer
// dependency) instead of reaching into complinter's internal packages.
// EXPERIMENTAL: this surface may change in minor releases until it is frozen.
export {
  PLUGIN_API_VERSION,
  definePlugin,
  createRuleFactory,
  walkTypedTree,
} from "@complinter/core";
export type {
  Plugin,
  Rule,
  RuleContext,
  RuleSeverity,
  Violation,
  NodeMap,
  Visitors,
  TsNodes,
  AnyRule,
  LanguageAdapter,
  ParseResult,
  SourceComment,
} from "@complinter/core";
export { defineRule } from "@complinter/lang-typescript";
