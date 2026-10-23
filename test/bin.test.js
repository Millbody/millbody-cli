import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
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

const packageJsonPath = path.resolve(here, "..", "package.json");

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

describe("[bin/millbody] ajuda e versão (processo filho em pasta vazia sem projeto)", () => {
  const sandbox = createSandbox("millbody-sandbox-bin-helpver-");
  let emptyDir;

  beforeEach(() => {
    emptyDir = sandbox.enter();
  });

  afterEach(() => {
    sandbox.leave();
  });

  it("--help deve sair com 0 e stdout deve conter 'millbody'", async () => {
    const result = await runBin(["--help"], { cwd: emptyDir });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /millbody/);
  });

  it("-h deve sair com 0 e stdout deve conter nomes de comandos", async () => {
    const result = await runBin(["-h"], { cwd: emptyDir });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /start/);
    assert.match(result.stdout, /create/);
  });

  it("create --help deve sair com 0 e stdout deve conter 'create'", async () => {
    const result = await runBin(["create", "--help"], { cwd: emptyDir });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /create/);
  });

  it("updateapp --help deve sair com 0 e stdout deve conter 'update-apk' (alias resolúvel)", async () => {
    const result = await runBin(["updateapp", "--help"], { cwd: emptyDir });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /update-apk/);
  });

  it("--version deve sair com 0 e stdout deve corresponder à versão do package.json", async () => {
    const pkg = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
    const result = await runBin(["--version"], { cwd: emptyDir });
    assert.equal(result.status, 0);
    assert.match(result.stdout, new RegExp(pkg.version.replace(".", "\\.")));
  });

  it("-v deve sair com 0", async () => {
    const result = await runBin(["-v"], { cwd: emptyDir });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\d+\.\d+\.\d+/);
  });

  it("foo --help deve sair com 1 e stderr deve conter 'Comando desconhecido' (A3)", async () => {
    const result = await runBin(["foo-inexistente-xyz", "--help"], { cwd: emptyDir });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Comando desconhecido/);
  });

  it("help deve sair com 0", async () => {
    const result = await runBin(["help"], { cwd: emptyDir });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /millbody/);
  });

  it("help create deve sair com 0 e stdout deve conter 'create'", async () => {
    const result = await runBin(["help", "create"], { cwd: emptyDir });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /create/);
  });

  it("help unknown-xyz deve sair com 1", async () => {
    const result = await runBin(["help", "unknown-xyz-cmd"], { cwd: emptyDir });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Comando desconhecido/);
  });

  it("help help deve sair com 0 e exibir ajuda geral (A3)", async () => {
    const result = await runBin(["help", "help"], { cwd: emptyDir });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /millbody/);
  });

  it("C1: constructor deve sair com 1 com 'Comando desconhecido' (prototype pollution)", async () => {
    const result = await runBin(["constructor"], { cwd: emptyDir });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Comando desconhecido/);
  });

  it("C1: toString deve sair com 1 com 'Comando desconhecido' (prototype pollution)", async () => {
    const result = await runBin(["toString"], { cwd: emptyDir });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Comando desconhecido/);
  });

  it("C1: __proto__ deve sair com 1 com 'Comando desconhecido' (prototype pollution)", async () => {
    const result = await runBin(["__proto__"], { cwd: emptyDir });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Comando desconhecido/);
  });
});
