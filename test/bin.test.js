import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createSandbox } from "./helpers/sandbox.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(here, "..", "bin", "millbody");
const preloadPath = path.resolve(here, "helpers", "exitPromptPreload.js");

function runBin(args, { cwd, nodeArgs = [] }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...nodeArgs, binPath, ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("bin/millbody excedeu o timeout"));
    }, 5000);
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

describe("[bin/millbody] entrypoint (processo filho em pasta vazia)", () => {
  const sandbox = createSandbox("millbody-sandbox-bin-");
  let emptyDir;

  beforeEach(() => {
    emptyDir = sandbox.enter();
  });

  afterEach(() => {
    sandbox.leave();
  });

  it("deve rodar o comando e recusar a pasta que não é um projeto Millbody", async () => {
    const result = await runBin(["start", "--source", "root"], { cwd: emptyDir });
    assert.match(result.stderr, /não corresponde ao framework MILLBODY APP/);
  });

  it("deve imprimir a mensagem e sair com 1 para opção desconhecida", async () => {
    const result = await runBin(["start", "--bogus"], { cwd: emptyDir });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown or unexpected option: --bogus/);
  });

  it("deve sair com 130 quando o prompt é cancelado (ExitPromptError)", async () => {
    const result = await runBin([], {
      cwd: emptyDir,
      nodeArgs: ["--import", preloadPath],
    });
    assert.equal(result.status, 130);
    assert.equal(result.stderr.includes("cancelado"), false);
  });
});
