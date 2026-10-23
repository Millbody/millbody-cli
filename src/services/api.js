import fs from "fs";
import { pathToFileURL } from "url";

async function resolveConstants(rootFolder) {
  const candidates = [
    `${rootFolder}/mbCore/Constants.js`,
    `${rootFolder}/mbCore/Constants/index.js`,
  ];

  for (const candidate of candidates) {
    const url = pathToFileURL(candidate).href;
    try {
      const mod = await import(url);
      const constants = mod.constants ?? mod.default?.constants;
      if (!constants?.uri) {
        throw new Error(
          `Constants carregado de ${candidate} não expõe constants.uri`
        );
      }
      return constants;
    } catch (err) {
      if (err.code === "ERR_MODULE_NOT_FOUND" && err.message?.includes(url)) {
        continue;
      }
      throw err;
    }
  }

  throw new Error(
    `Não foi possível encontrar mbCore/Constants em ${rootFolder}: tentou Constants.js e Constants/index.js`
  );
}

async function readMillbodyJson(rootFolder) {
  const jsonPath = `${rootFolder}/mbCore/fastlane/keys/millbody.json`;
  let raw;
  try {
    raw = await fs.promises.readFile(jsonPath, "utf8");
  } catch (err) {
    throw new Error(`millbody.json não encontrado em ${jsonPath}: ${err.message}`);
  }

  const withoutBom = raw.replace(/^﻿/, "");
  try {
    return JSON.parse(withoutBom);
  } catch (err) {
    throw new SyntaxError(`JSON inválido em ${jsonPath}: ${err.message}`);
  }
}

export async function getAppAccount(account, rootFolder = process.cwd()) {
  const constants = await resolveConstants(rootFolder);
  const { uri } = constants;
  const ALDERAAN_API = `${uri}api/alderaan/v1/`;

  const { token } = await readMillbodyJson(rootFolder);

  const myHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  console.log(`consultando o setup do app na Millbody para ${account}`);

  let res;
  try {
    res = await globalThis.fetch(`${ALDERAAN_API}${account}/app/`, {
      headers: myHeaders,
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new Error(
      `Falha de rede ao consultar Millbody API: ${err.cause?.message ?? err.message}`
    );
  }

  if (!res.ok) {
    throw new Error(
      `Millbody API retornou ${res.status} ${res.statusText} para ${account}`
    );
  }

  return res.json();
}
