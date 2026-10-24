import { resolveArch } from "../arch/detect.js";
import { evaluateRequirements, requirementsForAll } from "../requirements/requirements.js";
import { proc } from "../arch/proc.js";
import fs from "node:fs";

async function installRequirement(req, { execFile }) {
  const { autoInstall } = req;
  if (!autoInstall) throw new Error(`${req.name} não pode ser instalado automaticamente.`);

  if (autoInstall.method === "brew") {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        HOMEBREW_NO_AUTO_UPDATE: "1",
        NONINTERACTIVE: "1",
      };
      execFile("brew", ["install", autoInstall.formula], { env, timeout: 120000 }, (err) => {
        if (err) reject(new Error(`brew install ${autoInstall.formula} falhou: ${err.message}`));
        else resolve();
      });
    });
  }

  if (autoInstall.method === "brew-cask") {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        HOMEBREW_NO_AUTO_UPDATE: "1",
        NONINTERACTIVE: "1",
      };
      execFile("brew", ["install", autoInstall.formula], { env, timeout: 180000 }, (err) => {
        if (err) reject(new Error(`brew install ${autoInstall.formula} falhou: ${err.message}`));
        else resolve();
      });
    });
  }

  if (autoInstall.method === "corepack") {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
      };
      execFile("corepack", ["enable"], { env, timeout: 30000 }, (err) => {
        if (err) reject(new Error(`corepack enable falhou: ${err.message}`));
        else resolve();
      });
    });
  }

  if (autoInstall.method === "gem") {
    return new Promise((resolve, reject) => {
      execFile("gem", ["install", autoInstall.formula], { timeout: 120000 }, (err) => {
        if (err) reject(new Error(`gem install ${autoInstall.formula} falhou: ${err.message}`));
        else resolve();
      });
    });
  }

  throw new Error(`Método de instalação desconhecido: ${autoInstall.method}`);
}

function resolveRequirementSet(options) {
  if (options.allArchs) {
    return { reqs: requirementsForAll() };
  }
  const { arch } = resolveArch({
    archFlag: options.arch,
    projectDir: options.projectDir ?? options.project,
  });
  return { arch };
}

export default async function setup(options, deps = {}) {
  const {
    execFile = proc.execFile,
    existsSync = fs.existsSync,
    env = process.env,
    stdin = process.stdin,
    stdout = process.stdout,
  } = deps;

  const requirementSet = resolveRequirementSet(options);

  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  let ttabPath = null;
  try {
    ttabPath = require.resolve("ttab/bin/ttab");
  } catch {
    try {
      ttabPath = require.resolve("ttab");
    } catch {
      ttabPath = null;
    }
  }

  const results = await evaluateRequirements({
    ...requirementSet,
    deps: { execFile, existsSync, env, ttabPath },
  });

  const toInstall = results.filter((r) => !r.ok && r.req.autoInstallable);
  const cannotInstall = results.filter((r) => !r.ok && !r.req.autoInstallable && r.req.required);

  if (toInstall.length === 0 && cannotInstall.length === 0) {
    console.log("Todos os requisitos já estão satisfeitos.");
    return 0;
  }

  if (toInstall.length > 0) {
    console.log(`\nRequisitos a instalar automaticamente:`);
    for (const { req } of toInstall) {
      const method = req.autoInstall?.method ?? "";
      console.log(`  - ${req.name} (via ${method})`);
    }
  }

  if (cannotInstall.length > 0) {
    console.log(`\nRequisitos que precisam de instalação manual:`);
    for (const { req } of cannotInstall) {
      console.log(`  - ${req.name}: ${req.manualInstruction}`);
    }
  }

  if (options.dryRun) {
    console.log("\n[--dry-run] Nenhuma instalação executada.");
    return 0;
  }

  if (!options.yes && stdin.isTTY && stdout.isTTY) {
    const { confirm } = await import("@inquirer/prompts");
    const proceed = await confirm({
      message: "Deseja instalar os requisitos listados?",
      default: false,
    });
    if (!proceed) {
      console.log("Instalação cancelada.");
      return 0;
    }
  }

  let hadFailure = false;
  for (const { req } of toInstall) {
    console.log(`\nInstalando ${req.name}...`);
    try {
      await installRequirement(req, { execFile });
      console.log(`  ✓ ${req.name} instalado.`);
    } catch (err) {
      console.error(`  ✗ Falha ao instalar ${req.name}: ${err.message}`);
      hadFailure = true;
    }
  }

  if (hadFailure) {
    console.error("\nAlguns requisitos falharam ao instalar. Verifique os erros acima.");
    return 1;
  }

  if (cannotInstall.length > 0) {
    console.log("\nInstalação parcial concluída. Instale manualmente os itens acima.");
    return 1;
  }

  console.log("\nSetup concluído com sucesso.");
  return 0;
}
