import { parse, TSESTree } from "@typescript-eslint/typescript-estree";
import * as fs from "fs";
import * as path from "path";

/**
 * Reads a TypeScript/JavaScript file and parses it into an AST
 */
export function generateAST(filePath: string): TSESTree.Program {
  const absolutePath = path.resolve(filePath);
  const sourceCode = fs.readFileSync(absolutePath, "utf-8");

  return parse(sourceCode, {
    loc: true, // Injects line and column numbers
    range: true, // Injects start/end character indexes
    tokens: true,
    comment: true, // Allows us to read JSDoc or compliance ignore comments.
  });
}
