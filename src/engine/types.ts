import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/typescript-estree";

export interface Violation {
  ruleId: string;
  message: string;
  line: number;
  column: number;
}

export interface RuleContext {
  report(violation: Omit<Violation, "ruleId">): void;
}

export interface Rule {
  id: string;
  description: string;
  create(context: RuleContext): {
    [K in AST_NODE_TYPES]?: (node: Extract<TSESTree.Node, { type: K }>) => void;
  };
}

export type RuleSeverity = "error" | "warn" | "off";

export interface ComplianceConfig {
  ignore: string[];
  rules: Record<string, RuleSeverity>;
}
