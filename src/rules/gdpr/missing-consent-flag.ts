import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule } from "@/src/engine/types";

const REGISTRATION_KEYWORDS = [
  "register",
  "signup",
  "create",
  "onboard",
  "subscribe",
];
const CONSENT_IDENTIFIERS = [
  "consent",
  "gdprconsent",
  "agreed",
  "termsaccepted",
  "optin",
];

export const missingConsentFlagRule: Rule = {
  id: "gdpr/missing-consent-flag",
  description:
    "Ensures user registration or data intake endpoints require an explicit consent validation property, enforcing GDPR Articles 6 & 7.",
  create(context) {
    return {
      MethodDefinition(node) {
        // Target class methods that look like registration or sign-up endpoints
        if (node.key.type !== TSESTree.AST_NODE_TYPES.Identifier) return;
        const methodName = node.key.name.toLowerCase();

        const isRegistrationMethod = REGISTRATION_KEYWORDS.some((keyword) =>
          methodName.includes(keyword),
        );

        if (!isRegistrationMethod) return;

        // Inspect method parameters for @Body() or DTO payloads
        const params = node.value.params;
        let hasConsentField = false;

        params.forEach((param) => {
          if (param.type !== TSESTree.AST_NODE_TYPES.Identifier) return;

          // Check if the parameter has a type annotation (DTO name)
          const typeAnnotation = param.typeAnnotation?.typeAnnotation;
          if (
            typeAnnotation &&
            typeAnnotation.type === TSESTree.AST_NODE_TYPES.TSTypeReference
          ) {
            const typeName = typeAnnotation.typeName;
            if (typeName.type === TSESTree.AST_NODE_TYPES.Identifier) {
              // Heuristic: Check if DTO name explicitly mentions consent/terms
              if (
                typeName.name.toLowerCase().includes("consent") ||
                typeName.name.toLowerCase().includes("terms")
              ) {
                hasConsentField = true;
              }
            }
          }
        });

        if (!hasConsentField) {
          context.report({
            message: `Registration endpoint '${node.key.name}()' does not enforce explicit user consent fields. Violates GDPR Articles 6 & 7.`,
            line: node.loc?.start.line ?? 0,
            column: node.loc?.start.column ?? 0,
          });
        }
      },
    };
  },
};
