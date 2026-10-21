import { AST_NODE_TYPES, TSESTree, defineRule } from "complinter/plugin-api";
import {
  HTTP_METHOD_DECORATORS,
  decoratorArguments,
  decoratorName,
  findDecorator,
  normalise,
  stringValues,
} from "./helpers";

const T = AST_NODE_TYPES;

/** Parameter names (normalised) that carry personal or secret data. */
const PII_PARAMETERS = new Set([
  "email",
  "emailaddress",
  "phone",
  "phonenumber",
  "mobile",
  "mobilenumber",
  "ssn",
  "socialsecuritynumber",
  "nin",
  "bvn",
  "passport",
  "passportnumber",
  "dob",
  "dateofbirth",
  "birthdate",
  "creditcard",
  "creditcardnumber",
  "cardnumber",
  "iban",
  "bankaccount",
  "password",
  "passwd",
]);

const ROUTE_DECORATORS: readonly string[] = [
  "Controller",
  ...HTTP_METHOD_DECORATORS,
];
const PARAMETER_DECORATORS = ["Param", "Query"];

/** `users/:email/orders` -> ["email"]; also strips modifiers like `:id?` and `:id(\d+)`. */
function pathParameters(path: string): string[] {
  return path
    .split("/")
    .filter((segment) => segment.startsWith(":"))
    .map((segment) => segment.slice(1).replace(/[?+*].*$|\(.*$/, ""));
}

function isPii(name: string): boolean {
  return PII_PARAMETERS.has(normalise(name));
}

export const piiInUrlRule = defineRule({
  id: "nestjs/pii-in-url",
  description:
    "Flags NestJS route paths and @Param/@Query parameters that carry personal data, which ends up in access logs, proxies and browser history (GDPR Articles 5(1)(c) and 32).",
  create(context) {
    const where = (node: TSESTree.Node) => ({
      line: node.loc.start.line,
      column: node.loc.start.column,
    });

    function checkRoutePaths(
      decorators: readonly TSESTree.Decorator[] | undefined,
    ): void {
      for (const decorator of decorators ?? []) {
        const name = decoratorName(decorator);
        if (name === null || !ROUTE_DECORATORS.includes(name)) continue;

        for (const argument of decoratorArguments(decorator)) {
          for (const { value, node } of stringValues(argument)) {
            for (const parameter of pathParameters(value)) {
              if (!isPii(parameter)) continue;
              context.report({
                message: `Route path parameter ':${parameter}' puts personal data in the URL, where it is stored in access logs, proxies and browser history. Send it in the request body instead. Violates GDPR Articles 5(1)(c) and 32.`,
                ...where(node),
              });
            }
          }
        }
      }
    }

    function checkParameterDecorators(param: TSESTree.Parameter): void {
      const decorators = "decorators" in param ? param.decorators : undefined;
      const decorator = findDecorator(decorators, PARAMETER_DECORATORS);
      if (!decorator) return;

      const [first] = decoratorArguments(decorator);
      if (!first) return;
      for (const { value, node } of stringValues(first)) {
        if (!isPii(value)) continue;
        const kind = decoratorName(decorator) === "Query" ? "Query" : "Path";
        context.report({
          message: `${kind} parameter '${value}' carries personal data in the URL, where it is stored in access logs, proxies and browser history. Send it in the request body instead. Violates GDPR Articles 5(1)(c) and 32.`,
          ...where(node),
        });
      }
    }

    return {
      ClassDeclaration(node) {
        checkRoutePaths(node.decorators);
      },
      MethodDefinition(node) {
        if (node.value.type !== T.FunctionExpression) return;
        checkRoutePaths(node.decorators);
        node.value.params.forEach(checkParameterDecorators);
      },
    };
  },
});
