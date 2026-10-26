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

let shimDir, expoDir, legacyDir;
let logSeq = 0;

function freshLog() {
  return path.join(shimDir, `e2e-${++logSeq}.log`);
}

function readLog(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

before(() => {
  shimDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "millbody-e2e-shims-")));
  expoDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "millbody-e2e-expo-")));
  legacyDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "millbody-e2e-legacy-")));

  for (const name of ["yarn", "git", "npx", "react-native", "pod", "adb"]) {
    const shimPath = path.join(shimDir, name);
    fs.writeFileSync(
      shimPath,
      '#!/bin/sh\n[ -n "$MILLBODY_SHIM_LOG" ] && printf "argv=%s cwd=%s\\n" "$*" "$(pwd)" >> "$MILLBODY_SHIM_LOG"\n',
      { mode: 0o755 }
    );
  }

  fs.writeFileSync(
    path.join(expoDir, "millbody.json"),
    JSON.stringify({ account: "acme", android: { key: {} } })
  );
  fs.writeFileSync(path.join(expoDir, "app.config.ts"), "export default {};");
  fs.writeFileSync(
    path.join(expoDir, "package.json"),
    JSON.stringify({ name: "app-mobile", dependencies: { expo: "~57.0.0" } })
  );

  fs.writeFileSync(
    path.join(legacyDir, "millbodyApp.json"),
    JSON.stringify({ account: "acme" })
  );
  fs.mkdirSync(path.join(legacyDir, "screens"), { recursive: true });
  fs.writeFileSync(path.join(legacyDir, "screens", ".keep"), "");
});

after(() => {
  fs.rmSync(shimDir, { recursive: true, force: true });
  fs.rmSync(expoDir, { recursive: true, force: true });
  fs.rmSync(legacyDir, { recursive: true, force: true });
});

function runCli(args, { cwd, logFile } = {}) {
  return spawnSync(process.execPath, [binPath, ...args], {
    cwd: cwd ?? os.tmpdir(),
    env: {
      PATH: `${shimDir}:${nodeDir}`,
      MILLBODY_SHIM_LOG: logFile ?? "",
    },
    encoding: "utf8",
    timeout: 15000,
  });
}

function assertYarnCall(log, expectedScript, expectedCwd) {
  const escapedCwd = expectedCwd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    log,
    new RegExp(`argv=${expectedScript}`),
    `Expected yarn a ser chamado com '${expectedScript}', log: ${log}`
  );
  assert.match(
    log,
    new RegExp(`cwd=${escapedCwd}`),
    `Expected cwd=${expectedCwd}, log: ${log}`
  );
}

describe("[e2e] roteamento por arquitetura — expo com --project", () => {
  it("deve chamar 'yarn start' com cwd=expoDir para millbody start --project", () => {
    const logFile = freshLog();
    const result = runCli(["start", "--project", expoDir], { logFile });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assertYarnCall(readLog(logFile), "start", expoDir);
  });

  it("deve chamar 'yarn ios' com cwd=expoDir para millbody run-ios --project", () => {
    const logFile = freshLog();
    const result = runCli(["run-ios", "--project", expoDir], { logFile });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assertYarnCall(readLog(logFile), "ios", expoDir);
  });

  it("deve chamar 'yarn android' com cwd=expoDir para millbody run-android --project", () => {
    const logFile = freshLog();
    const result = runCli(["run-android", "--project", expoDir], { logFile });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assertYarnCall(readLog(logFile), "android", expoDir);
  });

  it("deve chamar 'yarn web' com cwd=expoDir para millbody web --project", () => {
    const logFile = freshLog();
    const result = runCli(["web", "--project", expoDir], { logFile });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assertYarnCall(readLog(logFile), "web", expoDir);
  });

  it("deve chamar 'yarn predeploy:android' com cwd=expoDir para millbody build-android --project", () => {
    const logFile = freshLog();
    const result = runCli(["build-android", "--project", expoDir], { logFile });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assertYarnCall(readLog(logFile), "predeploy:android", expoDir);
  });

  it("deve chamar 'yarn millbody' com cwd=expoDir para millbody update-apk --project", () => {
    const logFile = freshLog();
    const result = runCli(["update-apk", "--project", expoDir], { logFile });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assertYarnCall(readLog(logFile), "millbody", expoDir);
  });

  it("deve sair com código 1 e não chamar yarn para millbody codepush --project (unsupported)", () => {
    const logFile = freshLog();
    const result = runCli(["codepush", "--project", expoDir], { logFile });
    assert.equal(result.status, 1, `Expected exit code 1 para comando não suportado codepush`);
    const log = readLog(logFile);
    assert.ok(!log.includes("argv="), `Expected nenhuma chamada a yarn para codepush, log: ${log}`);
  });
});

describe("[e2e] roteamento por arquitetura — expo com --arch expo", () => {
  it("deve chamar 'yarn start' com cwd=expoDir quando --arch expo e cwd=expoDir", () => {
    const logFile = freshLog();
    const result = runCli(["start", "--arch", "expo"], { cwd: expoDir, logFile });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assertYarnCall(readLog(logFile), "start", expoDir);
  });

  it("deve chamar 'yarn android' com cwd=expoDir quando --arch expo e cwd=expoDir", () => {
    const logFile = freshLog();
    const result = runCli(["run-android", "--arch", "expo"], { cwd: expoDir, logFile });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assertYarnCall(readLog(logFile), "android", expoDir);
  });
});

describe("[e2e] roteamento por arquitetura — legado sem --project", () => {
  it("deve usar caminho legado (sem chamar yarn) para millbody start sem --project no diretório legado", () => {
    const logFile = freshLog();
    runCli(["start"], { cwd: legacyDir, logFile });
    const log = readLog(logFile);
    assert.ok(
      !log.includes("argv=start"),
      `Expected nenhuma chamada a 'yarn start' no caminho legado, log: ${log}`
    );
  });
});
