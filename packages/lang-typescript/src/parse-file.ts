import * as path from "node:path";
import { parse, TSESTree } from "@typescript-eslint/typescript-estree";

export interface ParsedSource {
  ast: TSESTree.Program;
  comments: TSESTree.Comment[];
}

const JSX_EXTENSIONS = new Set([".tsx", ".jsx", ".js", ".mjs", ".cjs"]);

/**
 * Parses source text into an AST. JSX is only enabled for extensions that can
 * contain it, so `<T>expr` casts and generics in plain .ts files still parse.
 */
export function parseSource(code: string, filePath: string): ParsedSource {
  const jsx = JSX_EXTENSIONS.has(path.extname(filePath).toLowerCase());
  const ast = parse(code, { loc: true, range: true, comment: true, jsx });
  return { ast, comments: ast.comments ?? [] };
}
