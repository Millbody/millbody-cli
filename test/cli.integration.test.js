import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { installExecMock, rootProject, mockFetch } from "./helpers/world.js";
import { createSandbox } from "./helpers/sandbox.js";

const shell = installExecMock();
const select = mock.fn(async () => "start");
mock.module("@inquirer/prompts", { namedExports: { select } });

const { cli, promptForMissingOptions, defaultHandlers } = await import("../src/cli.js");
const { default: create } = await import("../src/commands/create.js");

const prepareAccountBranchStub = async () => ({ branch: "accounts/acme", mode: "new" });

const sandbox = createSandbox("millbody-sandbox-cli-");
const argv = (...rest) => ["node", "millbody", ...rest];

function setTTY(value) {
  const original = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  Object.defineProperty(process.stdin, "isTTY", {
    value,
    configurable: true,
    writable: true,
  });
  return () => {
    if (original) Object.defineProperty(process.stdin, "isTTY", original);
    else delete process.stdin.isTTY;
  };
}

let logSpy;
let restoreTTY;
let fetchSpy;

beforeEach(() => {
  shell.reset();
  select.mock.resetCalls();
  select.mock.mockImplementation(async () => "start");
  logSpy = mock.method(console, "log", () => {});
  restoreTTY = setTTY(false);
  sandbox.enter(rootProject);
  fetchSpy = mockFetch({ themeName: "acme-theme" });
});

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  restoreTTY();
  fetchSpy.mock.restore();
  logSpy.mock.restore();
  sandbox.leave();
});

describe("[cli] integração cli -> comando com mocks", () => {
  const routes = [
    ["start", /react-native start/],
    ["test", /index\.test\.js não existe|ENVFILE=\.env\.test/],
    ["codepush", /codepush deploy/],
    ["run-android", /ENVFILE=\.env react-native run-android/],
    ["run-ios", /react-native run-ios/],
    ["build-android", /assembleRelease/],
  ];

  for (const [template, expected] of routes) {
    it(`deve rotear "${template}" ao comando correspondente`, async () => {
      await cli(argv(template, "--source", "root"));
      if (template === "test") {
        assert.ok(
          logSpy.mock.calls.some((c) => expected.test(String(c.arguments[0])))
        );
      } else {
        assert.match(shell.commands()[0], expected);
      }
    });
  }

  it("deve usar source theme por padrão", async () => {
    await assert.rejects(cli(argv("start")), /TEMA MILLBODY/);
  });

  for (const template of ["create", "update-apk", "updateapp"]) {
    it(`deve rotear "${template}" e repassar --account e --track`, async () => {
      await cli(
        argv(template, "-a", "acme", "-t", "prod"),
        { ...defaultHandlers, create: (o) => create(o, { prepareAccountBranch: prepareAccountBranchStub }) }
      );
      assert.match(
        fetchSpy.mock.calls[0].arguments[0],
        /\/api\/alderaan\/v1\/acme\/app\/$/
      );
      assert.match(shell.commands().at(-1), /fastlane deploy/);
    });
  }

  it("deve cair em start quando não há template e stdin não é TTY", async () => {
    await cli(argv("--source", "root"));
    assert.match(shell.commands()[0], /react-native start|npm start/);
    assert.equal(select.mock.calls.length, 0);
  });

  it("deve propagar erro de parse de argumentos desconhecidos", async () => {
    await assert.rejects(cli(argv("start", "--bogus")), /Unknown or unexpected option/);
    assert.equal(shell.commands().length, 0);
  });

  it("deve propagar erro do comando", async () => {
    fetchSpy.mock.restore();
    fetchSpy = mockFetch(async () => {
      throw new Error("API fora");
    });
    await assert.rejects(cli(argv("create", "-a", "acme")), /Falha de rede.*API fora/);
  });

  it("deve rejeitar com Comando desconhecido para template desconhecido", async () => {
    await assert.rejects(
      () => cli(argv("inexistente")),
      /Comando desconhecido/
    );
    assert.equal(shell.commands().length, 0);
  });

  it("deve informar erro para template desconhecido", async () => {
    let rejectedError;
    await cli(argv("inexistente")).catch((err) => { rejectedError = err; });
    assert.ok(rejectedError instanceof Error);
    assert.match(rejectedError.message, /Comando desconhecido/);
  });
});

