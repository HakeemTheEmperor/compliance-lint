import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule } from "@/src/engine/types";

const SENSITIVE_FIELDS = ["password", "ssn", "pin", "social_security"];
const VALID_DECORATORS = ["Hash", "Exclude", "Encrypt", "Transform"];

export const piiUnhashedStorageRule: Rule = {
  id: "gdpr/pii-unhashed-storage",
  description:
    "Ensures highly sensitive PII fields are hashed or encrypted at rest.",
  create(context) {
    return {
      PropertyDefinition(node) {
        // 1. Ensure the property has a standard name identifier
        if (node.key.type !== TSESTree.AST_NODE_TYPES.Identifier) return;

        const propertyName = node.key.name.toLowerCase();

        // 2. Check if the property name is in our high-risk list
        if (SENSITIVE_FIELDS.includes(propertyName)) {
          // 3. Check if any decorators are attached to this property (Strictly Typed!)
          const hasSecurityDecorator = node.decorators?.some(
            (decorator: TSESTree.Decorator) => {
              const expr = decorator.expression;
              // Matches decorators with parentheses: @Hash() or @Exclude()
              if (expr.type === TSESTree.AST_NODE_TYPES.CallExpression) {
                const callee = expr.callee;
                if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
                  return VALID_DECORATORS.includes(callee.name);
                }
              }

              // Matches decorators without parentheses: @Exclude
              if (expr.type === TSESTree.AST_NODE_TYPES.Identifier) {
                return VALID_DECORATORS.includes(expr.name);
              }

              return false;
            },
          );

          // 4. Report a violation if no valid decorator is found
          if (!hasSecurityDecorator) {
            context.report({
              message: `Sensitive field '${node.key.name}' lacks a hashing or exclusion decorator. Violates GDPR Article 32.`,
              line: node.loc?.start.line ?? 0, // Safely fallback to 0 if loc is missing
              column: node.loc?.start.column ?? 0, // Safely fallback to 0 if loc is missing
            });
          }
        }
      },
    };
  },
};
