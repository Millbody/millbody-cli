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

describe("[commands] comandos simples (theme vs root)", () => {
  const cases = [
    {
      name: "start",
      run: start,
      theme: "cp millbodyApp.json ../../../ && cd ../../../ && npm start --reset-cache",
      root: "npx react-native start --reset-cache",
    },
    {
      name: "codepush",
      run: codepush,
      theme: "cd ../../../ && node ./mbCore/framework/script.js codepush deploy",
      root: "node ./mbCore/framework/script.js codepush deploy",
      message: "publicando pelo CodePush...",
    },
    {
      name: "buildAndroid",
      run: buildAndroid,
      theme: "cd ../../../ && cd android/ && ./gradlew clean && ./gradlew assembleRelease",
      root: "cd android/ && ./gradlew clean && ./gradlew assembleRelease",
      message: "Limpando cache e buildando android...",
    },
    {
      name: "runIos",
      run: runIos,
      theme: "cd ../../../ && react-native run-ios",
      root: "react-native run-ios",
      message: "Rodando aplicação no iOS...",
    },
  ];

  for (const { name, run, theme, root, message } of cases) {
    it(`${name}: deve executar o comando de tema em pasta de tema`, () => {
      sandbox.enter(themeProject);
      run({ source: "theme" });
      assert.deepEqual(shell.commands(), [theme]);
      if (message) assert.ok(logged().includes(message));
      assert.equal(exitSpy.mock.calls.length, 0);
    });

    it(`${name}: deve executar o comando de raiz em pasta raiz`, () => {
      sandbox.enter(rootProject);
      run({ source: "root" });
      assert.deepEqual(shell.commands(), [root]);
      if (message) assert.ok(logged().includes(message));
      assert.equal(exitSpy.mock.calls.length, 0);
    });

    it(`${name}: deve recusar pasta que não é de tema quando source é theme`, () => {
      sandbox.enter(rootProject);
      run({ source: "theme" });
      assert.equal(exitSpy.mock.calls.length, 1);
      assert.match(errorSpy.mock.calls[0].arguments[0], /TEMA MILLBODY/);
    });
  }
});

describe("[commands] runAndroid", () => {
  it("deve rodar no tema usando a conta do millbodyApp.json", () => {
    sandbox.enter(themeProject);
    runAndroid({ source: "theme" });
    assert.ok(logged().includes("Rodando APP acme no Android"));
    assert.deepEqual(shell.commands(), [
      "cd ../../../ && cd android/ && ./gradlew clean && cd .. && ENVFILE=.env react-native run-android",
    ]);
  });

  it("deve rodar na raiz", () => {
    sandbox.enter(rootProject);
    runAndroid({ source: "root" });
    assert.deepEqual(shell.commands(), [
      "cd android/ && ./gradlew clean && cd .. && ENVFILE=.env react-native run-android",
    ]);
    assert.ok(logged().includes("Limpando cache e rodando android..."));
  });

  it("deve lançar erro quando millbodyApp.json é inválido", () => {
    sandbox.enter({ ...rootProject, "millbodyApp.json": "{nao-json" });
    assert.throws(() => runAndroid({ source: "root" }), SyntaxError);
    assert.equal(shell.commands().length, 0);
  });
});

describe("[commands] test", () => {
  it("deve avisar e não executar quando index.test.js não existe", () => {
    sandbox.enter(rootProject);
    testCommand({ source: "root" });
    assert.equal(shell.commands().length, 0);
    assert.ok(logged().some((m) => /index\.test\.js não existe/.test(m)));
  });

  it("deve executar com .env.test na raiz quando index.test.js existe", () => {
    sandbox.enter({ ...rootProject, "index.test.js": "" });
    testCommand({ source: "root" });
    assert.deepEqual(shell.commands(), [
      "cd android/ && ./gradlew clean && cd .. && ENVFILE=.env.test react-native run-android",
    ]);
    assert.ok(logged().includes("Limpando cache e rodando android..."));
  });

  it("deve executar com .env.test no tema quando index.test.js existe", () => {
    sandbox.enter({ ...themeProject, "index.test.js": "" });
    testCommand({ source: "theme" });
    assert.deepEqual(shell.commands(), [
      "cd ../../../ && cd android/ && ./gradlew clean && cd .. && ENVFILE=.env.test react-native run-android",
    ]);
  });
});

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

describe("[commands] updateApk", () => {
  let root;

  beforeEach(() => {
    root = sandbox.enter(rootProject);
    fetchSpy = mockFetch({ themeName: "acme-theme" });
  });

  it("deve recusar pasta que não é raiz de projeto Millbody", async () => {
    fs.rmSync("mbCore", { recursive: true });
    await updateApk({ account: "acme" }).catch(() => {});
    assert.match(errorSpy.mock.calls[0].arguments[0], /framework MILLBODY APP/);
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
