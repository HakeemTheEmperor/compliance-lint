import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule } from "@/src/engine/types";
import { findRiskyReferences } from "../utils";

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

const RISK_PROPERTIES = ["body", "payload", "user", "customer"];

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
          findRiskyReferences(arg, RISK_PAYLOADS, RISK_PROPERTIES).forEach((ref) => {
            context.report({
              message: `Passing raw ${ref.kind} '${ref.name}' to an outbound HTTP call risks unvetted third-party PII transmission. Violates GDPR Articles 28 & 44.`,
              line: ref.node.loc?.start.line ?? 0,
              column: ref.node.loc?.start.column ?? 0,
            });
          });
        });
      },
    };
  },
};
