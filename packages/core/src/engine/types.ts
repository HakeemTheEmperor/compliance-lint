import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/typescript-estree";

export interface Violation {
  ruleId: string;
  message: string;
  line: number;
  column: number;
  severity: "error" | "warn";
}

export interface RuleContext {
  report(violation: Omit<Violation, "ruleId" | "severity">): void;
  /** Path of the file being analysed (empty when a bare AST is run). */
  filename: string;
  /** Full text of the file being analysed (empty when a bare AST is run). */
  sourceText: string;
}

/** A language's node vocabulary: node-type name -> node shape. */
export type NodeMap = { [type: string]: object };

/** Visitor map derived from a node vocabulary. */
export type Visitors<N extends NodeMap> = {
  [K in keyof N]?: (node: N[K]) => void;
};

/** The TypeScript/ESTree vocabulary, derived from the parser's own types. */
export type TsNodes = {
  [K in AST_NODE_TYPES]: Extract<TSESTree.Node, { type: K }>;
};

/** Language a rule targets when it does not say (keeps existing rules unchanged). */
export const DEFAULT_LANGUAGE = "typescript";

export interface Rule<N extends NodeMap = TsNodes> {
  id: string;
  description: string;
  /** Id of the language adapter this rule runs on. Defaults to "typescript". */
  language?: string;
  create(context: RuleContext): Visitors<N>;
}

export type RuleSeverity = "error" | "warn" | "off";

export interface ComplianceConfig {
  ignore: string[];
  rules: Record<string, RuleSeverity>;
  /** Plugins to load, as written in compliance.json. */
  plugins?: string[];
}
