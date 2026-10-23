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

describe("[commands] create", () => {
  let root;

  beforeEach(() => {
    root = sandbox.enter(rootProject);
    fetchSpy = mockFetch({ themeName: "acme-theme", account: "acme" });
  });

  const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
  const isReadable = (file) => {
    try {
      readJson(file);
      return true;
    } catch {
      return false;
    }
  };

  it("deve recusar pasta que não é raiz de projeto Millbody", async () => {
    fs.rmSync("mbCore", { recursive: true });
    await create({ account: "acme" }).catch(() => {});
    assert.equal(exitSpy.mock.calls.length >= 1, true);
    assert.match(errorSpy.mock.calls[0].arguments[0], /framework MILLBODY APP/);
  });

  it("deve avisar e não consultar a API sem --account", async () => {
    await create({});
    assert.ok(logged().some((m) => /argumento --account/.test(m)));
    assert.equal(fetchSpy.mock.calls.length, 0);
    assert.equal(shell.commands().length, 0);
  });

  it("deve exibir a mensagem da API e parar quando ela retorna message", async () => {
    fetchSpy.mock.restore();
    fetchSpy = mockFetch({ message: "Conta não encontrada" });
    await create({ account: "acme" });
    assert.ok(logged().includes("Conta não encontrada"));
    assert.equal(shell.commands().length, 0);
    assert.deepEqual(readJson("millbodyApp.json"), { account: "acme" });
  });

  it("deve consultar a API com a conta informada", async () => {
    await create({ account: "acme" });
    assert.equal(
      fetchSpy.mock.calls[0].arguments[0],
      "https://api.test/api/alderaan/v1/acme/app/"
    );
  });

  it("deve gravar millbodyApp.json na raiz e no tema com versionLabel padrão", async () => {
    await create({ account: "acme" });
    const themeFile = `${root}/mbContent/themes/acme-theme/millbodyApp.json`;
    await waitFor(
      () =>
        readJson("millbodyApp.json").themeName && isReadable(themeFile)
    );
    const expected = {
      themeName: "acme-theme",
      account: "acme",
      versionLabel: "3.0",
    };
    assert.deepEqual(readJson("millbodyApp.json"), expected);
    assert.deepEqual(readJson(themeFile), expected);
  });

  it("deve preservar versionLabel retornado pela API", async () => {
    fetchSpy.mock.restore();
    fetchSpy = mockFetch({ themeName: "acme-theme", versionLabel: "5.1" });
    await create({ account: "acme" });
    await waitFor(() => readJson("millbodyApp.json").themeName);
    assert.equal(readJson("millbodyApp.json").versionLabel, "5.1");
  });

  it("deve executar a sequência de comandos na ordem esperada", async () => {
    await create({ account: "acme", track: "beta" });
    const themeFolder = `${root}/mbContent/themes/acme-theme`;
    const commands = shell.commands();
    assert.equal(commands.length, 8);
    assert.match(commands[0], new RegExp(`^cd ${themeFolder} && git checkout master && git checkout -b acme`));
    assert.match(commands[1], /^kill -9 /);
    assert.equal(commands[2], `cd ${root} && node millbodyapp.config.js`);
    assert.equal(commands[3], "killall Xcode");
    assert.match(commands[4], /fastlane default_setapp theme_folder:acme-theme/);
    assert.equal(commands[5], `ttab "cd ${themeFolder}; millbody start"`);
    assert.equal(commands[6], `cd ${root}/ios && xed .`);
    assert.match(commands[7], /gradlew bundleRelease/);
  });

  it("deve usar fastlane create_app quando track não é prod", async () => {
    await create({ account: "acme", track: "beta" });
    assert.match(shell.commands().at(-1), /fastlane create_app theme_folder:acme-theme$/);
  });

  it("deve usar fastlane deploy quando track é prod", async () => {
    await create({ account: "acme", track: "prod" });
    assert.match(shell.commands().at(-1), /fastlane deploy theme_folder:acme-theme$/);
  });

  it("deve registrar o erro quando não consegue gravar o millbodyApp.json da raiz", async () => {
    fs.rmSync("millbodyApp.json");
    fs.mkdirSync("millbodyApp.json");
    await create({ account: "acme" });
    await waitFor(() => logged().some((m) => m?.code === "EISDIR"));
  });

  it("deve registrar o erro quando a pasta do tema não existe", async () => {
    fs.rmSync("mbContent", { recursive: true });
    await create({ account: "acme" });
    await waitFor(() => logged().some((m) => m?.code === "ENOENT"));
  });

  it("deve propagar falhas da API", async () => {
    fetchSpy.mock.restore();
    fetchSpy = mockFetch(async () => ({ ok: false, status: 500, statusText: "Erro" }));
    await assert.rejects(create({ account: "acme" }), /500/);
    assert.equal(shell.commands().length, 0);
  });

  it(
    "deve encerrar o servidor react native na porta 8081",
    { todo: "BUG: kill -9 'lsof -t -i:8081' usa aspas simples e nunca mata o processo" },
    async () => {
      await create({ account: "acme" });
      const kill = shell.commands().find((c) => c.startsWith("kill -9"));
      assert.match(kill, /\$\(lsof -t -i:8081\)|`lsof -t -i:8081`/);
    }
  );

  it(
    "não deve interpolar --account com metacaracteres de shell nos comandos",
    { todo: "BUG: injeção de comando via --account em create.js" },
    async () => {
      await create({ account: "x; touch /tmp/pwned" });
      assert.equal(shell.commands().some((c) => c.includes("; touch /tmp/pwned")), false);
    }
  );

  it(
    "não deve interpolar themeName com metacaracteres de shell nos comandos",
    { todo: "BUG: injeção de comando via themeName em create.js" },
    async () => {
      fetchSpy.mock.restore();
      fetchSpy = mockFetch({ themeName: "t; touch /tmp/pwned" });
      await create({ account: "acme" });
      assert.equal(shell.commands().some((c) => c.includes("; touch /tmp/pwned")), false);
    }
  );
});

