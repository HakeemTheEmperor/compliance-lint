import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule } from "../../engine/types";

const RELATION_DECORATORS = ["ManyToOne", "OneToOne", "BelongsTo"];

export const missingErasureCascadeRule: Rule = {
  id: "gdpr/missing-erasure-cascade",
  description:
    "Ensures database relationships handle deletion cascades to satisfy GDPR Article 17 Right to Erasure.",
  create(context) {
    return {
      PropertyDefinition(node) {
        if (node.key.type !== TSESTree.AST_NODE_TYPES.Identifier) return;
        const propertyName = node.key.name;

        // Check if the property has a relation decorator
        node.decorators?.forEach((decorator: TSESTree.Decorator) => {
          const expr = decorator.expression;
          if (expr.type !== TSESTree.AST_NODE_TYPES.CallExpression) return;

          const callee = expr.callee;
          if (callee.type !== TSESTree.AST_NODE_TYPES.Identifier) return;

          if (RELATION_DECORATORS.includes(callee.name)) {
            const args = expr.arguments;
            let hasCascade = false;

            // TypeORM relations often pass an options object as the second argument
            for (const arg of args) {
              if (arg.type !== TSESTree.AST_NODE_TYPES.ObjectExpression)
                continue;

              const onDeleteProp = arg.properties.find(
                (prop): prop is TSESTree.Property => {
                  if (prop.type !== TSESTree.AST_NODE_TYPES.Property)
                    return false;
                  if (prop.key.type !== TSESTree.AST_NODE_TYPES.Identifier)
                    return false;
                  return prop.key.name === "onDelete";
                },
              );

              if (
                onDeleteProp &&
                onDeleteProp.value.type === TSESTree.AST_NODE_TYPES.Literal
              ) {
                const val = onDeleteProp.value.value;
                if (
                  typeof val === "string" &&
                  val.toUpperCase() === "CASCADE"
                ) {
                  hasCascade = true;
                }
              }
            }

            if (!hasCascade) {
              context.report({
                message: `Relation '${propertyName}' lacks 'onDelete: 'CASCADE'' configuration. May leave orphaned PII violating GDPR Article 17 (Right to Erasure).`,
                line: node.loc?.start.line ?? 0,
                column: node.loc?.start.column ?? 0,
              });
            }
          }
        });
      },
    };
  },
};
