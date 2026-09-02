import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule, Violation } from "./types";

export class EngineRunner {
  private rules: Rule[];
  private violations: Violation[] = [];

  constructor(rules: Rule[]) {
    this.rules = rules;
  }

  run(ast: TSESTree.Program): Violation[] {
    this.violations = [];
    this.walk(ast);
    return this.violations;
  }

  private walk(node: unknown) {
    if (!node || typeof node !== "object") return;

    // Type guard: Check if this object is an AST Node
    const isAstNode = "type" in node && typeof node.type === "string";

    if (isAstNode) {
      const astNode = node as TSESTree.Node;

      this.rules.forEach((rule) => {
        const context = {
          report: (violation: Omit<Violation, "ruleId">) => {
            this.violations.push({
              ruleId: rule.id,
              ...violation,
            });
          },
        };

        const visitors = rule.create(context);
        const visitor = visitors[astNode.type as AST_NODE_TYPES];

        if (visitor) {
          // Execute the visitor. We assert the function signature internally.
          (visitor as (n: TSESTree.Node) => void)(astNode);
        }
      });
    }

    // Recursively traverse child properties
    for (const key in node) {
      if (key === "parent" || key === "loc" || key === "range") continue;

      const child = (node as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        child.forEach((c) => this.walk(c));
      } else if (child && typeof child === "object") {
        this.walk(child);
      }
    }
  }
}
