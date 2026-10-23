import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  EXPO_COMMAND_MAP,
  makeExpoHandlers,
  upsertEnvVar,
} from "../src/arch/expoCommands.js";

let logSpy;
let errorSpy;
const created = [];

function makeDir() {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "millbody-sandbox-expo-"))
  );
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

const errors = () => errorSpy.mock.calls.map((c) => c.arguments[0]);

describe("[arch/expoCommands] upsertEnvVar", () => {
  it("cria o par chave=valor em conteúdo vazio", () => {
    assert.equal(upsertEnvVar("", "EXPO_PUBLIC_ACCOUNT", "acme"), "EXPO_PUBLIC_ACCOUNT=acme\n");
  });

  it("preserva outras linhas ao adicionar a chave (EC06)", () => {
    const out = upsertEnvVar("FOO=bar\nBAZ=qux\n", "EXPO_PUBLIC_ACCOUNT", "acme");
    assert.match(out, /FOO=bar/);
    assert.match(out, /BAZ=qux/);
    assert.match(out, /EXPO_PUBLIC_ACCOUNT=acme/);
  });

  it("atualiza a chave existente sem duplicar", () => {
    const out = upsertEnvVar("EXPO_PUBLIC_ACCOUNT=old\nFOO=bar\n", "EXPO_PUBLIC_ACCOUNT", "new");
    assert.match(out, /EXPO_PUBLIC_ACCOUNT=new/);
    assert.doesNotMatch(out, /EXPO_PUBLIC_ACCOUNT=old/);
    assert.match(out, /FOO=bar/);
  });

  it("normaliza CRLF para LF", () => {
    const out = upsertEnvVar("FOO=bar\r\nBAZ=qux\r\n", "EXPO_PUBLIC_ACCOUNT", "acme");
    assert.doesNotMatch(out, /\r/);
  });

  it("substitui todas as ocorrências de chave duplicada", () => {
    const out = upsertEnvVar("EXPO_PUBLIC_ACCOUNT=a\nEXPO_PUBLIC_ACCOUNT=b\n", "EXPO_PUBLIC_ACCOUNT", "c");
    const occurrences = out.split("\n").filter((l) => l === "EXPO_PUBLIC_ACCOUNT=c");
    assert.equal(occurrences.length, 2);
    assert.doesNotMatch(out, /EXPO_PUBLIC_ACCOUNT=a|EXPO_PUBLIC_ACCOUNT=b/);
  });
});

describe("[arch/expoCommands] makeExpoHandlers — mapeamento comando→script", () => {
  const cases = [
    ["start", "start"],
    ["run-ios", "ios"],
    ["run-android", "android"],
    ["update-apk", "millbody"],
    ["build-android", "predeploy:android"],
    ["build-ios", "predeploy:ios"],
    ["web", "web"],
    ["connect-alderaan", "connect-alderaan"],
  ];

  for (const [command, script] of cases) {
    it(`${command} chama runScript com o script yarn "${script}"`, async () => {
      const runScript = mock.fn(async () => 0);
      const handlers = makeExpoHandlers({ runScript });
      const code = await handlers[command]({ projectDir: "/proj" });
      assert.equal(code, 0);
      assert.equal(runScript.mock.calls.length, 1);
      const [projectDir, calledScript, args] = runScript.mock.calls[0].arguments;
      assert.equal(projectDir, "/proj");
      assert.equal(calledScript, script);
      assert.deepEqual(args, []);
    });
  }

  it("propaga o exit code retornado pelo runScript", async () => {
    const runScript = mock.fn(async () => 7);
    const handlers = makeExpoHandlers({ runScript });
    assert.equal(await handlers.start({ projectDir: "/proj" }), 7);
  });
});

