import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule } from "@/src/engine/types";

const RELATION_DECORATORS = ["ManyToOne", "OneToOne", "BelongsTo"];

/**
 * Accepts 'CASCADE' / 'SET NULL' as string literals, plain template literals,
 * or enum-style members such as OnDeleteType.CASCADE. SET NULL anonymises the
 * child row, so it does not leave orphaned PII behind either.
 */
function isErasingAction(value: TSESTree.Node): boolean {
  let text: string | null = null;
  if (
    value.type === TSESTree.AST_NODE_TYPES.Literal &&
    typeof value.value === "string"
  ) {
    text = value.value;
  } else if (
    value.type === TSESTree.AST_NODE_TYPES.TemplateLiteral &&
    value.expressions.length === 0
  ) {
    text = value.quasis.map((q) => q.value.cooked).join("");
  } else if (
    value.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
    value.property.type === TSESTree.AST_NODE_TYPES.Identifier
  ) {
    text = value.property.name;
  }
  if (!text) return false;
  const normalised = text.toUpperCase().replace(/[\s_]+/g, " ");
  return normalised === "CASCADE" || normalised === "SET NULL";
}

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

              if (onDeleteProp && isErasingAction(onDeleteProp.value)) {
                hasCascade = true;
              }
            }

            if (!hasCascade) {
              context.report({
                message: `Relation '${propertyName}' lacks an 'onDelete' of 'CASCADE' (or 'SET NULL'). May leave orphaned PII violating GDPR Article 17 (Right to Erasure).`,
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
