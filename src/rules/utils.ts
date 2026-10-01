import { TSESTree } from "@typescript-eslint/typescript-estree";

const T = TSESTree.AST_NODE_TYPES;

export interface RiskyReference {
  name: string;
  kind: "variable" | "property";
  node: TSESTree.Node;
}

/**
 * Walks a call argument and collects references to risky identifiers or
 * properties. Looks through optional chaining, spread arguments, template
 * literal expressions and object literal values.
 */
export function findRiskyReferences(
  arg: TSESTree.Node,
  riskyIdentifiers: readonly string[],
  riskyProperties: readonly string[],
): RiskyReference[] {
  const found: RiskyReference[] = [];

  const visit = (node: TSESTree.Node): void => {
    switch (node.type) {
      case T.Identifier:
        if (riskyIdentifiers.includes(node.name.toLowerCase())) {
          found.push({ name: node.name, kind: "variable", node });
        }
        break;
      case T.MemberExpression:
        if (
          node.property.type === T.Identifier &&
          !node.computed &&
          riskyProperties.includes(node.property.name.toLowerCase())
        ) {
          found.push({ name: node.property.name, kind: "property", node });
        }
        break;
      case T.ChainExpression:
        visit(node.expression);
        break;
      case T.SpreadElement:
        visit(node.argument);
        break;
      case T.TemplateLiteral:
        node.expressions.forEach(visit);
        break;
      case T.ObjectExpression:
        node.properties.forEach((prop) => {
          if (prop.type === T.SpreadElement) visit(prop);
          else visit(prop.value);
        });
        break;
      default:
        break;
    }
  };

  visit(arg);
  return found;
}
