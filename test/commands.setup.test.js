import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeExecFileFn } from "./helpers/processFake.js";
import { expoProject } from "./helpers/world.js";

let confirmImpl = async () => false;
mock.module("@inquirer/prompts", {
  namedExports: { confirm: (...args) => confirmImpl(...args) },
});

const setup = (await import("../src/commands/setup.js")).default;

let logSpy;
let errorSpy;
const created = [];

function makeFixture(files) {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "millbody-sandbox-setup-"))
  );
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(dir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
  }
  created.push(dir);
  return dir;
}

beforeEach(() => {
  confirmImpl = async () => false;
  logSpy = mock.method(console, "log", () => {});
  errorSpy = mock.method(console, "error", () => {});
});

afterEach(() => {
  logSpy.mock.restore();
  errorSpy.mock.restore();
  while (created.length) fs.rmSync(created.pop(), { recursive: true, force: true });
});

const logs = () => logSpy.mock.calls.map((c) => c.arguments[0]).join("\n");
const errs = () => errorSpy.mock.calls.map((c) => c.arguments[0]).join("\n");
const noTTY = { stdin: { isTTY: false }, stdout: { isTTY: false } };

const allOkDeps = (extra = {}) => ({
  execFile: makeExecFileFn({
    "/usr/libexec/java_home": { stdout: "/j" },
    "/j/bin/java": { stderr: 'openjdk version "17"' },
    "xcode-select": { stdout: "/dev" },
  }),
  existsSync: () => true,
  env: { PATH: "/usr/bin", ANDROID_HOME: "/android" },
  ...noTTY,
  ...extra,
});

const missingWithInstaller = (brewResult = { stdout: "" }) => {
  const inner = makeExecFileFn({ brew: brewResult, corepack: { stdout: "" } });
  const execFile = mock.fn((...a) => inner(...a));
  return {
    execFile,
    deps: {
      execFile,
      existsSync: () => false,
      env: {},
      ...noTTY,
    },
  };
};

describe("[commands/setup]", () => {
  it("retorna 0 quando tudo já está satisfeito", async () => {
    const dir = makeFixture(expoProject);
    const code = await setup({ arch: "expo", projectDir: dir }, allOkDeps());
    assert.equal(code, 0);
    assert.match(logs(), /Todos os requisitos já estão satisfeitos/);
  });

  it("--dry-run lista o plano e não executa instaladores", async () => {
    const dir = makeFixture(expoProject);
    const { execFile, deps } = missingWithInstaller();
    const code = await setup({ arch: "expo", projectDir: dir, dryRun: true }, deps);
    assert.equal(code, 0);
    assert.match(logs(), /\[--dry-run\]/);
    const bins = execFile.mock.calls.map((c) => c.arguments[0]);
    for (const forbidden of ["brew", "corepack", "gem"]) {
      assert.ok(!bins.includes(forbidden), `dry-run não deve chamar ${forbidden}`);
    }
  });

  it("--yes instala auto-instaláveis e retorna 1 por pendências manuais", async () => {
    const dir = makeFixture(expoProject);
    const { execFile, deps } = missingWithInstaller();
    const code = await setup({ arch: "expo", projectDir: dir, yes: true }, deps);
    assert.equal(code, 1);
    const bins = execFile.mock.calls.map((c) => c.arguments[0]);
    assert.ok(bins.includes("brew"), "deve chamar brew install");
    assert.ok(bins.includes("corepack"), "deve chamar corepack para yarn");
    assert.match(logs(), /instalação manual/i);
  });

  it("reporta falha de instalação e retorna 1", async () => {
    const dir = makeFixture(expoProject);
    const { deps } = missingWithInstaller({ error: new Error("rede") });
    const code = await setup({ arch: "expo", projectDir: dir, yes: true }, deps);
    assert.equal(code, 1);
    assert.match(errs(), /Falha ao instalar/);
  });

  it("em TTY sem --yes pede confirmação; recusa cancela sem instalar", async () => {
    const dir = makeFixture(expoProject);
    confirmImpl = async () => false;
    const { execFile, deps } = missingWithInstaller();
    const code = await setup(
      { arch: "expo", projectDir: dir },
      { ...deps, stdin: { isTTY: true }, stdout: { isTTY: true } }
    );
    assert.equal(code, 0);
    assert.match(logs(), /Instalação cancelada/);
    const bins = execFile.mock.calls.map((c) => c.arguments[0]);
    assert.ok(!bins.includes("brew"));
  });

  it("em TTY sem --yes com confirmação positiva executa instaladores", async () => {
    const dir = makeFixture(expoProject);
    confirmImpl = async () => true;
    const { execFile, deps } = missingWithInstaller();
    await setup(
      { arch: "expo", projectDir: dir },
      { ...deps, stdin: { isTTY: true }, stdout: { isTTY: true } }
    );
    const bins = execFile.mock.calls.map((c) => c.arguments[0]);
    assert.ok(bins.includes("brew"));
  });

  it("não engole ExitPromptError (Ctrl+C no prompt)", async () => {
    const dir = makeFixture(expoProject);
    const err = new Error("cancelado");
    err.name = "ExitPromptError";
    confirmImpl = async () => {
      throw err;
    };
    const { deps } = missingWithInstaller();
    await assert.rejects(
      setup(
        { arch: "expo", projectDir: dir },
        { ...deps, stdin: { isTTY: true }, stdout: { isTTY: true } }
      ),
      /cancelado/
    );
  });
});

