import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule } from "@/src/engine/types";

const HTTP_CLIENTS = ["axios", "fetch", "http", "got", "superagent", "request"];
const RISK_PAYLOADS = [
  "body",
  "payload",
  "user",
  "customer",
  "data",
  "req",
  "record",
];

export const thirdPartyPiiLeakRule: Rule = {
  id: "gdpr/third-party-pii-leak",
  description:
    "Prevents unauthorized outbound transmission of raw PII or request payloads to external third-party services, enforcing GDPR Articles 28 & 44.",
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        let isOutboundCall = false;

        // Check for fetch("...") or axios.post("..."), etc.
        if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
          if (HTTP_CLIENTS.includes(callee.name.toLowerCase())) {
            isOutboundCall = true;
          }
        } else if (callee.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
          const obj = callee.object;
          if (
            obj.type === TSESTree.AST_NODE_TYPES.Identifier &&
            HTTP_CLIENTS.includes(obj.name.toLowerCase())
          ) {
            isOutboundCall = true;
          }
        }

        if (!isOutboundCall) return;

        // Inspect outbound arguments for raw sensitive identifiers or property payloads
        node.arguments.forEach((arg) => {
          if (arg.type === TSESTree.AST_NODE_TYPES.Identifier) {
            if (RISK_PAYLOADS.includes(arg.name.toLowerCase())) {
              context.report({
                message: `Passing raw variable '${arg.name}' to an outbound HTTP call risks unvetted third-party PII transmission. Violates GDPR Articles 28 & 44.`,
                line: arg.loc?.start.line ?? 0,
                column: arg.loc?.start.column ?? 0,
              });
            }
          } else if (arg.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
            if (
              arg.property.type === TSESTree.AST_NODE_TYPES.Identifier &&
              ["body", "payload", "user", "customer"].includes(
                arg.property.name.toLowerCase(),
              )
            ) {
              context.report({
                message: `Passing raw property '${arg.property.name}' to an outbound HTTP call risks unvetted third-party PII transmission. Violates GDPR Articles 28 & 44.`,
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
