import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule } from "@/src/engine/types";

const QUERY_METHODS = ["find", "findOne", "findAndCount", "findAll"];

export const overlyBroadSelectRule: Rule = {
  id: "gdpr/overly-broad-select",
  description:
    "Ensures database queries specify explicit column selection to prevent overly broad data retrieval (GDPR Art. 5).",
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== TSESTree.AST_NODE_TYPES.MemberExpression) return;

        const property = callee.property;
        if (property.type !== TSESTree.AST_NODE_TYPES.Identifier) return;

        if (QUERY_METHODS.includes(property.name)) {
          const args = node.arguments;
          const optionsArg = args.find(
            (arg) => arg.type === TSESTree.AST_NODE_TYPES.ObjectExpression,
          );

          if (!optionsArg) {
            context.report({
              message: `Query method '${property.name}()' executes without explicit field selection, risking overly broad data retrieval. Violates GDPR Article 5(1)(c).`,
              line: node.loc?.start.line ?? 0,
              column: node.loc?.start.column ?? 0,
            });
            return;
          }

          const hasSelect = optionsArg.properties.some((prop) => {
            if (prop.type !== TSESTree.AST_NODE_TYPES.Property) return false;
            if (prop.key.type !== TSESTree.AST_NODE_TYPES.Identifier)
              return false;
            return prop.key.name === "select";
          });

          if (!hasSelect) {
            context.report({
              message: `Query method '${property.name}()' options object lacks a 'select' property. Violates GDPR Article 5(1)(c) Data Minimization.`,
              line: node.loc?.start.line ?? 0,
              column: node.loc?.start.column ?? 0,
            });
          }
        }
      },
    };
  },
};
