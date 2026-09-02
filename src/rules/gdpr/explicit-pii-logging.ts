import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule } from "@/src/engine/types";

const LOGGER_OBJECTS = ["console", "logger", "winston", "pino"];
const RISK_IDENTIFIERS = [
  "payload",
  "user",
  "customer",
  "password",
  "creditcard",
  "req",
  "request",
];

export const explicitPiiLoggingRule: Rule = {
  id: "gdpr/explicit-pii-logging",
  description:
    "Prevents accidental logging of raw PII, request bodies, or sensitive objects, ensuring compliance with GDPR Article 32.",
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        let isLoggingCall = false;

        if (callee.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
          const obj = callee.object;
          const prop = callee.property;

          if (
            obj.type === TSESTree.AST_NODE_TYPES.Identifier &&
            (LOGGER_OBJECTS.includes(obj.name) ||
              obj.name.toLowerCase().includes("logger")) &&
            prop.type === TSESTree.AST_NODE_TYPES.Identifier
          ) {
            isLoggingCall = true;
          } else if (
            obj.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
            obj.property.type === TSESTree.AST_NODE_TYPES.Identifier &&
            obj.property.name.toLowerCase().includes("logger")
          ) {
            isLoggingCall = true;
          }
        }

        if (!isLoggingCall) return;

        node.arguments.forEach((arg) => {
          if (arg.type === TSESTree.AST_NODE_TYPES.Identifier) {
            if (RISK_IDENTIFIERS.includes(arg.name.toLowerCase())) {
              context.report({
                message: `Logging raw variable '${arg.name}' risks exposing sensitive personal data (PII). Violates GDPR Article 32 (Security of Processing).`,
                line: arg.loc?.start.line ?? 0,
                column: arg.loc?.start.column ?? 0,
              });
            }
          } else if (arg.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
            if (
              arg.property.type === TSESTree.AST_NODE_TYPES.Identifier &&
              ["body", "payload", "user"].includes(
                arg.property.name.toLowerCase(),
              )
            ) {
              context.report({
                message: `Logging raw property '${arg.property.name}' risks exposing sensitive personal data (PII). Violates GDPR Article 32 (Security of Processing).`,
                line: arg.loc?.start.line ?? 0,
                column: arg.loc?.start.column ?? 0,
              });
            }
          }
        });
      },
    };
  },
};
