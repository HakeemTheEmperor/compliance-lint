import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule, Violation } from "./types";

type Visitor = (node: TSESTree.Node) => void;
type VisitorMap = Record<string, Visitor | undefined>;

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

    // Each rule is instantiated once per file so that state captured in
    // create() (e.g. a pre-collected class registry) survives the whole walk.
    const visitorMaps: VisitorMap[] = this.rules.map((rule) =>
      rule.create({
        report: (violation) => {
          const configuredSeverity = this.ruleConfig[rule.id];
          const severity: "error" | "warn" =
            configuredSeverity === "warn" ? "warn" : "error";
          this.violations.push({ ruleId: rule.id, severity, ...violation });
        },
      }) as VisitorMap,
    );

    this.walk(ast, null, visitorMaps);
    return this.violations;
  }

  private walk(
    node: unknown,
    parentNode: TSESTree.Node | null,
    visitorMaps: VisitorMap[],
  ) {
    if (!node || typeof node !== "object") return;

    const isAstNode = "type" in node && typeof node.type === "string";

    if (isAstNode) {
      const astNode = node as TSESTree.Node;

      // Safely assign parent pointer without using 'any'
      if (parentNode) {
        const mutableNode = astNode as unknown as Record<string, unknown>;
        mutableNode.parent = parentNode;
      }

      for (const visitors of visitorMaps) {
        visitors[astNode.type]?.(astNode);
      }
    }

    // AST nodes become the parent of their children; plain wrapper
    // objects/arrays pass the current parent through unchanged.
    const nextParent = isAstNode ? (node as TSESTree.Node) : parentNode;

    for (const key in node) {
      if (
        key === "parent" ||
        key === "loc" ||
        key === "range" ||
        key === "tokens" ||
        key === "comments"
      )
        continue;

      const child = (node as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        child.forEach((c) => this.walk(c, nextParent, visitorMaps));
      } else if (child && typeof child === "object") {
        this.walk(child, nextParent, visitorMaps);
      }
    }
  }
}
