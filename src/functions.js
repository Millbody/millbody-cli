import { exec } from "child_process";
import fs from "fs";

import {
  walkUp,
  hasThemeMarkers,
  hasRootMarkers,
  describeExpectedMarkers,
} from "./arch/detect.js";

export async function executeCommand(command) {
  return new Promise(async function (resolve, reject) {
    const process = await exec(command);

    process.stdout.on("data", (data) => {
      console.log(data.toString());
    });

    process.stderr.on("data", (data) => {
      console.log(data.toString());
    });

    process.on("exit", (code) => {
      console.log(code?.toString());
      resolve(code);
    });
  });
}

export function checkFolderBySource(source, { home } = {}) {
  const predicate = source === "theme" ? hasThemeMarkers : hasRootMarkers;
  const cwd = process.cwd();

  if (predicate(cwd)) {
    return source === "theme" ? "theme" : "root";
  }

  const { dir, searched } = walkUp(cwd, predicate, { home });

  if (!dir) {
    const prefix =
      source === "theme" ? "TEMA MILLBODY" : "framework MILLBODY APP";
    const markers = describeExpectedMarkers(
      source === "theme" ? "theme" : "root"
    );
    throw new Error(
      `A pasta não corresponde a um ${prefix} para executar esse comando.\n` +
        `Marcadores esperados: ${markers}\n` +
        `Diretórios buscados: ${searched.join(", ")}`
    );
  }

  try {
    const realDir = fs.realpathSync(dir);
    const realCwd = fs.realpathSync(cwd);
    if (realDir !== realCwd) {
      process.chdir(dir);
      process.stderr.write(`[millbody] usando projeto em: ${dir}\n`);
    }
  } catch (err) {
    throw new Error(
      `Não foi possível mudar para o diretório: ${dir}\n${err.message}`
    );
  }

  return source === "theme" ? "theme" : "root";
}
