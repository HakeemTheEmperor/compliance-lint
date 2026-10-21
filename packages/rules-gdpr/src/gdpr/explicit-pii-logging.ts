import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule } from "@complinter/core";
import { findRiskyReferences } from "../utils";

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

const RISK_PROPERTIES = ["body", "payload", "user"];

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
          findRiskyReferences(arg, RISK_IDENTIFIERS, RISK_PROPERTIES).forEach((ref) => {
            context.report({
              message: `Logging raw ${ref.kind} '${ref.name}' risks exposing sensitive personal data (PII). Violates GDPR Article 32 (Security of Processing).`,
              line: ref.node.loc?.start.line ?? 0,
              column: ref.node.loc?.start.column ?? 0,
            });
          });
        });
      },
    };
  },
};
