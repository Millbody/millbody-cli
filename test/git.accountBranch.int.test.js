import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { prepareAccountBranch } from "../src/git/accountBranch.js";
import { makeOriginAndClone } from "./helpers/gitRepo.js";

let repo;
let logs;

const run = (account = "demo", extra = {}) =>
  prepareAccountBranch({
    projectDir: repo.clone,
    account,
    execFile: repo.execFile,
    log: (m) => logs.push(m),
    ...extra,
  });

beforeEach(() => {
  repo = makeOriginAndClone();
  logs = [];
});

afterEach(() => repo.cleanup());

describe("[int] prepareAccountBranch com git real", () => {
  it("cria branch nova a partir de origin/main com SHA igual", async () => {
    const result = await run();
    assert.deepEqual(result, { branch: "accounts/demo", mode: "new" });
    assert.equal(repo.git("rev-parse", "HEAD"), repo.git("rev-parse", "origin/main"));
    assert.equal(repo.git("rev-parse", "--abbrev-ref", "HEAD"), "accounts/demo");
  });

  it("deixa branch.<b>.merge sem valor após mode=new", async () => {
    await run();
    assert.throws(() => repo.git("config", "--get", "branch.accounts/demo.merge"));
  });

  it("parte de origin/main quando main local está atrás", async () => {
    const remoteSha = repo.pushMainFromOther("remote.txt");
    await run();
    assert.equal(repo.git("rev-parse", "HEAD"), remoteSha);
    assert.notEqual(repo.git("rev-parse", "main"), remoteSha);
  });

  it("não inclui commits de main local à frente de origin/main", async () => {
    const originSha = repo.git("rev-parse", "origin/main");
    repo.commitFile("ahead.txt");
    await run();
    assert.equal(repo.git("rev-parse", "HEAD"), originSha);
  });

  it("parte de origin/main estando em outra branch", async () => {
    const originSha = repo.git("rev-parse", "origin/main");
    repo.git("switch", "-c", "feature/x");
    repo.commitFile("feature.txt");
    await run();
    assert.equal(repo.git("rev-parse", "HEAD"), originSha);
  });

  it("parte de origin/main estando em detached HEAD", async () => {
    const originSha = repo.git("rev-parse", "origin/main");
    repo.commitFile("detached.txt");
    repo.git("switch", "--detach", "HEAD");
    await run();
    assert.equal(repo.git("rev-parse", "HEAD"), originSha);
    assert.equal(repo.git("rev-parse", "--abbrev-ref", "HEAD"), "accounts/demo");
  });

  it("reaproveita branch local existente sem resetar", async () => {
    repo.git("switch", "-c", "accounts/demo");
    const localSha = repo.commitFile("work.txt");
    repo.git("switch", "main");
    const result = await run();
    assert.equal(result.mode, "local");
    assert.equal(repo.git("rev-parse", "HEAD"), localSha);
    assert.match(logs[0], /^Reaproveitando branch local accounts\/demo \(origin\/main: \+\d+\/-\d+\)\.$/);
  });

  it("rastreia branch existente apenas no remoto", async () => {
    repo.git("switch", "-c", "accounts/demo");
    const sha = repo.commitFile("remote-only.txt");
    repo.git("push", "origin", "accounts/demo");
    repo.git("switch", "main");
    repo.git("branch", "-D", "accounts/demo");
    repo.git("update-ref", "-d", "refs/remotes/origin/accounts/demo");
    const result = await run();
    assert.equal(result.mode, "remote");
    assert.equal(repo.git("rev-parse", "HEAD"), sha);
    assert.equal(repo.git("config", "--get", "branch.accounts/demo.merge"), "refs/heads/accounts/demo");
  });

  it("bloqueia com mudança rastreada não commitada", async () => {
    fs.writeFileSync(path.join(repo.clone, "README.md"), "changed\n");
    await assert.rejects(run(), /Working tree com mudanças não commitadas/);
    assert.equal(repo.git("rev-parse", "--abbrev-ref", "HEAD"), "main");
  });

  it("bloqueia com mudança staged", async () => {
    fs.writeFileSync(path.join(repo.clone, "new.txt"), "x");
    repo.git("add", "new.txt");
    await assert.rejects(run(), /Working tree com mudanças não commitadas/);
  });

  it("permite arquivos não rastreados", async () => {
    fs.writeFileSync(path.join(repo.clone, "untracked.txt"), "x");
    const result = await run();
    assert.equal(result.mode, "new");
    assert.ok(fs.existsSync(path.join(repo.clone, "untracked.txt")));
  });

  it("falha com mensagem clara quando o remoto não existe", async () => {
    repo.git("remote", "set-url", "origin", path.join(repo.root, "inexistente.git"));
    await assert.rejects(run(), /Não foi possível buscar origin\/main/);
  });

  it("falha quando não há remoto origin", async () => {
    repo.git("remote", "remove", "origin");
    await assert.rejects(run(), /Não foi possível buscar origin\/main/);
  });

  it("falha claro em repositório legado apenas com master", async () => {
    const legacy = makeOriginAndClone();
    try {
      legacy.git("branch", "-m", "main", "master");
      legacy.git("push", "origin", "master");
      legacy.gitIn(legacy.origin, "symbolic-ref", "HEAD", "refs/heads/master");
      legacy.git("push", "origin", "--delete", "main");
      await assert.rejects(
        prepareAccountBranch({
          projectDir: legacy.clone,
          account: "demo",
          execFile: legacy.execFile,
          log: () => {},
        }),
        /Não foi possível buscar origin\/main/
      );
    } finally {
      legacy.cleanup();
    }
  });

  it("rejeita diretório que não é repositório git", async () => {
    const plain = path.join(repo.root, "plain");
    fs.mkdirSync(plain);
    await assert.rejects(run("demo", { projectDir: plain }), /não é um repositório git/);
  });

  it("rejeita subdiretório que não é a raiz do repositório", async () => {
    const sub = path.join(repo.clone, "sub");
    fs.mkdirSync(sub);
    await assert.rejects(run("demo", { projectDir: sub }), /não é a raiz do repositório git/);
  });
});
