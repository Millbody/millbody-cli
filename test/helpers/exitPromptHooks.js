const stub = `
export async function select() {
  const err = new Error("cancelado");
  err.name = "ExitPromptError";
  throw err;
}
`;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@inquirer/prompts") {
    return {
      url: `data:text/javascript,${encodeURIComponent(stub)}`,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
