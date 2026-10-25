import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(here, "..", "bin", "millbody");
const nodeDir = path.dirname(process.execPath);

let base, shimDir, homeDir, emptyDir, expoSub, legacySub;

function mkdir(...parts) {
  const dir = path.join(base, ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

before(() => {
  base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "millbody-e2e-root-")));
  shimDir = mkdir("shims");
  homeDir = mkdir("home");
  emptyDir = mkdir("home", "empty");

  for (const name of ["yarn", "git", "npx", "react-native", "pod", "adb"]) {
    fs.writeFileSync(path.join(shimDir, name), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  }

  const expoRoot = mkdir("home", "expo");
  fs.writeFileSync(path.join(expoRoot, "millbody.json"), JSON.stringify({ account: "acme" }));
  fs.writeFileSync(path.join(expoRoot, "app.config.ts"), "export default {};");
  fs.writeFileSync(
    path.join(expoRoot, "package.json"),
    JSON.stringify({ name: "app", dependencies: { expo: "~57.0.0" } })
  );
  expoSub = mkdir("home", "expo", "src", "deep");

  const legacyRoot = mkdir("home", "legacy");
  fs.writeFileSync(path.join(legacyRoot, "millbodyApp.json"), JSON.stringify({ account: "acme" }));
  fs.mkdirSync(path.join(legacyRoot, "screens"));
  legacySub = mkdir("home", "legacy", "screens", "nested");
});

after(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

function runCli(args, cwd) {
  return spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    env: { PATH: `${shimDir}:${nodeDir}`, HOME: homeDir },
    encoding: "utf8",
    timeout: 20000,
  });
}

describe("[e2e] detecção de raiz — falhas fora de projeto", () => {
  it("start em dir vazio deve sair com status 1 e listar marcadores esperados", () => {
    const result = runCli(["start"], emptyDir);
    assert.equal(result.status, 1, `stdout: ${result.stdout} stderr: ${result.stderr}`);
    assert.match(result.stdout + result.stderr, /Marcadores esperados/);
  });

  it("run-ios --arch expo em dir sem marcadores deve sair com status 1", () => {
    const result = runCli(["run-ios", "--arch", "expo"], emptyDir);
    assert.equal(result.status, 1, `stdout: ${result.stdout} stderr: ${result.stderr}`);
  });

  it("start --arch expo em dir sem marcadores deve sair com status 1", () => {
    const result = runCli(["start", "--arch", "expo"], emptyDir);
    assert.equal(result.status, 1);
  });
});

describe("[e2e] detecção de raiz — descoberta ascendente", () => {
  it("doctor a partir de subpasta expo deve descobrir a raiz e rodar", () => {
    const result = runCli(["doctor"], expoSub);
    const output = result.stdout + result.stderr;
    assert.doesNotMatch(output, /Projeto Millbody não encontrado/);
    assert.match(output, /arquitetura: expo/);
    assert.ok(output.includes(`Projeto: ${path.join(homeDir, "expo")}`), output);
  });

  it("doctor a partir de subpasta legacy deve descobrir a raiz e rodar", () => {
    const result = runCli(["doctor"], legacySub);
    const output = result.stdout + result.stderr;
    assert.doesNotMatch(output, /Projeto Millbody não encontrado/);
    assert.match(output, /arquitetura: legacy/);
    assert.ok(output.includes(`Projeto: ${path.join(homeDir, "legacy")}`), output);
  });
});

describe("[e2e] detecção de raiz — comandos independentes de projeto", () => {
  it("setup --all --dry-run em dir vazio deve sair com status 0", () => {
    const result = runCli(["setup", "--all", "--dry-run"], emptyDir);
    assert.equal(result.status, 0, `stdout: ${result.stdout} stderr: ${result.stderr}`);
  });

  for (const args of [["--help"], ["--version"], ["help", "start"]]) {
    it(`${args.join(" ")} em dir vazio deve sair com status 0`, () => {
      const result = runCli(args, emptyDir);
      assert.equal(result.status, 0, `stdout: ${result.stdout} stderr: ${result.stderr}`);
      assert.ok(result.stdout.length > 0);
    });
  }
});
