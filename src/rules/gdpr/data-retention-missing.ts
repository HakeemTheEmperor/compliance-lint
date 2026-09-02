import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule } from "../../engine/types";

const RETENTION_FIELD_PATTERNS = [
  "expiresat",
  "deletedat",
  "retentiondate",
  "ttl",
  "validuntil",
];
const RETENTION_DECORATORS = ["RetentionPolicy", "RetainFor", "DataRetention"];

export const dataRetentionMissingRule: Rule = {
  id: "gdpr/data-retention-missing",
  description:
    "Ensures database entities define a data retention or expiration strategy for storage limitation (GDPR Art. 5).",
  create(context) {
    return {
      ClassDeclaration(node) {
        // 1. Check if the class is a database entity
        const isEntity = node.decorators?.some(
          (decorator: TSESTree.Decorator) => {
            return (
              decorator.expression.type === "CallExpression" &&
              decorator.expression.callee.type === "Identifier" &&
              decorator.expression.callee.name === "Entity"
            );
          },
        );

        const isSequelizeModel =
          node.superClass?.type === "Identifier" &&
          node.superClass.name === "Model";

        if (!isEntity && !isSequelizeModel) return;

        // 2. Check if the class itself has a retention decorator
        const hasRetentionDecorator = node.decorators?.some(
          (decorator: TSESTree.Decorator) => {
            if (
              decorator.expression.type === "CallExpression" &&
              decorator.expression.callee.type === "Identifier"
            ) {
              return RETENTION_DECORATORS.includes(
                decorator.expression.callee.name,
              );
            }
            if (decorator.expression.type === "Identifier") {
              return RETENTION_DECORATORS.includes(decorator.expression.name);
            }
            return false;
          },
        );

        if (hasRetentionDecorator) return;

        // 3. Scan properties to see if an expiration/retention field exists
        const classBody = node.body.body;
        const hasRetentionField = classBody.some((member) => {
          if (
            member.type === "PropertyDefinition" &&
            member.key.type === "Identifier"
          ) {
            const fieldName = member.key.name.toLowerCase().replace(/[_]/g, "");
            return RETENTION_FIELD_PATTERNS.some((pattern) =>
              fieldName.includes(pattern),
            );
          }
          return false;
        });

        // 4. Report violation if neither class decorator nor retention field is found
        if (!hasRetentionField) {
          context.report({
            message: `Entity '${node.id?.name || "Anonymous"}' lacks data retention or expiration tracking. Violates GDPR Article 5(1)(e) Storage Limitation.`,
            line: node.loc?.start.line || 0,
            column: node.loc?.start.column || 0,
          });
        }
      },
    };
  },
};
