import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule } from "@/src/engine/types";

// Matched against whole words of method names and route paths, so
// "exportData" and "/export-data" match but "extractToken" does not.
const EXPORT_KEYWORDS = ["export", "exports", "download", "dump", "backup"];

function splitWords(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function hasExportWord(text: string): boolean {
  return splitWords(text).some((word) => EXPORT_KEYWORDS.includes(word));
}
const AUTH_DECORATORS = [
  "UseGuards",
  "Auth",
  "JwtAuthGuard",
  "Roles",
  "ApiKeyGuard",
  "Authenticated",
];

function hasAuthDecorator(
  decorators: TSESTree.Decorator[] | undefined,
): boolean {
  return (decorators ?? []).some((decorator) => {
    const expr = decorator.expression;
    let name: string | null = null;
    if (expr.type === TSESTree.AST_NODE_TYPES.CallExpression) {
      if (expr.callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
        name = expr.callee.name;
      }
    } else if (expr.type === TSESTree.AST_NODE_TYPES.Identifier) {
      name = expr.name;
    }
    if (!name) return false;
    const lowered = name.toLowerCase();
    return AUTH_DECORATORS.some((guard) =>
      lowered.includes(guard.toLowerCase()),
    );
  });
}

export const unprotectedExportRouteRule: Rule = {
  id: "gdpr/unprotected-export-route",
  description:
    "Ensures data export and download endpoints are secured with authentication or authorization guards, enforcing GDPR Articles 20 & 32.",
  create(context) {
    return {
      MethodDefinition(node) {
        if (node.key.type !== TSESTree.AST_NODE_TYPES.Identifier) return;
        const methodName = node.key.name;

        // Also inspect route decorators (e.g., @Get('export-data')) for export keywords
        const routePathMatch = node.decorators?.some((decorator) => {
          const expr = decorator.expression;
          if (expr.type === TSESTree.AST_NODE_TYPES.CallExpression) {
            const args = expr.arguments;
            return args.some((arg) => {
              if (
                arg.type === TSESTree.AST_NODE_TYPES.Literal &&
                typeof arg.value === "string"
              ) {
                return hasExportWord(arg.value);
              }
              return false;
            });
          }
          return false;
        });

        const isExportMethod =
          hasExportWord(methodName) ||
          routePathMatch;

        if (!isExportMethod) return;

        // A guard on the method, or on the enclosing controller class, protects the route
        const owningClass = node.parent?.parent;
        const classDecorators =
          owningClass &&
          (owningClass.type === TSESTree.AST_NODE_TYPES.ClassDeclaration ||
            owningClass.type === TSESTree.AST_NODE_TYPES.ClassExpression)
            ? owningClass.decorators
            : undefined;
        const hasAuthGuard =
          hasAuthDecorator(node.decorators) ||
          hasAuthDecorator(classDecorators);

        if (!hasAuthGuard) {
          context.report({
            message: `Data export endpoint '${node.key.name}()' lacks authentication or security guards, exposing user data dumps. Violates GDPR Articles 20 & 32.`,
            line: node.loc?.start.line ?? 0,
            column: node.loc?.start.column ?? 0,
          });
        }
      },
    };
  },
};
