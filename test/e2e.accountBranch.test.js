import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { makeOriginAndClone } from "./helpers/gitRepo.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(here, "..", "bin", "millbody");
const nodeDir = path.dirname(process.execPath);
const gitDir = path.dirname(
  execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim()
);

let repo;
let shimDir;
let logFile;

before(() => {
  repo = makeOriginAndClone();
  shimDir = path.join(repo.root, "shims");
  fs.mkdirSync(shimDir);
  logFile = path.join(shimDir, "yarn.log");
  fs.writeFileSync(
    path.join(shimDir, "yarn"),
    '#!/bin/sh\nprintf "argv=%s cwd=%s\\n" "$*" "$(pwd)" >> "$MILLBODY_SHIM_LOG"\n',
    { mode: 0o755 }
  );
  fs.writeFileSync(path.join(repo.clone, "millbody.json"), JSON.stringify({ account: "acme" }));
  fs.writeFileSync(path.join(repo.clone, "app.config.ts"), "export default {};");
  fs.writeFileSync(
    path.join(repo.clone, "package.json"),
    JSON.stringify({ name: "app-mobile", dependencies: { expo: "~57.0.0" } })
  );
  repo.git("add", ".");
  repo.git("commit", "-m", "expo markers");
  repo.git("push", "origin", "main");
});

after(() => repo.cleanup());

function runCreate(account = "demo") {
  return spawnSync(process.execPath, [binPath, "create", "--account", account, "--project", repo.clone], {
    cwd: repo.root,
    env: {
      ...repo.env,
      PATH: `${shimDir}:${nodeDir}:${gitDir}`,
      MILLBODY_SHIM_LOG: logFile,
    },
    encoding: "utf8",
    timeout: 30000,
  });
}

describe("[e2e] create cria branch accounts/<conta> (CA02)", () => {
  it("primeira execução cria accounts/demo a partir de origin/main", () => {
    const result = runCreate();
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.equal(repo.git("rev-parse", "--abbrev-ref", "HEAD"), "accounts/demo");
    assert.equal(repo.git("rev-parse", "HEAD"), repo.git("rev-parse", "origin/main"));
    assert.match(result.stdout, /Branch accounts\/demo criada a partir de origin\/main\./);
    assert.match(fs.readFileSync(logFile, "utf8"), /argv=millbody:create/);
    assert.match(fs.readFileSync(path.join(repo.clone, ".env.account"), "utf8"), /EXPO_PUBLIC_ACCOUNT=demo/);
  });

  it("segunda execução reaproveita a branch existente", () => {
    repo.git("switch", "main");
    const result = runCreate();
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.equal(repo.git("rev-parse", "--abbrev-ref", "HEAD"), "accounts/demo");
    assert.match(result.stdout, /Reaproveitando branch local accounts\/demo/);
  });

  it("conta inválida falha sem alterar a branch", () => {
    repo.git("switch", "main");
    const result = runCreate("a;rm");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Conta inválida/);
    assert.equal(repo.git("rev-parse", "--abbrev-ref", "HEAD"), "main");
  });
});
