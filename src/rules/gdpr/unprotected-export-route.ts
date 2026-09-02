import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule } from "@/src/engine/types";

const EXPORT_KEYWORDS = [
  "export",
  "download",
  "dump",
  "backup",
  "gdprdata",
  "extract",
];
const AUTH_DECORATORS = [
  "UseGuards",
  "Auth",
  "JwtAuthGuard",
  "Roles",
  "ApiKeyGuard",
  "Authenticated",
];

export const unprotectedExportRouteRule: Rule = {
  id: "gdpr/unprotected-export-route",
  description:
    "Ensures data export and download endpoints are secured with authentication or authorization guards, enforcing GDPR Articles 20 & 32.",
  create(context) {
    return {
      MethodDefinition(node) {
        if (node.key.type !== TSESTree.AST_NODE_TYPES.Identifier) return;
        const methodName = node.key.name.toLowerCase();

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
                return EXPORT_KEYWORDS.some((kw) =>
                  arg.value.toLowerCase().includes(kw),
                );
              }
              return false;
            });
          }
          return false;
        });

        const isExportMethod =
          EXPORT_KEYWORDS.some((keyword) => methodName.includes(keyword)) ||
          routePathMatch;

        if (!isExportMethod) return;

        // Check if the method has security guards applied
        const hasAuthGuard = node.decorators?.some((decorator) => {
          const expr = decorator.expression;
          if (expr.type === TSESTree.AST_NODE_TYPES.CallExpression) {
            const callee = expr.callee;
            if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
              return AUTH_DECORATORS.some((guard) =>
                callee.name.toLowerCase().includes(guard.toLowerCase()),
              );
            }
          } else if (expr.type === TSESTree.AST_NODE_TYPES.Identifier) {
            return AUTH_DECORATORS.some((guard) =>
              expr.name.toLowerCase().includes(guard.toLowerCase()),
            );
          }
          return false;
        });

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
