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
  "terms",
];

export const missingConsentFlagRule: Rule = {
  id: "gdpr/missing-consent-flag",
  description:
    "Ensures user registration or data intake endpoints require a DTO containing an explicit consent validation property, enforcing GDPR Articles 6 & 7.",
  create(context) {
    // Registry to store class names and their property names within the parsed file
    const localClasses = new Map<string, string[]>();

    return {
      // First pass: Pre-collect all class declarations and their properties in the file
      Program(node) {
        node.body.forEach((child) => {
          if (
            child.type === TSESTree.AST_NODE_TYPES.ClassDeclaration &&
            child.id?.type === TSESTree.AST_NODE_TYPES.Identifier
          ) {
            const className = child.id.name;
            const properties: string[] = [];

            child.body.body.forEach((member) => {
              if (
                member.type === TSESTree.AST_NODE_TYPES.PropertyDefinition &&
                member.key.type === TSESTree.AST_NODE_TYPES.Identifier
              ) {
                properties.push(member.key.name.toLowerCase());
              }
            });

            localClasses.set(className, properties);
          }
        });
      },

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
          let typeName: string | null = null;

          if (
            param.type === TSESTree.AST_NODE_TYPES.Identifier &&
            param.typeAnnotation
          ) {
            const typeAnnotation = param.typeAnnotation.typeAnnotation;
            if (
              typeAnnotation &&
              typeAnnotation.type === TSESTree.AST_NODE_TYPES.TSTypeReference &&
              typeAnnotation.typeName.type ===
                TSESTree.AST_NODE_TYPES.Identifier
            ) {
              typeName = typeAnnotation.typeName.name;
            }
          }

          if (typeName) {
            // 1. Check if the type name itself hints at consent (fallback)
            const lowerTypeName = typeName.toLowerCase();
            if (CONSENT_IDENTIFIERS.some((id) => lowerTypeName.includes(id))) {
              hasConsentField = true;
            }

            // 2. Inspect the interior properties of the corresponding DTO class
            const classProperties = localClasses.get(typeName);
            if (classProperties) {
              const hasConsentProperty = classProperties.some((prop) =>
                CONSENT_IDENTIFIERS.some((id) => prop.includes(id)),
              );
              if (hasConsentProperty) {
                hasConsentField = true;
              }
            }
          }
        });

        if (!hasConsentField) {
          context.report({
            message: `Registration endpoint '${node.key.name}()' uses a DTO that lacks an explicit consent validation property. Violates GDPR Articles 6 & 7.`,
            line: node.loc?.start.line ?? 0,
            column: node.loc?.start.column ?? 0,
          });
        }
      },
    };
  },
};
