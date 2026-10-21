import { TSESTree } from "@typescript-eslint/typescript-estree";
import {
  LanguageAdapter,
  TsNodes,
  createRuleFactory,
  walkTypedTree,
} from "@complinter/core";
import { parseSource } from "./parse-file";

/** Reads TypeScript and JavaScript sources via typescript-estree. */
export const typescriptAdapter: LanguageAdapter<TsNodes, TSESTree.Program> = {
  id: "typescript",
  extensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx"],
  excludeSuffixes: [".d.ts"],
  parse(source, filePath) {
    const { ast, comments } = parseSource(source, filePath);
    return { tree: ast, comments };
  },
  walk(root, visit) {
    walkTypedTree(root, (type, node) =>
      visit(type as keyof TsNodes & string, node as TsNodes[keyof TsNodes]),
    );
  },
};

/**
 * Helper for writing TypeScript-language rules: visitor parameters are typed
 * from the ESTree vocabulary and unknown visitor names are rejected.
 */
export const defineRule = createRuleFactory<TsNodes>("typescript");
