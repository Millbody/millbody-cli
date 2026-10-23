import { proc } from "./proc.js";

export async function runScript(projectDir, script, args = [], { spawn = proc.spawn } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("yarn", [script, ...args], {
      cwd: projectDir,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(new Error(`yarn não encontrado. Instale yarn para continuar.`));
      } else {
        reject(err);
      }
    });

    child.on("close", (code, signal) => {
      if (signal) {
        resolve(128 + (signal === "SIGINT" ? 2 : 1));
      } else {
        resolve(code ?? 1);
      }
    });
  });
}
