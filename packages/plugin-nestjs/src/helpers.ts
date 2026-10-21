import { AST_NODE_TYPES, TSESTree } from "complinter/plugin-api";

const T = AST_NODE_TYPES;

/** `@Name` or `@Name(...)`: the decorator's identifier, or null for anything fancier. */
export function decoratorName(decorator: TSESTree.Decorator): string | null {
  const expr = decorator.expression;
  if (expr.type === T.Identifier) return expr.name;
  if (expr.type === T.CallExpression && expr.callee.type === T.Identifier) {
    return expr.callee.name;
  }
  return null;
}

export function decoratorArguments(
  decorator: TSESTree.Decorator,
): readonly TSESTree.CallExpressionArgument[] {
  return decorator.expression.type === T.CallExpression
    ? decorator.expression.arguments
    : [];
}

export function findDecorator(
  decorators: readonly TSESTree.Decorator[] | undefined,
  names: readonly string[],
): TSESTree.Decorator | undefined {
  return decorators?.find((d) => {
    const name = decoratorName(d);
    return name !== null && names.includes(name);
  });
}

export interface StringValue {
  value: string;
  node: TSESTree.Node;
}

/**
 * The statically known strings in a decorator argument: a string literal, a
 * template literal without expressions, or an array of those.
 */
export function stringValues(node: TSESTree.Node): StringValue[] {
  if (node.type === T.Literal && typeof node.value === "string") {
    return [{ value: node.value, node }];
  }
  if (node.type === T.TemplateLiteral && node.expressions.length === 0) {
    return [{ value: node.quasis.map((q) => q.value.cooked).join(""), node }];
  }
  if (node.type === T.ArrayExpression) {
    return node.elements.flatMap((element) =>
      element ? stringValues(element) : [],
    );
  }
  return [];
}

/** Lowercase letters and digits only, so `phoneNumber`, `phone_number` and `phone-number` compare equal. */
export function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Class that the node (a class member) belongs to, if it is a class declaration. */
export function owningClass(
  member: TSESTree.Node,
): TSESTree.ClassDeclaration | undefined {
  const body = member.parent;
  const cls = body?.parent;
  return cls?.type === T.ClassDeclaration ? cls : undefined;
}

export const HTTP_METHOD_DECORATORS = [
  "Get",
  "Post",
  "Put",
  "Patch",
  "Delete",
  "All",
  "Head",
  "Options",
] as const;
