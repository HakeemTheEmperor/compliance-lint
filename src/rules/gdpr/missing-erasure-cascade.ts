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
        if (node.key.type !== "Identifier") return;
        const propertyName = node.key.name;

        // Check if the property has a relation decorator
        node.decorators?.forEach((decorator: TSESTree.Decorator) => {
          if (decorator.expression.type !== "CallExpression") return;

          const callee = decorator.expression.callee;
          if (callee.type !== "Identifier") return;

          if (RELATION_DECORATORS.includes(callee.name)) {
            const args = decorator.expression.arguments;
            let hasCascade = false;

            // TypeORM relations often pass an options object as the second argument
            for (const arg of args) {
              if (arg.type !== "ObjectExpression") continue;

              const onDeleteProp = arg.properties.find(
                (prop): prop is TSESTree.Property => {
                  if (prop.type !== "Property") return false;
                  if (prop.key.type !== "Identifier") return false;
                  return prop.key.name === "onDelete";
                },
              );

              if (onDeleteProp && onDeleteProp.value.type === "Literal") {
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
                line: node.loc?.start.line || 0,
                column: node.loc?.start.column || 0,
              });
            }
          }
        });
      },
    };
  },
};
