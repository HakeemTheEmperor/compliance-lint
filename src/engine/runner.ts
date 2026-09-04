import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule, Violation } from "./types";

export class EngineRunner {
  private rules: Rule[];
  private violations: Violation[] = [];
  private ruleConfig: Record<string, string>;

  constructor(rules: Rule[], ruleConfig: Record<string, string> = {}) {
    this.rules = rules.filter((rule) => {
      const severity = ruleConfig[rule.id];
      return severity !== "off";
    });
    this.ruleConfig = ruleConfig;
  }

  run(ast: TSESTree.Program): Violation[] {
    this.violations = [];
    this.walk(ast);
    return this.violations;
  }

  private walk(node: unknown, parentNode: TSESTree.Node | null = null) {
    if (!node || typeof node !== "object") return;

    const isAstNode = "type" in node && typeof node.type === "string";

    if (isAstNode) {
      const astNode = node as TSESTree.Node;

      // Safely assign parent pointer without using 'any'
      if (parentNode) {
        const mutableNode = astNode as unknown as Record<string, unknown>;
        mutableNode.parent = parentNode;
      }

      this.rules.forEach((rule) => {
        const context = {
          report: (violation: Omit<Violation, "ruleId" | "severity">) => {
            const configuredSeverity = this.ruleConfig[rule.id];
            const severity: "error" | "warn" =
              configuredSeverity === "warn" ? "warn" : "error";
            this.violations.push({
              ruleId: rule.id,
              severity,
              ...violation,
            });
          },
        };

        const visitors = rule.create(context);
        const visitor = visitors[astNode.type];

        if (visitor) {
          (visitor as (n: TSESTree.Node) => void)(astNode);
        }
      });

      // Pass current AST node down as the parent for children
      for (const key in astNode) {
        if (key === "parent" || key === "loc" || key === "range") continue;

        const child = (astNode as unknown as Record<string, unknown>)[key];
        if (Array.isArray(child)) {
          child.forEach((c) => this.walk(c, astNode));
        } else if (child && typeof child === "object") {
          this.walk(child, astNode);
        }
      }
    } else {
      // Traverse plain wrapper objects/arrays recursively
      for (const key in node) {
        if (key === "parent" || key === "loc" || key === "range") continue;

        const child = (node as Record<string, unknown>)[key];
        if (Array.isArray(child)) {
          child.forEach((c) => this.walk(c, parentNode));
        } else if (child && typeof child === "object") {
          this.walk(child, parentNode);
        }
      }
    }
  }
}
