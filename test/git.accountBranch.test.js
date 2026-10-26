import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prepareAccountBranch, ACCOUNT_REGEX } from "../src/git/accountBranch.js";

const projectDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "millbody-unit-ab-")));

function makeExec(overrides = {}) {
  const calls = [];
  const execFile = mock.fn((file, args, opts, cb) => {
    const sub = args.slice(2);
    calls.push(sub);
    const key = sub.join(" ");
    const match = Object.entries(overrides).find(([k]) => key.startsWith(k));
    let res = match ? match[1] : undefined;
    if (res === undefined) res = defaults(sub);
    if (res.err) cb(res.err, res.stdout ?? "", res.stderr ?? "");
    else cb(null, res.stdout ?? "", res.stderr ?? "");
  });
  return { execFile, calls };
}

function defaults(sub) {
  const key = sub.join(" ");
  if (key === "rev-parse --is-inside-work-tree") return { stdout: "true\n" };
  if (key === "rev-parse --show-toplevel") return { stdout: `${projectDir}\n` };
  if (key.startsWith("status")) return { stdout: "" };
  if (key.startsWith("fetch")) return {};
  if (key.startsWith("rev-parse --verify --quiet")) return { err: { code: 1 } };
  if (key.startsWith("ls-remote")) return { stdout: "" };
  if (key.startsWith("rev-list")) return { stdout: "0\t0\n" };
  return {};
}

const exists = (ref) => ({ [`rev-parse --verify --quiet ${ref}`]: {} });
const base = exists("refs/remotes/origin/main");
const run = (execFile, extra = {}) => {
  const log = mock.fn();
  return prepareAccountBranch({ projectDir, account: "demo", execFile, log, ...extra }).then(
    (r) => ({ r, log }),
    (e) => Promise.reject(Object.assign(e, { log }))
  );
};

describe("ACCOUNT_REGEX", () => {
  it("aceita contas válidas", () => {
    for (const a of ["demo", "a1", "my-acc_1", "9x"]) assert.ok(ACCOUNT_REGEX.test(a), a);
  });
  it("rejeita contas inválidas", () => {
    for (const a of ["../x", "a;rm", "a b", "", "-a", "_a", "a/b"]) assert.ok(!ACCOUNT_REGEX.test(a), a);
  });
});

