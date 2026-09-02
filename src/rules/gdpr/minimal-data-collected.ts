import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule } from "@/src/engine/types";

export const minimalDataCollectedRule: Rule = {
  id: "gdpr/minimal-data-collected",
  description:
    "Ensures API endpoints do not accept raw or unconstrained request payloads, enforcing GDPR Article 5(1)(c) Data Minimization.",
  create(context) {
    return {
      MethodDefinition(node) {
        // Check if method has route decorators (e.g., @Post, @Put, @Patch, @Get)
        const hasRouteDecorator = node.decorators?.some((decorator) => {
          const expr = decorator.expression;
          if (expr.type === TSESTree.AST_NODE_TYPES.CallExpression) {
            const callee = expr.callee;
            if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
              return ["Post", "Put", "Patch", "Get", "Route"].includes(
                callee.name,
              );
            }
          }
          return false;
        });

        if (!hasRouteDecorator) return;

        // Inspect method parameters for @Body() with unsafe types
        const params = node.value.params;
        params.forEach((param) => {
          if (param.type !== TSESTree.AST_NODE_TYPES.Identifier) return;

          const hasBodyDecorator = param.decorators?.some((decorator) => {
            const expr = decorator.expression;
            if (expr.type === TSESTree.AST_NODE_TYPES.CallExpression) {
              const callee = expr.callee;
              if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
                return callee.name === "Body";
              }
            }
            return false;
          });

          if (hasBodyDecorator) {
            // Check if type annotation is missing, 'any', or a generic Record
            const typeAnnotation = param.typeAnnotation?.typeAnnotation;
            if (!typeAnnotation) {
              context.report({
                message: `Request body parameter '${param.name}' lacks a structured DTO type. Violates GDPR Article 5(1)(c) Data Minimization.`,
                line: param.loc?.start.line ?? 0,
                column: param.loc?.start.column ?? 0,
              });
              return;
            }

            if (typeAnnotation.type === TSESTree.AST_NODE_TYPES.TSAnyKeyword) {
              context.report({
                message: `Request body parameter '${param.name}' uses 'any' type. Unconstrained payloads violate GDPR Data Minimization principles.`,
                line: param.loc?.start.line ?? 0,
                column: param.loc?.start.column ?? 0,
              });
            }
          }
        });
      },
    };
  },
};
