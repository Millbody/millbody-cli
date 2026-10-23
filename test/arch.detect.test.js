import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectArchitecture, resolveArch, ARCHS } from "../src/arch/detect.js";
import {
  expoProject,
  expoProjectAppJson,
  ambiguousProject,
  legacyThemeProject,
  rootProject,
} from "./helpers/world.js";

const created = [];

function makeFixture(files = {}) {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "millbody-sandbox-detect-"))
  );
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(dir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (content === null) fs.mkdirSync(target, { recursive: true });
    else fs.writeFileSync(target, content, "utf8");
  }
  created.push(dir);
  return dir;
}

afterEach(() => {
  while (created.length) {
    const dir = created.pop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("[arch/detect] ARCHS", () => {
  it("deve exportar exatamente expo e legacy", () => {
    assert.deepEqual(ARCHS, ["expo", "legacy"]);
  });
});

describe("[arch/detect] detectArchitecture", () => {
  it("detecta expo via app.config.ts + millbody.json", () => {
    const result = detectArchitecture(makeFixture(expoProject));
    assert.deepEqual(result, {
      arch: "expo",
      reason: "expo-marker-found",
      ambiguous: false,
    });
  });

  it("detecta expo via app.json com chave expo", () => {
    const result = detectArchitecture(makeFixture(expoProjectAppJson));
    assert.equal(result.arch, "expo");
    assert.equal(result.ambiguous, false);
  });

  it("detecta expo via app.config.js", () => {
    const dir = makeFixture({
      "millbody.json": "{}",
      "app.config.js": "module.exports = {};",
    });
    assert.equal(detectArchitecture(dir).arch, "expo");
  });

  it("detecta expo via devDependencies.expo quando não há app config", () => {
    const dir = makeFixture({
      "millbody.json": "{}",
      "package.json": JSON.stringify({ devDependencies: { expo: "~57.0.0" } }),
    });
    assert.equal(detectArchitecture(dir).arch, "expo");
  });

  it("detecta legacy via mbCore + millbodyApp.json", () => {
    const result = detectArchitecture(makeFixture(rootProject));
    assert.deepEqual(result, {
      arch: "legacy",
      reason: "legacy-marker-found",
      ambiguous: false,
    });
  });

  it("detecta legacy via millbodyApp.json isolado (modo theme)", () => {
    assert.equal(detectArchitecture(makeFixture(legacyThemeProject)).arch, "legacy");
  });

  it("retorna null quando nenhum marcador existe", () => {
    const result = detectArchitecture(makeFixture({ "readme.txt": "x" }));
    assert.deepEqual(result, {
      arch: null,
      reason: "no-marker-found",
      ambiguous: false,
    });
  });

  it("marca ambíguo e dá precedência ao expo quando há marcadores dos dois", () => {
    const result = detectArchitecture(makeFixture(ambiguousProject));
    assert.deepEqual(result, {
      arch: "expo",
      reason: "expo-marker-takes-precedence",
      ambiguous: true,
    });
  });

  it("não classifica como expo quando só há millbody.json sem marcador expo (EC03)", () => {
    const dir = makeFixture({ "millbody.json": JSON.stringify({ account: "a" }) });
    assert.equal(detectArchitecture(dir).arch, null);
  });

  it("é fail-safe quando app.json está malformado (não lança, cai para null)", () => {
    const dir = makeFixture({
      "millbody.json": "{}",
      "app.json": "{ isto não é json válido",
    });
    assert.doesNotThrow(() => detectArchitecture(dir));
    assert.equal(detectArchitecture(dir).arch, null);
  });

  it("é fail-safe quando package.json está malformado", () => {
    const dir = makeFixture({
      "millbody.json": "{}",
      "package.json": "{ quebrado",
    });
    assert.doesNotThrow(() => detectArchitecture(dir));
    assert.equal(detectArchitecture(dir).arch, null);
  });
});

describe("[arch/detect] resolveArch", () => {
  it("--arch força a arquitetura e normaliza para minúsculas (bypass da detecção)", () => {
    const dir = makeFixture({ "readme.txt": "x" });
    const result = resolveArch({ archFlag: "EXPO", projectDir: dir });
    assert.equal(result.arch, "expo");
    assert.equal(result.projectDir, dir);
  });

  it("--arch inválido lança erro claro", () => {
    const dir = makeFixture({});
    assert.throws(
      () => resolveArch({ archFlag: "nativo", projectDir: dir }),
      /Arquitetura inválida/
    );
  });

  it("projectDir inexistente lança erro claro", () => {
    assert.throws(
      () => resolveArch({ projectDir: "/caminho/que/nao/existe/xyz" }),
      /não encontrado/
    );
  });

  it("projectDir apontando para arquivo (não diretório) lança erro", () => {
    const dir = makeFixture({ "arquivo.txt": "conteudo" });
    assert.throws(
      () => resolveArch({ projectDir: path.join(dir, "arquivo.txt") }),
      /deve ser um diretório/
    );
  });

  it("detecta a arquitetura quando --arch não é passado", () => {
    const dir = makeFixture(expoProject);
    const result = resolveArch({ projectDir: dir });
    assert.equal(result.arch, "expo");
    assert.ok(path.isAbsolute(result.projectDir));
  });

  it("lança quando não detecta e --arch não foi passado", () => {
    const dir = makeFixture({ "readme.txt": "x" });
    assert.throws(
      () => resolveArch({ projectDir: dir }),
      /Não foi possível detectar a arquitetura/
    );
  });

  it("resolve caminho relativo para absoluto (EC01)", () => {
    const dir = makeFixture(legacyThemeProject);
    const originalCwd = process.cwd();
    process.chdir(path.dirname(dir));
    try {
      const result = resolveArch({ projectDir: path.basename(dir) });
      assert.equal(result.projectDir, dir);
      assert.ok(path.isAbsolute(result.projectDir));
    } finally {
      process.chdir(originalCwd);
    }
  });
});
