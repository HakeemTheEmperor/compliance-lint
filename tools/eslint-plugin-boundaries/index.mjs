// Local ESLint plugin that keeps the workspace packages independent, so any of
// them can later move to its own repository without touching its imports.
//
//   boundaries/package-boundaries
//     1. No deep imports into another package ("@complinter/core/dist/x").
//        Packages talk to each other only through their public entry point.
//     2. No relative imports that cross a package boundary ("../../core/src/x").
//        Use the package name instead.
import * as fs from "node:fs";
import * as path from "node:path";

const packageRoots = new Map();

/** Nearest ancestor directory (inclusive) that contains a package.json. */
function packageRootOf(startDir) {
  if (packageRoots.has(startDir)) return packageRoots.get(startDir);

  let dir = startDir;
  let found = null;
  for (;;) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      found = dir;
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  packageRoots.set(startDir, found);
  return found;
}

const DEEP_IMPORT = /^@complinter\/[^/]+\/.+/;

const packageBoundaries = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow deep imports into, and relative imports across, workspace packages.",
    },
    schema: [],
    messages: {
      deepImport:
        'Deep import "{{specifier}}" reaches into another package. Import from the package entry point instead.',
      crossPackage:
        'Relative import "{{specifier}}" crosses a package boundary. Import the package by name instead.',
    },
  },
  create(context) {
    const filename = context.filename;
    const here = packageRootOf(path.dirname(filename));

    function check(node, specifier) {
      if (typeof specifier !== "string") return;

      if (DEEP_IMPORT.test(specifier)) {
        context.report({ node, messageId: "deepImport", data: { specifier } });
        return;
      }

      if (specifier.startsWith(".") && here) {
        const target = path.resolve(path.dirname(filename), specifier);
        const isDirectory =
          fs.existsSync(target) && fs.statSync(target).isDirectory();
        const there = packageRootOf(isDirectory ? target : path.dirname(target));
        if (there && there !== here) {
          context.report({
            node,
            messageId: "crossPackage",
            data: { specifier },
          });
        }
      }
    }

    const literal = (node) =>
      node && node.type === "Literal" ? node.value : undefined;

    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ExportAllDeclaration: (node) => check(node, node.source.value),
      ExportNamedDeclaration: (node) => {
        if (node.source) check(node, node.source.value);
      },
      ImportExpression: (node) => check(node, literal(node.source)),
      TSExternalModuleReference: (node) => check(node, literal(node.expression)),
      CallExpression: (node) => {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require" &&
          node.arguments.length === 1
        ) {
          check(node, literal(node.arguments[0]));
        }
      },
    };
  },
};

export default {
  meta: { name: "boundaries" },
  rules: { "package-boundaries": packageBoundaries },
};
