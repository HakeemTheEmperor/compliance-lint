import { AST_NODE_TYPES, TSESTree, defineRule } from "complinter/plugin-api";
import {
  HTTP_METHOD_DECORATORS,
  decoratorArguments,
  findDecorator,
  normalise,
  owningClass,
} from "./helpers";

const T = AST_NODE_TYPES;

/** Field names (normalised) that must never appear in a response. */
const SENSITIVE_FIELDS = new Set([
  "password",
  "passwordhash",
  "hashedpassword",
  "passwd",
  "salt",
  "secret",
  "apikey",
  "refreshtoken",
  "twofactorsecret",
  "ssn",
  "socialsecuritynumber",
  "pin",
  "bvn",
  "nin",
  "cardnumber",
  "creditcard",
  "cvv",
]);

/** Wrapper types whose type arguments are what the client actually receives. */
const TRANSPARENT_TYPES = new Set([
  "Promise",
  "Observable",
  "Array",
  "ReadonlyArray",
]);

interface ClassInfo {
  name: string;
  /** `@Exclude()` on the class itself: every field is hidden unless it has `@Expose()`. */
  excludeAll: boolean;
  fields: { name: string; excluded: boolean; exposed: boolean }[];
}

function describeClass(node: TSESTree.ClassDeclaration): ClassInfo | null {
  if (!node.id) return null;

  const fields: ClassInfo["fields"] = [];
  for (const member of node.body.body) {
    if (member.type !== T.PropertyDefinition) continue;
    const key = member.key;
    const name =
      key.type === T.Identifier
        ? key.name
        : key.type === T.Literal && typeof key.value === "string"
          ? key.value
          : null;
    if (name === null) continue;
    fields.push({
      name,
      excluded: findDecorator(member.decorators, ["Exclude"]) !== undefined,
      exposed: findDecorator(member.decorators, ["Expose"]) !== undefined,
    });
  }

  return {
    name: node.id.name,
    excludeAll: findDecorator(node.decorators, ["Exclude"]) !== undefined,
    fields,
  };
}

/** `@SerializeOptions({ strategy: 'excludeAll' })` makes every field hidden unless `@Expose()`d. */
function usesExcludeAllStrategy(
  decorators: readonly TSESTree.Decorator[] | undefined,
): boolean {
  const decorator = findDecorator(decorators, ["SerializeOptions"]);
  if (!decorator) return false;
  return decoratorArguments(decorator).some(
    (argument) =>
      argument.type === T.ObjectExpression &&
      argument.properties.some(
        (property) =>
          property.type === T.Property &&
          property.key.type === T.Identifier &&
          property.key.name === "strategy" &&
          property.value.type === T.Literal &&
          property.value.value === "excludeAll",
      ),
  );
}

/** Names of the classes a return type annotation promises to send back. */
function returnedTypeNames(type: TSESTree.TypeNode): string[] {
  switch (type.type) {
    case T.TSTypeReference: {
      if (type.typeName.type !== T.Identifier) return [];
      const name = type.typeName.name;
      if (TRANSPARENT_TYPES.has(name)) {
        return (type.typeArguments?.params ?? []).flatMap(returnedTypeNames);
      }
      return [name];
    }
    case T.TSArrayType:
      return returnedTypeNames(type.elementType);
    case T.TSUnionType:
      return type.types.flatMap(returnedTypeNames);
    default:
      return [];
  }
}

/** `return new User(...)` statements directly in the handler (not in nested functions). */
function returnedNewClasses(
  node: TSESTree.Node,
  found: string[] = [],
): string[] {
  if (
    node.type === T.FunctionExpression ||
    node.type === T.ArrowFunctionExpression ||
    node.type === T.FunctionDeclaration
  ) {
    return found;
  }
  if (
    node.type === T.ReturnStatement &&
    node.argument?.type === T.NewExpression &&
    node.argument.callee.type === T.Identifier
  ) {
    found.push(node.argument.callee.name);
  }
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    const child = (node as unknown as Record<string, unknown>)[key];
    for (const item of Array.isArray(child) ? child : [child]) {
      if (item && typeof item === "object" && "type" in item) {
        returnedNewClasses(item as TSESTree.Node, found);
      }
    }
  }
  return found;
}

export const unserializedSensitiveResponseRule = defineRule({
  id: "nestjs/unserialized-sensitive-response",
  description:
    "Flags NestJS route handlers that return a class declaring sensitive fields (such as password) without @Exclude(), so they are serialized into the response (GDPR Articles 5(1)(c) and 32).",
  create(context) {
    // Classes declared in this file, collected before any handler is visited.
    const classes = new Map<string, ClassInfo>();

    function collect(node: TSESTree.Node | null | undefined): void {
      if (node?.type === T.ClassDeclaration) {
        const info = describeClass(node);
        if (info) classes.set(info.name, info);
      }
    }

    return {
      Program(node) {
        for (const statement of node.body) {
          if (
            statement.type === T.ExportNamedDeclaration ||
            statement.type === T.ExportDefaultDeclaration
          ) {
            collect(statement.declaration);
          } else {
            collect(statement);
          }
        }
      },

      MethodDefinition(node) {
        if (node.value.type !== T.FunctionExpression) return;
        if (node.key.type !== T.Identifier) return;

        const controller = owningClass(node);
        if (!findDecorator(controller?.decorators, ["Controller"])) return;
        if (!findDecorator(node.decorators, [...HTTP_METHOD_DECORATORS]))
          return;

        const excludeAllStrategy =
          usesExcludeAllStrategy(node.decorators) ||
          usesExcludeAllStrategy(controller?.decorators);

        const returned = new Set<string>();
        const annotation = node.value.returnType?.typeAnnotation;
        if (annotation)
          returnedTypeNames(annotation).forEach((n) => returned.add(n));
        if (node.value.body) {
          returnedNewClasses(node.value.body).forEach((n) => returned.add(n));
        }

        for (const className of returned) {
          const info = classes.get(className);
          if (!info) continue; // declared elsewhere: cannot be inspected from this file

          const exposed = info.fields
            .filter((field) => SENSITIVE_FIELDS.has(normalise(field.name)))
            .filter((field) => {
              const hidden =
                field.excluded ||
                ((info.excludeAll || excludeAllStrategy) && !field.exposed);
              return !hidden;
            })
            .map((field) => field.name);
          if (exposed.length === 0) continue;

          context.report({
            message: `Route handler '${node.key.name}()' returns '${info.name}', which exposes ${exposed.map((f) => `'${f}'`).join(", ")} without @Exclude(). Hide sensitive fields with @Exclude() and serialize responses with ClassSerializerInterceptor, or return a DTO. Violates GDPR Articles 5(1)(c) and 32.`,
            line: node.key.loc.start.line,
            column: node.key.loc.start.column,
          });
        }
      },
    };
  },
});