describe("[commands/setup] trilha allArchs", () => {
  it("não lança em diretório vazio — resolveArch não é chamado", async () => {
    const emptyDir = makeFixture({});
    await assert.doesNotReject(
      setup({ allArchs: true, yes: true, dryRun: true }, allOkDeps())
    );
  });

  it("tenta instalar fórmulas de ambas as archs (watchman e fastlane)", async () => {
    const inner = makeExecFileFn({
      brew: { stdout: "" },
      corepack: { stdout: "" },
      "/usr/libexec/java_home": { error: new Error("no jdk") },
      java: { error: new Error("no java") },
      "xcode-select": { error: new Error("not found") },
    });
    const execFile = mock.fn((...a) => inner(...a));
    const code = await setup(
      { allArchs: true, yes: true },
      {
        execFile,
        existsSync: () => false,
        env: {},
        ...noTTY,
      }
    );
    const brewArgs = execFile.mock.calls
      .filter((c) => c.arguments[0] === "brew")
      .map((c) => c.arguments[1]);
    const formulae = brewArgs.flat();
    assert.ok(formulae.includes("watchman"), "watchman (expo) deve ser instalado");
    assert.ok(formulae.includes("fastlane"), "fastlane (legacy) deve ser instalado");
    assert.ok(code >= 0);
  });

  it("EC01: brew falha, corepack roda, retorna 1", async () => {
    const inner = makeExecFileFn({
      brew: { error: new Error("brew indisponível") },
      corepack: { stdout: "" },
      "/usr/libexec/java_home": { error: new Error("no jdk") },
      java: { error: new Error("no java") },
      "xcode-select": { error: new Error("not found") },
    });
    const execFile = mock.fn((...a) => inner(...a));
    const code = await setup(
      { allArchs: true, yes: true },
      {
        execFile,
        existsSync: () => false,
        env: {},
        ...noTTY,
      }
    );
    assert.equal(code, 1);
    const bins = execFile.mock.calls.map((c) => c.arguments[0]);
    assert.ok(bins.includes("corepack"), "corepack deve ter sido invocado mesmo com brew falhando");
  });
});

describe("[commands/setup] regressão: resolveArch lança em dir sem marcadores", () => {
  it("setup sem allArchs em dir vazio lança erro de arquitetura", async () => {
    const emptyDir = makeFixture({});
    await assert.rejects(
      setup({ projectDir: emptyDir }, allOkDeps()),
      /Projeto Millbody não encontrado/
    );
  });
});
