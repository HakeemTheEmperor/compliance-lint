import { generateAST } from "./engine/parser";

const targetFile = "./test/dummy.dto.ts";

try {
  console.log(`Analyzing: ${targetFile}...\n`);
  const ast = generateAST(targetFile);

  // The AST object is massive, so let's just inspect the main body nodes
  ast.body.forEach((node, index) => {
    console.log(`Node [${index}]: Type -> ${node.type}`);

    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "ClassDeclaration"
    ) {
      const className = node.declaration.id?.name;
      console.log(`Found Class: ${className}`);

      // Let's peek at the properties inside the class
      const classBody = node.declaration.body.body;
      classBody.forEach((prop) => {
        if (
          prop.type === "PropertyDefinition" &&
          prop.key.type === "Identifier"
        ) {
          console.log(
            ` - Property: ${prop.key.name} (Lines: ${prop.loc.start.line} to ${prop.loc.end.line})`,
          );
        }
      });
    }
  });
} catch (error) {
  console.error("Failed to parse file:", error);
}