describe("[arch/expoCommands] comandos sem equivalente", () => {
  it("codepush imprime mensagem e retorna 1 sem rodar script", async () => {
    const runScript = mock.fn(async () => 0);
    const handlers = makeExpoHandlers({ runScript });
    const code = await handlers.codepush({ projectDir: "/proj" });
    assert.equal(code, 1);
    assert.equal(runScript.mock.calls.length, 0);
    assert.match(errors()[0], /codepush/);
  });

  it("test imprime mensagem e retorna 1 sem rodar script", async () => {
    const runScript = mock.fn(async () => 0);
    const handlers = makeExpoHandlers({ runScript });
    const code = await handlers.test({ projectDir: "/proj" });
    assert.equal(code, 1);
    assert.equal(runScript.mock.calls.length, 0);
  });
});

describe("[arch/expoCommands] create --account", () => {
  it("sem --account: erro, exit 1 e nada gravado", async () => {
    const runScript = mock.fn(async () => 0);
    const projectDir = makeDir();
    const handlers = makeExpoHandlers({ runScript });
    const code = await handlers.create({ projectDir });
    assert.equal(code, 1);
    assert.equal(runScript.mock.calls.length, 0);
    assert.equal(fs.existsSync(path.join(projectDir, ".env.account")), false);
    assert.match(errors()[0], /--account é obrigatório/);
  });

  it("conta inválida (regex): erro, exit 1 e nada gravado", async () => {
    const runScript = mock.fn(async () => 0);
    const projectDir = makeDir();
    const handlers = makeExpoHandlers({ runScript });
    for (const bad of ["-bad", "a b", "x;rm", "@acme"]) {
      errorSpy.mock.resetCalls();
      const code = await handlers.create({ projectDir, account: bad });
      assert.equal(code, 1, `"${bad}" deveria ser rejeitada`);
      assert.match(errors()[0], /Conta inválida/);
    }
    assert.equal(fs.existsSync(path.join(projectDir, ".env.account")), false);
    assert.equal(runScript.mock.calls.length, 0);
  });

  it("conta válida: grava EXPO_PUBLIC_ACCOUNT atomicamente e roda millbody:create", async () => {
    const runScript = mock.fn(async () => 0);
    const projectDir = makeDir();
    const handlers = makeExpoHandlers({ runScript });
    const code = await handlers.create({ projectDir, account: "Acme_01" });
    assert.equal(code, 0);
    const content = fs.readFileSync(path.join(projectDir, ".env.account"), "utf8");
    assert.match(content, /EXPO_PUBLIC_ACCOUNT=Acme_01/);
    assert.equal(fs.existsSync(path.join(projectDir, `.env.account.tmp.${process.pid}`)), false);
    const [dir, script] = runScript.mock.calls[0].arguments;
    assert.equal(dir, projectDir);
    assert.equal(script, "millbody:create");
  });

  it("preserva outras chaves do .env.account existente (EC06)", async () => {
    const runScript = mock.fn(async () => 0);
    const projectDir = makeDir();
    fs.writeFileSync(
      path.join(projectDir, ".env.account"),
      "FOO=bar\r\nEXPO_PUBLIC_ACCOUNT=old\r\n",
      "utf8"
    );
    const handlers = makeExpoHandlers({ runScript });
    await handlers.create({ projectDir, account: "nova" });
    const content = fs.readFileSync(path.join(projectDir, ".env.account"), "utf8");
    assert.match(content, /FOO=bar/);
    assert.match(content, /EXPO_PUBLIC_ACCOUNT=nova/);
    assert.doesNotMatch(content, /EXPO_PUBLIC_ACCOUNT=old/);
    assert.doesNotMatch(content, /\r/);
  });
});

describe("[arch/expoCommands] EXPO_COMMAND_MAP integridade", () => {
  it("toda linha tem command e (script XOR unsupported)", () => {
    for (const row of EXPO_COMMAND_MAP) {
      assert.ok(typeof row.command === "string" && row.command.length > 0);
      const hasScript = typeof row.script === "string";
      const hasUnsupported = typeof row.unsupported === "string";
      assert.ok(hasScript !== hasUnsupported, `linha "${row.command}" deve ter script OU unsupported`);
    }
  });

  it("makeExpoHandlers usa runScript real quando nenhum é injetado", () => {
    const handlers = makeExpoHandlers();
    assert.equal(typeof handlers.start, "function");
  });
});
