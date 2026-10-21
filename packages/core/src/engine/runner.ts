import { TSESTree } from "@typescript-eslint/typescript-estree";
import { DEFAULT_LANGUAGE, Violation } from "./types";
import {
  AnyAdapter,
  AnyRule,
  assertLanguagesRegistered,
} from "./language";
import { applySuppressions } from "./suppress";
import { walkTypedTree } from "./walk";

type Visitor = (node: unknown) => void;
type VisitorMap = Record<string, Visitor | undefined>;

/** What the engine needs from an adapter to walk a parsed tree. */
interface TreeWalker {
  id: string;
  walk(root: unknown, visit: (type: string, node: unknown) => void): void;
}

/** Walker used by `run(ast)`: a bare ESTree program, as before adapters existed. */
const TYPED_TREE_WALKER: TreeWalker = {
  id: DEFAULT_LANGUAGE,
  walk: (root, visit) => walkTypedTree(root, visit),
};

export class EngineRunner {
  private rules: readonly AnyRule[];
  private ruleConfig: Record<string, string>;
  private adapters: readonly AnyAdapter[];

  constructor(
    rules: readonly AnyRule[],
    ruleConfig: Record<string, string> = {},
    adapters: readonly AnyAdapter[] = [],
  ) {
    if (adapters.length > 0) {
      assertLanguagesRegistered(adapters, rules);
    }
    this.rules = rules.filter((rule) => {
      const severity = ruleConfig[rule.id];
      return severity !== "off";
    });
    this.ruleConfig = ruleConfig;
    this.adapters = adapters;
  }

  /** True when a registered adapter handles this file name. */
  supportsFile(filePath: string): boolean {
    return this.adapterFor(filePath) !== undefined;
  }

  /**
   * Parses and analyses one file with the adapter registered for its
   * extension, then applies inline suppression comments. Files no adapter
   * handles yield no violations. Parse errors are thrown to the caller.
   */
  lintSource(source: string, filePath: string): Violation[] {
    const adapter = this.adapterFor(filePath);
    if (!adapter) return [];

    const parsed = adapter.parse(source, filePath);
    const violations = this.runTree(adapter, parsed.tree, {
      filename: filePath,
      sourceText: source,
    });
    return applySuppressions(violations, parsed.comments);
  }

  /** Runs the TypeScript-language rules over an already parsed ESTree program. */
  run(ast: TSESTree.Program): Violation[] {
    return this.runTree(TYPED_TREE_WALKER, ast, {});
  }

  private runTree(
    walker: TreeWalker,
    tree: unknown,
    info: { filename?: string; sourceText?: string },
  ): Violation[] {
    const violations: Violation[] = [];

    // Each rule is instantiated once per file so that state captured in
    // create() (e.g. a pre-collected class registry) survives the whole walk.
    const visitorMaps: VisitorMap[] = this.rules
      .filter((rule) => (rule.language ?? DEFAULT_LANGUAGE) === walker.id)
      .map(
        (rule) =>
          rule.create({
            filename: info.filename ?? "",
            sourceText: info.sourceText ?? "",
            report: (violation) => {
              const configuredSeverity = this.ruleConfig[rule.id];
              const severity: "error" | "warn" =
                configuredSeverity === "warn" ? "warn" : "error";
              violations.push({ ruleId: rule.id, severity, ...violation });
            },
          }) as VisitorMap,
      );

    walker.walk(tree, (type, node) => {
      for (const visitors of visitorMaps) {
        visitors[type]?.(node);
      }
    });
    return violations;
  }

  private adapterFor(filePath: string): AnyAdapter | undefined {
    return this.adapters.find(
      (adapter) =>
        adapter.extensions.some((ext) => filePath.endsWith(ext)) &&
        !(adapter.excludeSuffixes ?? []).some((suffix) =>
          filePath.endsWith(suffix),
        ),
    );
  }
}
