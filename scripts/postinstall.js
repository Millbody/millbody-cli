#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CI_ENV_VARS = [
  "CI",
  "CONTINUOUS_INTEGRATION",
  "GITHUB_ACTIONS",
  "TRAVIS",
  "CIRCLECI",
  "GITLAB_CI",
  "JENKINS_URL",
  "TEAMCITY_VERSION",
  "BUILDKITE",
  "DRONE",
];

export function shouldSkip(env, platform, pkgDir) {
  if (env.MILLBODY_SKIP_SETUP === "1" || env.MILLBODY_SKIP_SETUP === "true") {
    return "MILLBODY_SKIP_SETUP está definido";
  }

  for (const ciVar of CI_ENV_VARS) {
    if (env[ciVar] && env[ciVar] !== "0" && env[ciVar] !== "false") {
      return `ambiente CI detectado (${ciVar}=${env[ciVar]})`;
    }
  }

  if (platform !== "darwin") {
    return `plataforma não suportada para instalação automática: ${platform}`;
  }

  if (env.npm_config_global !== "true") {
    return "não é instalação global (npm_config_global não é 'true')";
  }

  if (env.INIT_CWD) {
    try {
      const initCwd = fs.realpathSync(env.INIT_CWD);
      const pkg = fs.realpathSync(pkgDir);
      if (initCwd === pkg) {
        return "instalação de desenvolvimento (INIT_CWD === pkgDir)";
      }
    } catch {
      // Se não for possível resolver realpath, pular por segurança
      return "não foi possível verificar INIT_CWD vs pkgDir";
    }
  }

  const getuid = typeof process.getuid === "function" ? process.getuid : null;
  if (getuid && getuid() === 0) {
    return "rodando como root (uid 0)";
  }

  return null;
}

export async function run({ env = process.env, platform = process.platform, pkgDir = PKG_DIR, runSetup, log = console.log } = {}) {
  const logPath = path.join(pkgDir, ".millbody-postinstall.log");

  const writelog = (msg) => {
    try {
      fs.appendFileSync(logPath, `${new Date().toISOString()} ${msg}\n`);
    } catch {
      // sem acesso ao log não interrompe
    }
    log(msg);
  };

  try {
    const reason = shouldSkip(env, platform, pkgDir);
    if (reason) {
      writelog(`[millbody postinstall] pulando setup: ${reason}`);
      return;
    }

    writelog("[millbody postinstall] iniciando setup automático...");

    let setupFn = runSetup;
    if (!setupFn) {
      const { default: setup } = await import("../src/commands/setup.js");
      setupFn = (opts) => setup(opts);
    }

    const killTimeout = setTimeout(() => {
      writelog("[millbody postinstall] timeout atingido (180s), encerrando...");
      process.exitCode = 0;
      process.kill(process.pid, "SIGKILL");
    }, 180000);
    if (typeof killTimeout.unref === "function") killTimeout.unref();

    const childEnv = {
      ...env,
      HOMEBREW_NO_AUTO_UPDATE: "1",
      NONINTERACTIVE: "1",
      COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
    };

    await setupFn({
      yes: true,
      dryRun: false,
      arch: undefined,
      project: undefined,
      projectDir: process.cwd(),
      env: childEnv,
    });

    clearTimeout(killTimeout);
    writelog("[millbody postinstall] setup concluído.");
  } catch (err) {
    try {
      fs.appendFileSync(logPath, `${new Date().toISOString()} [millbody postinstall] erro: ${err?.message ?? err}\n`);
    } catch {
      // sem acesso ao log
    }
    process.exitCode = 0;
  }
}

process.exitCode = 0;

process.on("uncaughtException", () => {
  process.exitCode = 0;
});

process.on("unhandledRejection", () => {
  process.exitCode = 0;
});

run();
