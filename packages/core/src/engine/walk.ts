/**
 * Walks a tree of plain objects whose nodes carry a string `type` property
 * (ESTree and similar), calling `visit` for each node, parents first.
 *
 * Every visited node below the root also gets a `parent` pointer, which rules
 * rely on to look at enclosing nodes. `parent`, `loc`, `range`, `tokens` and
 * `comments` are never descended into.
 */
export function walkTypedTree(
  root: unknown,
  visit: (type: string, node: object) => void,
): void {
  walk(root, null, visit);
}

function walk(
  node: unknown,
  parentNode: object | null,
  visit: (type: string, node: object) => void,
): void {
  if (!node || typeof node !== "object") return;

  const isAstNode = "type" in node && typeof node.type === "string";

  if (isAstNode) {
    if (parentNode) {
      (node as Record<string, unknown>).parent = parentNode;
    }
    visit((node as { type: string }).type, node);
  }

  // AST nodes become the parent of their children; plain wrapper
  // objects/arrays pass the current parent through unchanged.
  const nextParent = isAstNode ? node : parentNode;

  for (const key in node) {
    if (
      key === "parent" ||
      key === "loc" ||
      key === "range" ||
      key === "tokens" ||
      key === "comments"
    )
      continue;

    const child = (node as Record<string, unknown>)[key];
    if (Array.isArray(child)) {
      child.forEach((c) => walk(c, nextParent, visit));
    } else if (child && typeof child === "object") {
      walk(child, nextParent, visit);
    }
  }
}
