import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule } from "@/src/engine/types";

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
        // 1. Check if the class is a database entity using enum-based type narrowing
        const isEntity = node.decorators?.some((decorator) => {
          const expr = decorator.expression;
          if (expr.type === TSESTree.AST_NODE_TYPES.CallExpression) {
            const callee = expr.callee;
            return (
              callee.type === TSESTree.AST_NODE_TYPES.Identifier &&
              callee.name === "Entity"
            );
          }
          return false;
        });

        const superClass = node.superClass;
        const isSequelizeModel =
          superClass !== null &&
          superClass !== undefined &&
          superClass.type === TSESTree.AST_NODE_TYPES.Identifier &&
          superClass.name === "Model";

        if (!isEntity && !isSequelizeModel) return;

        // 2. Check if the class itself has a retention decorator
        const hasRetentionDecorator = node.decorators?.some((decorator) => {
          const expr = decorator.expression;
          if (expr.type === TSESTree.AST_NODE_TYPES.CallExpression) {
            const callee = expr.callee;
            return (
              callee.type === TSESTree.AST_NODE_TYPES.Identifier &&
              RETENTION_DECORATORS.includes(callee.name)
            );
          }
          if (expr.type === TSESTree.AST_NODE_TYPES.Identifier) {
            return RETENTION_DECORATORS.includes(expr.name);
          }
          return false;
        });

        if (hasRetentionDecorator) return;

        // 3. Scan properties to see if an expiration/retention field exists
        const classBody = node.body.body;
        const hasRetentionField = classBody.some((member) => {
          if (
            member.type === TSESTree.AST_NODE_TYPES.PropertyDefinition &&
            member.key.type === TSESTree.AST_NODE_TYPES.Identifier
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
            message: `Entity '${node.id?.name ?? "Anonymous"}' lacks data retention or expiration tracking. Violates GDPR Article 5(1)(e) Storage Limitation.`,
            line: node.loc?.start.line ?? 0,
            column: node.loc?.start.column ?? 0,
          });
        }
      },
    };
  },
};
