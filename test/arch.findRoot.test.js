import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  findProjectRoot,
  walkUp,
  hasExpoMarker,
  hasLegacyMarker,
  hasThemeMarkers,
} from "../src/arch/detect.js";
import { createSandbox } from "./helpers/sandbox.js";

const expoFiles = (prefix = "") => ({
  [`${prefix}millbody.json`]: "{}",
  [`${prefix}app.config.ts`]: "export default {};",
});

describe("findProjectRoot — busca ascendente com home injetado", () => {
  const sandbox = createSandbox("millbody-findroot-");
  let root;

  afterEach(() => sandbox.leave());

  describe("descoberta a partir de subpasta", () => {
    it("deve subir de uma subpasta profunda e achar a raiz expo", () => {
      root = sandbox.enter({ ...expoFiles("proj/"), "proj/src/a/b": null });
      const result = findProjectRoot({
        startDir: path.join(root, "proj", "src", "a", "b"),
        home: root,
      });
      assert.equal(result.projectDir, path.join(root, "proj"));
      assert.equal(result.arch, "expo");
      assert.equal(result.searched.length, 4);
    });

    it("deve achar a raiz legacy a partir de subpasta", () => {
      root = sandbox.enter({ "proj/millbodyApp.json": "{}", "proj/sub": null });
      const result = findProjectRoot({ startDir: path.join(root, "proj", "sub"), home: root });
      assert.equal(result.projectDir, path.join(root, "proj"));
      assert.equal(result.arch, "legacy");
    });

    it("deve retornar o próprio startDir quando ele já é a raiz", () => {
      root = sandbox.enter(expoFiles());
      const result = findProjectRoot({ startDir: root, home: root });
      assert.equal(result.projectDir, root);
      assert.deepEqual(result.searched, [root]);
    });
  });

  describe("boundary em home", () => {
    it("deve parar em home e não achar marcador fora dele", () => {
      root = sandbox.enter({ "millbodyApp.json": "{}", "home/work/deep": null });
      const home = path.join(root, "home");
      assert.throws(
        () => findProjectRoot({ startDir: path.join(home, "work", "deep"), home }),
        /Projeto Millbody não encontrado/
      );
    });

    it("deve incluir home entre os diretórios buscados e não ir além", () => {
      root = sandbox.enter({ "home/work": null });
      const home = path.join(root, "home");
      const { dir, searched } = walkUp(path.join(home, "work"), () => false, { home });
      assert.equal(dir, null);
      assert.deepEqual(searched, [path.join(home, "work"), home]);
    });

    it("deve achar marcador no próprio home", () => {
      root = sandbox.enter({ "home/millbodyApp.json": "{}", "home/work": null });
      const home = path.join(root, "home");
      const result = findProjectRoot({ startDir: path.join(home, "work"), home });
      assert.equal(result.projectDir, home);
    });

    it("não deve encontrar marcador solto em ancestral acima do boundary", () => {
      root = sandbox.enter({ ...expoFiles(), "home/work": null });
      const home = path.join(root, "home");
      assert.throws(
        () => findProjectRoot({ startDir: path.join(home, "work"), archFlag: "expo", home }),
        /Diretórios buscados/
      );
    });
  });

  describe("arch flag e predicados", () => {
    it("EC04: dir ambíguo expo+legacy com archFlag legacy resolve legacy", () => {
      root = sandbox.enter({ ...expoFiles(), "millbodyApp.json": "{}" });
      assert.equal(hasExpoMarker(root), true);
      assert.equal(hasLegacyMarker(root), true);
      const result = findProjectRoot({ startDir: root, archFlag: "legacy", home: root });
      assert.equal(result.arch, "legacy");
      assert.equal(result.ambiguous, true);
    });

    it("EC05: theme folder (screens + millbodyApp.json) é legacy válido", () => {
      root = sandbox.enter({ "screens/.keep": "", "millbodyApp.json": "{}" });
      assert.equal(hasThemeMarkers(root), true);
      const result = findProjectRoot({ startDir: root, archFlag: "legacy", home: root });
      assert.equal(result.arch, "legacy");
      assert.equal(result.projectDir, root);
    });

    it("deve ignorar expo ancestral quando archFlag legacy e só há expo", () => {
      root = sandbox.enter({ ...expoFiles(), "sub": null });
      assert.throws(
        () => findProjectRoot({ startDir: path.join(root, "sub"), archFlag: "legacy", home: root }),
        /mbCore\/ ou millbodyApp\.json/
      );
    });
  });

  describe("EC06: fora de home", () => {
    it("deve falhar sem travar quando startDir está fora de home e sem marcadores", () => {
      root = sandbox.enter({ "outside/a/b": null, "home": null });
      const home = path.join(root, "home");
      assert.throws(
        () => findProjectRoot({ startDir: path.join(root, "outside", "a", "b"), home }),
        /Projeto Millbody não encontrado/
      );
    });

    it("walkUp deve retornar dir null para startDir inexistente", () => {
      root = sandbox.enter({});
      const result = walkUp(path.join(root, "nao-existe"), () => true, { home: root });
      assert.deepEqual(result, { dir: null, searched: [] });
    });

    it("walkUp deve tratar predicado que lança como não-match", () => {
      root = sandbox.enter({ "a": null });
      const result = walkUp(path.join(root, "a"), () => { throw new Error("x"); }, { home: root });
      assert.equal(result.dir, null);
    });
  });
});
