import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule } from "../../engine/types";

const HIGH_RISK_FIELDS = [
  "bankaccount",
  "creditcard",
  "passportnumber",
  "bvn",
  "nin",
];
const ENCRYPTION_DECORATORS = ["Encrypt", "EncryptedColumn"];

export const unencryptedPiiColumnRule: Rule = {
  id: "gdpr/unencrypted-pii-column",
  description:
    "Identifies high-risk PII stored in database entities as raw text without field-level encryption.",
  create(context) {
    return {
      PropertyDefinition(node) {
        if (node.key.type !== TSESTree.AST_NODE_TYPES.Identifier) return;

        // Find the parent ClassDeclaration by walking up the tree safely
        let current: TSESTree.Node | undefined = node.parent;
        let isEntityClass = false;

        while (current) {
          if (current.type === TSESTree.AST_NODE_TYPES.ClassDeclaration) {
            const hasEntityDecorator = current.decorators?.some(
              (decorator: TSESTree.Decorator) => {
                const expr = decorator.expression;
                if (expr.type === TSESTree.AST_NODE_TYPES.CallExpression) {
                  const callee = expr.callee;
                  return (
                    callee.type === TSESTree.AST_NODE_TYPES.Identifier &&
                    callee.name === "Entity"
                  );
                }
                return false;
              },
            );

            const superClass = current.superClass;
            const isSequelize =
              superClass !== null &&
              superClass !== undefined &&
              superClass.type === TSESTree.AST_NODE_TYPES.Identifier &&
              superClass.name === "Model";

            if (hasEntityDecorator || isSequelize) {
              isEntityClass = true;
            }
            break;
          }
          current = current.parent;
        }

        if (!isEntityClass) return;

        const propertyName = node.key.name.toLowerCase().replace(/[_]/g, "");

        if (HIGH_RISK_FIELDS.includes(propertyName)) {
          const hasEncryption = node.decorators?.some(
            (decorator: TSESTree.Decorator) => {
              const expr = decorator.expression;
              if (expr.type === TSESTree.AST_NODE_TYPES.CallExpression) {
                const callee = expr.callee;
                if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
                  const decoratorName = callee.name;

                  if (ENCRYPTION_DECORATORS.includes(decoratorName))
                    return true;

                  if (decoratorName === "Column") {
                    const args = expr.arguments;
                    if (
                      args.length > 0 &&
                      args[0].type === TSESTree.AST_NODE_TYPES.ObjectExpression
                    ) {
                      const hasTransformer = args[0].properties.some(
                        (prop): prop is TSESTree.Property => {
                          if (prop.type !== TSESTree.AST_NODE_TYPES.Property)
                            return false;
                          if (
                            prop.key.type !== TSESTree.AST_NODE_TYPES.Identifier
                          )
                            return false;
                          return prop.key.name === "transformer";
                        },
                      );
                      if (hasTransformer) return true;
                    }
                  }
                }
              }
              return false;
            },
          );

          if (!hasEncryption) {
            context.report({
              message: `High-risk field '${node.key.name}' in entity is stored without encryption or column transformers. Violates GDPR Article 32.`,
              line: node.loc?.start.line ?? 0,
              column: node.loc?.start.column ?? 0,
            });
          }
        }
      },
    };
  },
};
