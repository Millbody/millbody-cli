import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  installExecMock,
  rootProject,
  themeProject,
  mockFetch,
} from "./helpers/world.js";
import { createSandbox, waitFor } from "./helpers/sandbox.js";

const shell = installExecMock();

const start = (await import("../src/commands/start.js")).default;
const codepush = (await import("../src/commands/codepush.js")).default;
const buildAndroid = (await import("../src/commands/buildAndroid.js")).default;
const runAndroid = (await import("../src/commands/runAndroid.js")).default;
const runIos = (await import("../src/commands/runIos.js")).default;
const testCommand = (await import("../src/commands/test.js")).default;
const create = (await import("../src/commands/create.js")).default;
const updateApk = (await import("../src/commands/updateApk.js")).default;

const sandbox = createSandbox("millbody-sandbox-commands-");
let logSpy;
let errorSpy;
let exitSpy;
let fetchSpy;

beforeEach(() => {
  shell.reset();
  logSpy = mock.method(console, "log", () => {});
  errorSpy = mock.method(console, "error", () => {});
  exitSpy = mock.method(process, "exit", () => {});
});

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 15));
  fetchSpy?.mock.restore();
  fetchSpy = undefined;
  logSpy.mock.restore();
  errorSpy.mock.restore();
  exitSpy.mock.restore();
  sandbox.leave();
});

const logged = () => logSpy.mock.calls.map((call) => call.arguments[0]);

describe("[commands] updateApk", () => {
  let root;

  beforeEach(() => {
    root = sandbox.enter(rootProject);
    fetchSpy = mockFetch({ themeName: "acme-theme" });
  });

  it("deve recusar pasta que não é raiz de projeto Millbody", async () => {
    fs.rmSync("mbCore", { recursive: true });
    await assert.rejects(updateApk({ account: "acme" }), /framework MILLBODY APP/);
  });

  it("deve avisar e não consultar a API sem --account", async () => {
    await updateApk({});
    assert.ok(logged().some((m) => /argumento --account/.test(m)));
    assert.equal(fetchSpy.mock.calls.length, 0);
    assert.equal(shell.commands().length, 0);
  });

  it("deve exibir a mensagem da API e parar quando ela retorna message", async () => {
    fetchSpy.mock.restore();
    fetchSpy = mockFetch({ message: "Sem permissão" });
    await updateApk({ account: "acme" });
    assert.ok(logged().includes("Sem permissão"));
    assert.equal(shell.commands().length, 0);
  });

  it("deve executar a sequência de comandos na ordem esperada", async () => {
    await updateApk({ account: "acme", track: "beta" });
    const themeFolder = `${root}/mbContent/themes/acme-theme`;
    const commands = shell.commands();
    assert.equal(commands.length, 7);
    assert.match(commands[0], new RegExp(`^cd ${themeFolder} && \\(git checkout master`));
    assert.match(commands[1], /^kill -9 /);
    assert.equal(commands[2], "killall Xcode");
    assert.equal(commands[3], `ttab "cd ${themeFolder}; millbody start"`);
    assert.equal(commands[4], `cd ${root}/ios && xed .`);
    assert.match(commands[5], /node millbodyapp\.config\.js .*git push origin acme$/);
  });

  it("deve usar fastlane beta quando track não é prod", async () => {
    await updateApk({ account: "acme" });
    const last = shell.commands().at(-1);
    assert.match(last, /fastlane beta theme_folder:acme-theme update_config:true/);
    assert.equal(last.includes("fastlane deploy"), false);
  });

  it("deve usar fastlane deploy no iOS e Android quando track é prod", async () => {
    await updateApk({ account: "acme", track: "prod" });
    assert.equal(shell.commands().at(-1).match(/fastlane deploy/g).length, 2);
  });

  it("deve registrar o progresso no console", async () => {
    await updateApk({ account: "acme" });
    assert.ok(logged().includes("Building iOS e Android..."));
    assert.ok(logged().includes("Fechando o Xcode..."));
  });

  it("deve propagar falhas da API", async () => {
    fetchSpy.mock.restore();
    fetchSpy = mockFetch(async () => ({ ok: false, status: 404, statusText: "Not Found" }));
    await assert.rejects(updateApk({ account: "acme" }), /404/);
    assert.equal(shell.commands().length, 0);
  });

  it(
    "deve encerrar o servidor react native na porta 8081",
    { todo: "BUG: kill -9 'lsof -t -i:8081' usa aspas simples e nunca mata o processo" },
    async () => {
      await updateApk({ account: "acme" });
      const kill = shell.commands().find((c) => c.startsWith("kill -9"));
      assert.match(kill, /\$\(lsof -t -i:8081\)|`lsof -t -i:8081`/);
    }
  );

  it(
    "não deve interpolar --account com metacaracteres de shell nos comandos",
    { todo: "BUG: injeção de comando via --account em updateApk.js" },
    async () => {
      await updateApk({ account: "x; touch /tmp/pwned" });
      assert.equal(shell.commands().some((c) => c.includes("; touch /tmp/pwned")), false);
    }
  );

  it(
    "não deve interpolar themeName com metacaracteres de shell nos comandos",
    { todo: "BUG: injeção de comando via themeName em updateApk.js" },
    async () => {
      fetchSpy.mock.restore();
      fetchSpy = mockFetch({ themeName: "t; touch /tmp/pwned" });
      await updateApk({ account: "acme" });
      assert.equal(shell.commands().some((c) => c.includes("; touch /tmp/pwned")), false);
    }
  );
});
