import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import doctor, { renderDoctorTable } from "../src/commands/doctor.js";
import { makeExecFileFn } from "./helpers/processFake.js";
import { expoProject } from "./helpers/world.js";

let logSpy;
let errorSpy;
const created = [];

function makeFixture(files) {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "millbody-sandbox-doctor-"))
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
  logSpy = mock.method(console, "log", () => {});
  errorSpy = mock.method(console, "error", () => {});
});

afterEach(() => {
  logSpy.mock.restore();
  errorSpy.mock.restore();
  while (created.length) fs.rmSync(created.pop(), { recursive: true, force: true });
});

const allOkDeps = () => ({
  execFile: makeExecFileFn({
    "/usr/libexec/java_home": { stdout: "/j" },
    "/j/bin/java": { stderr: 'openjdk version "17"' },
    "xcode-select": { stdout: "/dev" },
  }),
  existsSync: () => true,
  env: { PATH: "/usr/bin", ANDROID_HOME: "/android" },
});

describe("[commands/doctor] renderDoctorTable", () => {
  it("renderiza cabeçalho e linhas com ✓/✗ e instrução", () => {
    const out = renderDoctorTable([
      { req: { name: "git", manualInstruction: "faça X" }, ok: true, detail: "" },
      { req: { name: "yarn", manualInstruction: "instale yarn" }, ok: false, detail: "" },
    ]);
    assert.match(out, /Requisito/);
    assert.match(out, /✓/);
    assert.match(out, /✗/);
    assert.match(out, /instale yarn/);
  });

  it("inclui o detalhe entre parênteses quando presente", () => {
    const out = renderDoctorTable([
      { req: { name: "ttab", manualInstruction: "x" }, ok: false, detail: "erro de disco" },
    ]);
    assert.match(out, /\(erro de disco\)/);
  });
});

describe("[commands/doctor] handler", () => {
  it("retorna 0 e confirma quando todos os requisitos estão satisfeitos", async () => {
    const dir = makeFixture(expoProject);
    const code = await doctor({ arch: "expo", projectDir: dir }, allOkDeps());
    assert.equal(code, 0);
    const logs = logSpy.mock.calls.map((c) => c.arguments[0]).join("\n");
    assert.match(logs, /Todos os requisitos obrigatórios/);
  });

  it("retorna 1 e lista faltantes quando um requisito obrigatório falta", async () => {
    const dir = makeFixture(expoProject);
    const deps = {
      execFile: makeExecFileFn({}),
      existsSync: () => false,
      env: {},
    };
    const code = await doctor({ arch: "expo", projectDir: dir }, deps);
    assert.equal(code, 1);
    const errs = errorSpy.mock.calls.map((c) => c.arguments[0]).join("\n");
    assert.match(errs, /Faltam \d+ requisito/);
  });

  it("é somente leitura: não invoca brew/corepack/gem durante a verificação", async () => {
    const dir = makeFixture(expoProject);
    const inner = makeExecFileFn({});
    const execFile = mock.fn((...a) => inner(...a));
    await doctor({ arch: "expo", projectDir: dir }, { execFile, existsSync: () => false, env: {} });
    const bins = execFile.mock.calls.map((c) => c.arguments[0]);
    for (const forbidden of ["brew", "corepack", "gem", "yarn", "npm"]) {
      assert.ok(!bins.includes(forbidden), `doctor não deve chamar ${forbidden}`);
    }
  });

  it("resolve a arquitetura por detecção quando --arch não é passado", async () => {
    const dir = makeFixture(expoProject);
    const code = await doctor({ projectDir: dir }, allOkDeps());
    assert.equal(code, 0);
  });
});