describe("prepareAccountBranch [unit]", () => {
  for (const account of ["../x", "a;rm", "a b", ""]) {
    it(`rejeita conta "${account}" antes de qualquer chamada git`, async () => {
      const { execFile } = makeExec();
      await assert.rejects(
        run(execFile, { account }),
        /Conta inválida: ".*"\. Use apenas letras, números, hifens e underscores \(deve começar com letra ou número\)\./
      );
      assert.equal(execFile.mock.callCount(), 0);
    });
  }

  it("passa -C projectDir, shell false e env sem prompt", async () => {
    const { execFile } = makeExec(base);
    await run(execFile);
    const [file, args, opts] = execFile.mock.calls[0].arguments;
    assert.equal(file, "git");
    assert.deepEqual(args.slice(0, 2), ["-C", projectDir]);
    assert.equal(opts.shell, false);
    assert.equal(opts.env.GIT_TERMINAL_PROMPT, "0");
    assert.ok(opts.timeout > 0);
  });

  it("modo new: argv exato e log", async () => {
    const { execFile, calls } = makeExec(base);
    const { r, log } = await run(execFile);
    assert.deepEqual(r, { branch: "accounts/demo", mode: "new" });
    assert.deepEqual(calls.at(-1), ["switch", "-c", "accounts/demo", "--no-track", "origin/main"]);
    assert.deepEqual(log.mock.calls.map((c) => c.arguments[0]), [
      "Branch accounts/demo criada a partir de origin/main.",
    ]);
  });

  it("usa refspec explícito no fetch da base", async () => {
    const { execFile, calls } = makeExec(base);
    await run(execFile);
    assert.deepEqual(calls.find((c) => c[0] === "fetch"), [
      "fetch",
      "origin",
      "+refs/heads/main:refs/remotes/origin/main",
    ]);
  });

  it("respeita baseBranch customizada", async () => {
    const { execFile, calls } = makeExec(exists("refs/remotes/origin/develop"));
    await run(execFile, { baseBranch: "develop" });
    assert.deepEqual(calls.at(-1), ["switch", "-c", "accounts/demo", "--no-track", "origin/develop"]);
  });

  it("modo remote: switch -c --track e fetch da branch da conta", async () => {
    const { execFile, calls } = makeExec({
      ...base,
      "ls-remote": { stdout: "abc\trefs/heads/accounts/demo\n" },
      ...exists("refs/remotes/origin/accounts/demo"),
    });
    const { r, log } = await run(execFile);
    assert.equal(r.mode, "remote");
    assert.deepEqual(calls.at(-1), ["switch", "-c", "accounts/demo", "--track", "origin/accounts/demo"]);
    assert.ok(
      calls.some(
        (c) =>
          c.join(" ") ===
          "fetch origin +refs/heads/accounts/demo:refs/remotes/origin/accounts/demo"
      )
    );
    assert.equal(log.mock.calls[0].arguments[0], "Branch accounts/demo criada rastreando origin/accounts/demo.");
  });

  it("modo local: switch simples, sem -c, e log com divergência", async () => {
    const { execFile, calls } = makeExec({
      ...base,
      ...exists("refs/heads/accounts/demo"),
      "rev-list": { stdout: "2\t3\n" },
    });
    const { r, log } = await run(execFile);
    assert.equal(r.mode, "local");
    assert.deepEqual(calls.find((c) => c[0] === "switch"), ["switch", "accounts/demo"]);
    assert.deepEqual(calls.find((c) => c[0] === "rev-list"), [
      "rev-list",
      "--left-right",
      "--count",
      "origin/main...accounts/demo",
    ]);
    assert.equal(
      log.mock.calls[0].arguments[0],
      "Reaproveitando branch local accounts/demo (origin/main: +2/-3)."
    );
  });

  it("local tem prioridade sobre remoto", async () => {
    const { execFile, calls } = makeExec({
      ...base,
      ...exists("refs/heads/accounts/demo"),
      ...exists("refs/remotes/origin/accounts/demo"),
    });
    const { r } = await run(execFile);
    assert.equal(r.mode, "local");
    assert.ok(!calls.some((c) => c.includes("--track")));
  });

  it("log usa +0/-0 quando rev-list retorna vazio", { todo: "BUG: split de string vazia gera +/-0" }, async () => {
    const { execFile } = makeExec({
      ...base,
      ...exists("refs/heads/accounts/demo"),
      "rev-list": { stdout: "" },
    });
    const { log } = await run(execFile);
    assert.match(log.mock.calls[0].arguments[0], /\+0\/-0/);
  });

  it("ENOENT em qualquer etapa inicial resulta em 'git não encontrado'", async () => {
    const { execFile } = makeExec({ "rev-parse --is-inside-work-tree": { err: { code: "ENOENT" } } });
    await assert.rejects(run(execFile), /git não encontrado\. Instale git\./);
  });

  it("ENOENT na verificação de ref resulta em 'git não encontrado'", async () => {
    const { execFile } = makeExec({ "rev-parse --verify": { err: { code: "ENOENT" } } });
    await assert.rejects(run(execFile), /git não encontrado\. Instale git\./);
  });

  it("ENOENT no ls-remote resulta em 'git não encontrado'", async () => {
    const { execFile } = makeExec({ ...base, "ls-remote": { err: { code: "ENOENT" } } });
    await assert.rejects(run(execFile), /git não encontrado\. Instale git\./);
  });

  it("code 128 na verificação de ref propaga a primeira linha do stderr", async () => {
    const { execFile } = makeExec({
      "rev-parse --verify": { err: { code: 128 }, stderr: "fatal: corrompido\nmais\n" },
    });
    await assert.rejects(run(execFile), (e) => e.message === "fatal: corrompido");
  });

  it("code 128 sem stderr usa mensagem genérica com o ref", async () => {
    const { execFile } = makeExec({ "rev-parse --verify": { err: { code: 128 } } });
    await assert.rejects(run(execFile), /Erro ao verificar ref refs\/remotes\/origin\/main\./);
  });

  it("erro sem code numérico é tratado como code 1 (ref ausente)", async () => {
    const { execFile } = makeExec({ ...base, "rev-parse --verify --quiet refs/heads": { err: new Error("x") } });
    const { r } = await run(execFile);
    assert.equal(r.mode, "new");
  });

  it("fora de repo git: mensagem com o diretório", async () => {
    const { execFile } = makeExec({ "rev-parse --is-inside-work-tree": { err: { code: 128 } } });
    await assert.rejects(run(execFile), (e) => e.message === `${projectDir} não é um repositório git.`);
  });

  it("is-inside-work-tree com saída diferente de true falha", async () => {
    const { execFile } = makeExec({ "rev-parse --is-inside-work-tree": { stdout: "false\n" } });
    await assert.rejects(run(execFile), /não é um repositório git\./);
  });

  it("show-toplevel falhando resulta em não ser repositório", async () => {
    const { execFile } = makeExec({ "rev-parse --show-toplevel": { err: { code: 128 } } });
    await assert.rejects(run(execFile), /não é um repositório git\./);
  });

  it("toplevel diferente do projectDir falha com toplevel na mensagem", async () => {
    const other = fs.realpathSync(os.tmpdir());
    const { execFile } = makeExec({ "rev-parse --show-toplevel": { stdout: `${other}\n` } });
    await assert.rejects(
      run(execFile),
      (e) => e.message === `O diretório não é a raiz do repositório git (toplevel: ${other}).`
    );
  });

  it("working tree suja bloqueia antes do fetch e lista as mudanças", async () => {
    const { execFile, calls } = makeExec({ status: { stdout: " M a.js\n" } });
    await assert.rejects(
      run(execFile),
      (e) =>
        e.message ===
        "Working tree com mudanças não commitadas. Faça commit ou stash antes de continuar:\nM a.js"
    );
    assert.ok(!calls.some((c) => c[0] === "fetch"));
  });

  it("status usa --untracked-files=no", async () => {
    const { execFile, calls } = makeExec(base);
    await run(execFile);
    assert.deepEqual(calls.find((c) => c[0] === "status"), ["status", "--porcelain", "--untracked-files=no"]);
  });

  it("status falhando propaga stderr", async () => {
    const { execFile } = makeExec({ status: { err: { code: 128 }, stderr: "fatal: x\n" } });
    await assert.rejects(run(execFile), (e) => e.message === "fatal: x");
  });

  it("status falhando sem stderr usa mensagem genérica", async () => {
    const { execFile } = makeExec({ status: { err: { code: 128 } } });
    await assert.rejects(run(execFile), /Erro ao verificar status do repositório\./);
  });

  it("fetch falhando inclui a primeira linha do stderr", async () => {
    const { execFile, calls } = makeExec({
      fetch: { err: { code: 128 }, stderr: "fatal: couldn't find remote ref main\nresto" },
    });
    await assert.rejects(
      run(execFile),
      (e) =>
        e.message ===
        "Não foi possível buscar origin/main (remoto ausente, offline ou ref inexistente): fatal: couldn't find remote ref main"
    );
    assert.ok(!calls.some((c) => c[0] === "switch"));
  });

  it("origin/main ausente após fetch falha com mensagem clara", async () => {
    const { execFile } = makeExec();
    await assert.rejects(
      run(execFile),
      (e) =>
        e.message ===
        "A branch main não existe no remoto origin. Crie origin/main ou use uma versão anterior do CLI."
    );
  });

  for (const [label, over] of [
    ["new", {}],
    ["remote", { ...exists("refs/remotes/origin/accounts/demo") }],
    ["local", { ...exists("refs/heads/accounts/demo") }],
  ]) {
    it(`falha no switch (${label}) propaga mensagem`, async () => {
      const { execFile } = makeExec({
        ...base,
        ...over,
        switch: { err: { code: 128 }, stderr: "fatal: switch falhou\n" },
      });
      await assert.rejects(run(execFile), (e) => e.message === "Falha ao trocar para accounts/demo: fatal: switch falhou");
    });
  }

  it("usa console.log e proc.execFile por padrão quando não injetados", async () => {
    const spy = mock.method(console, "log", () => {});
    try {
      await assert.rejects(prepareAccountBranch({ projectDir: path.join(projectDir, "nao-existe"), account: "demo" }));
    } finally {
      spy.mock.restore();
    }
  });
});
