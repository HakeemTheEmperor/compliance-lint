import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule } from "@/src/engine/types";

const REGISTRATION_KEYWORDS = ["register", "signup", "onboard", "subscribe"];
const CONSENT_IDENTIFIERS = [
  "consent",
  "gdprconsent",
  "agreed",
  "termsaccepted",
  "optin",
  "terms",
];

export const missingConsentFlagRule: Rule = {
  id: "gdpr/missing-consent-flag",
  description:
    "Ensures user registration or data intake endpoints require an explicit consent validation property, enforcing GDPR Articles 6 & 7.",
  create(context) {
    return {
      MethodDefinition(node) {
        if (node.key.type !== TSESTree.AST_NODE_TYPES.Identifier) return;
        const methodName = node.key.name.toLowerCase();

        const isRegistrationMethod = REGISTRATION_KEYWORDS.some((keyword) =>
          methodName.includes(keyword),
        );

        if (!isRegistrationMethod) return;

        const params = node.value.params;
        let hasConsentField = false;

        params.forEach((param) => {
          if (param.type !== TSESTree.AST_NODE_TYPES.Identifier) return;

          const typeAnnotation = param.typeAnnotation?.typeAnnotation;
          if (
            typeAnnotation &&
            typeAnnotation.type === TSESTree.AST_NODE_TYPES.TSTypeReference
          ) {
            const typeName = typeAnnotation.typeName;
            if (typeName.type === TSESTree.AST_NODE_TYPES.Identifier) {
              const lowerTypeName = typeName.name.toLowerCase();

              // Properly evaluate against CONSENT_IDENTIFIERS array
              const matchesConsent = CONSENT_IDENTIFIERS.some((identifier) =>
                lowerTypeName.includes(identifier),
              );

              if (matchesConsent) {
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
