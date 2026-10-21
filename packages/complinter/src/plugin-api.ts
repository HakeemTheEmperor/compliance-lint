// Public plugin API, published as "complinter/plugin-api".
//
// Plugin authors import from here (and list `complinter` as a peer
// dependency) instead of reaching into complinter's internal packages.
// EXPERIMENTAL: this surface may change in minor releases until it is frozen.
import {
  EngineRunner,
  eraseAdapter,
  type AnyRule,
  type Plugin,
  type RuleSeverity,
  type Violation,
} from "@complinter/core";
import { typescriptAdapter } from "@complinter/lang-typescript";

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

// The AST vocabulary the TypeScript rules are written against, re-exported so
// plugins use exactly the parser version the engine does.
export { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/typescript-estree";

export interface LintTextOptions {
  /** File name used to pick the language and passed to rules. Default "file.ts". */
  filename?: string;
  /** Severity per rule id, as in compliance.json. */
  severities?: Record<string, RuleSeverity>;
}

/**
 * Testing helper: runs rules (or a whole plugin) over a source string with the
 * real engine and returns the violations, after inline suppressions. Parse
 * errors are thrown.
 */
export function lintText(
  rules: Plugin | readonly AnyRule[],
  source: string,
  options: LintTextOptions = {},
): Violation[] {
  const list = "rules" in rules ? rules.rules : rules;
  const runner = new EngineRunner(list, options.severities ?? {}, [
    eraseAdapter(typescriptAdapter),
  ]);
  return runner.lintSource(source, options.filename ?? "file.ts");
}
