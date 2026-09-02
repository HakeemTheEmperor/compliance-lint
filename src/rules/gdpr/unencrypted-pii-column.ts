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
        if (node.key.type !== "Identifier") return;

        // Find the parent ClassDeclaration by walking up the tree safely
        let current: TSESTree.Node | undefined = node.parent;
        let isEntityClass = false;

        while (current) {
          if (current.type === "ClassDeclaration") {
            const hasEntityDecorator = current.decorators?.some(
              (decorator: TSESTree.Decorator) => {
                return (
                  decorator.expression.type === "CallExpression" &&
                  decorator.expression.callee.type === "Identifier" &&
                  decorator.expression.callee.name === "Entity"
                );
              },
            );

            const isSequelize =
              current.superClass?.type === "Identifier" &&
              current.superClass.name === "Model";

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
              if (
                decorator.expression.type === "CallExpression" &&
                decorator.expression.callee.type === "Identifier"
              ) {
                const decoratorName = decorator.expression.callee.name;

                if (ENCRYPTION_DECORATORS.includes(decoratorName)) return true;

                if (decoratorName === "Column") {
                  const args = decorator.expression.arguments;
                  if (args.length > 0 && args[0].type === "ObjectExpression") {
                    const hasTransformer = args[0].properties.some((prop) => {
                      return (
                        prop.type === "Property" &&
                        prop.key.type === "Identifier" &&
                        prop.key.name === "transformer"
                      );
                    });
                    if (hasTransformer) return true;
                  }
                }
              }
              return false;
            },
          );

          if (!hasEncryption) {
            context.report({
              message: `High-risk field '${node.key.name}' in entity is stored without encryption or column transformers. Violates GDPR Article 32.`,
              line: node.loc?.start.line || 0,
              column: node.loc?.start.column || 0,
            });
          }
        }
      },
    };
  },
};
