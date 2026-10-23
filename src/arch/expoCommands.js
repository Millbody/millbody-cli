import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runScript } from "./runner.js";

export const EXPO_COMMAND_MAP = [
  { command: "start", script: "start" },
  { command: "run-ios", script: "ios" },
  { command: "run-android", script: "android" },
  { command: "update-apk", script: "millbody" },
  { command: "build-android", script: "predeploy:android" },
  { command: "build-ios", script: "predeploy:ios" },
  { command: "web", script: "web" },
  { command: "connect-alderaan", script: "connect-alderaan" },
  { command: "create", script: "millbody:create" },
  {
    command: "codepush",
    unsupported:
      "O comando codepush não tem equivalente no app-mobile (Expo SDK 57 usa EAS Update). Use millbody update-apk para atualizar o app.",
  },
  {
    command: "test",
    unsupported:
      "O comando test no app-mobile executa jest --watchAll (interativo) e não é adequado para uso via CLI. Execute diretamente no projeto.",
  },
];

const ACCOUNT_REGEX = /^[a-z0-9][a-z0-9_-]*$/i;

export function upsertEnvVar(content, key, value) {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const prefix = `${key}=`;
  let found = false;
  const updated = lines.map((line) => {
    if (line.startsWith(prefix)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) {
    const trimmed = normalized.trimEnd();
    return trimmed ? `${trimmed}\n${key}=${value}\n` : `${key}=${value}\n`;
  }
  return updated.join("\n");
}

async function writeEnvAccountAtomic(projectDir, account) {
  const envPath = path.join(projectDir, ".env.account");
  const existing = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8")
    : "";
  const updated = upsertEnvVar(existing, "EXPO_PUBLIC_ACCOUNT", account);
  const tmp = `${envPath}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, updated, "utf8");
  fs.renameSync(tmp, envPath);
}

export function makeExpoHandlers({ runScript: runScriptFn = runScript } = {}) {
  const handlers = {};

  for (const row of EXPO_COMMAND_MAP) {
    if (row.unsupported) {
      handlers[row.command] = async () => {
        console.error(row.unsupported);
        return 1;
      };
    } else if (row.command === "create") {
      handlers.create = async (options) => {
        const { account, projectDir } = options;
        if (!account) {
          console.error(
            "Ops! --account é obrigatório para o comando create no modo expo. Ex: millbody create --account minha-conta"
          );
          return 1;
        }
        if (!ACCOUNT_REGEX.test(account)) {
          console.error(
            `Conta inválida: "${account}". Use apenas letras, números, hifens e underscores (deve começar com letra ou número).`
          );
          return 1;
        }
        await writeEnvAccountAtomic(projectDir, account);
        return runScriptFn(projectDir, "millbody:create", [], options);
      };
    } else {
      const { script, command } = row;
      handlers[command] = async (options) => {
        const { projectDir } = options;
        return runScriptFn(projectDir, script, [], options);
      };
    }
  }

  return handlers;
}