describe("[cli] promptForMissingOptions interativo", () => {
  it("deve perguntar com select e usar a escolha quando stdin é TTY", async () => {
    restoreTTY();
    restoreTTY = setTTY(true);
    select.mock.mockImplementation(async () => "run-ios");
    const result = await promptForMissingOptions({ source: "theme" });
    assert.equal(result.template, "run-ios");
    assert.equal(result.source, "theme");
    const [config] = select.mock.calls[0].arguments;
    assert.equal(config.default, "start");
    assert.deepEqual(
      config.choices.map((c) => c.value),
      ["start", "run-ios", "run-android", "codepush", "create"]
    );
  });

  it("deve executar o comando escolhido no prompt via cli", async () => {
    restoreTTY();
    restoreTTY = setTTY(true);
    select.mock.mockImplementation(async () => "codepush");
    await cli(argv("--source", "root"));
    assert.equal(select.mock.calls.length, 1);
    assert.match(shell.commands()[0], /codepush deploy/);
  });

  it("não deve perguntar quando o template já foi informado", async () => {
    restoreTTY();
    restoreTTY = setTTY(true);
    const result = await promptForMissingOptions({ template: "start" });
    assert.equal(result.template, "start");
    assert.equal(select.mock.calls.length, 0);
  });

  it("deve propagar o cancelamento do prompt", async () => {
    restoreTTY();
    restoreTTY = setTTY(true);
    select.mock.mockImplementation(async () => {
      const err = new Error("cancelado");
      err.name = "ExitPromptError";
      throw err;
    });
    await assert.rejects(promptForMissingOptions({}), { name: "ExitPromptError" });
  });

  it("não deve incluir 'new' nas opções do menu interativo", async () => {
    restoreTTY();
    restoreTTY = setTTY(true);
    select.mock.mockImplementation(async () => "start");
    await promptForMissingOptions({ source: "theme" });
    const [config] = select.mock.calls[0].arguments;
    const values = config.choices.map((c) => c.value);
    assert.ok(!values.includes("new"), `"new" não deve estar no menu: ${values.join(", ")}`);
  });

  it("deve aceitar comando válido selecionado pelo prompt quando new não está no menu", async () => {
    restoreTTY();
    restoreTTY = setTTY(true);
    select.mock.mockImplementation(async () => "codepush");
    await cli(argv("--source", "root"));
    assert.match(shell.commands()[0], /codepush deploy/);
  });

  it("A4: --help curto-circuita antes do prompt com TTY=true (select 0 chamadas)", async () => {
    restoreTTY();
    restoreTTY = setTTY(true);
    select.mock.mockImplementation(async () => {
      throw new Error("select não deve ser chamado");
    });
    await cli(argv("--help"));
    assert.equal(select.mock.calls.length, 0);
  });

  it("A4: --version curto-circuita antes do prompt com TTY=true (select 0 chamadas)", async () => {
    restoreTTY();
    restoreTTY = setTTY(true);
    select.mock.mockImplementation(async () => {
      throw new Error("select não deve ser chamado");
    });
    await cli(argv("--version"));
    assert.equal(select.mock.calls.length, 0);
  });

  it("A4: 'help' como comando curto-circuita antes do prompt com TTY=true (select 0 chamadas)", async () => {
    restoreTTY();
    restoreTTY = setTTY(true);
    select.mock.mockImplementation(async () => {
      throw new Error("select não deve ser chamado");
    });
    await cli(argv("help"));
    assert.equal(select.mock.calls.length, 0);
  });

  it("A4: -h curto-circuita antes do prompt com TTY=true (select 0 chamadas)", async () => {
    restoreTTY();
    restoreTTY = setTTY(true);
    select.mock.mockImplementation(async () => {
      throw new Error("select não deve ser chamado");
    });
    await cli(argv("-h"));
    assert.equal(select.mock.calls.length, 0);
  });
});
