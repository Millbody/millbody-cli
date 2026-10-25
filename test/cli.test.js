import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  parseArgumentsIntoOptions,
  promptForMissingOptions,
  cli,
  defaultHandlers,
} from "../src/cli.js";
import commands from "../src/commands/registry.js";

describe("[cli] parseArgumentsIntoOptions", () => {
  it('deve retornar template "start" quando args contém "start"', () => {
    const result = parseArgumentsIntoOptions(["node", "bin", "start"]);
    assert.strictEqual(result.template, "start");
  });

  it('deve retornar template "test" quando args contém "test"', () => {
    const result = parseArgumentsIntoOptions(["node", "bin", "test"]);
    assert.strictEqual(result.template, "test");
  });

  it("deve extrair --account quando fornecido", () => {
    const result = parseArgumentsIntoOptions([
      "node",
      "bin",
      "start",
      "--account",
      "my-org",
    ]);
    assert.strictEqual(result.account, "my-org");
  });

  it("deve extrair --account via alias -a", () => {
    const result = parseArgumentsIntoOptions([
      "node",
      "bin",
      "start",
      "-a",
      "my-org",
    ]);
    assert.strictEqual(result.account, "my-org");
  });

  it("deve extrair --source root e retornar source = root", () => {
    const result = parseArgumentsIntoOptions([
      "node",
      "bin",
      "start",
      "--source",
      "root",
    ]);
    assert.strictEqual(result.source, "root");
  });

  it("deve retornar source = theme quando --source não é root", () => {
    const result = parseArgumentsIntoOptions(["node", "bin", "start"]);
    assert.strictEqual(result.source, "theme");
  });

  it("deve retornar template undefined quando nenhum comando é passado", () => {
    const result = parseArgumentsIntoOptions(["node", "bin"]);
    assert.strictEqual(result.template, undefined);
  });

  it("deve extrair --track quando fornecido", () => {
    const result = parseArgumentsIntoOptions([
      "node",
      "bin",
      "codepush",
      "--track",
      "production",
    ]);
    assert.strictEqual(result.track, "production");
  });
});

describe("[cli] promptForMissingOptions", () => {
  it('deve retornar options inalteradas quando template já está definido', async () => {
    const options = { template: "test", source: "theme" };
    const result = await promptForMissingOptions(options);
    assert.strictEqual(result.template, "test");
  });

  it('deve retornar template "start" quando template é undefined e stdin não é TTY', async () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    try {
      const result = await promptForMissingOptions({ template: undefined });
      assert.strictEqual(result.template, "start");
    } finally {
      Object.defineProperty(process.stdin, "isTTY", {
        value: originalIsTTY,
        writable: true,
        configurable: true,
      });
    }
  });

  it('deve retornar template "start" quando stdin.isTTY é false', async () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });

    try {
      const result = await promptForMissingOptions({ template: undefined, source: "theme" });
      assert.strictEqual(result.template, "start");
      assert.strictEqual(result.source, "theme");
    } finally {
      Object.defineProperty(process.stdin, "isTTY", {
        value: originalIsTTY,
        writable: true,
        configurable: true,
      });
    }
  });
});

describe("[cli] roteamento com handlers injetáveis", () => {
  const stubResolveArch = () => ({ arch: "legacy", projectDir: process.cwd() });

  it("deve chamar o handler correto quando template é start", async () => {
    const startHandler = mock.fn(async () => "started");
    const handlers = { start: startHandler };

    await cli(["node", "bin", "start"], handlers, { resolveArch: stubResolveArch });

    assert.strictEqual(startHandler.mock.calls.length, 1);
    const [calledOptions] = startHandler.mock.calls[0].arguments;
    assert.strictEqual(calledOptions.template, "start");
  });

  it("deve chamar o handler correto quando template é test", async () => {
    const testHandler = mock.fn(async () => "tested");
    const handlers = { test: testHandler };

    await cli(["node", "bin", "test"], handlers, { resolveArch: stubResolveArch });

    assert.strictEqual(testHandler.mock.calls.length, 1);
  });

  it("deve lançar Comando desconhecido quando o template não tem handler correspondente", async () => {
    const handlers = {};
    await assert.rejects(
      () => cli(["node", "bin", "nonexistent-cmd-xyz"], handlers, { resolveArch: stubResolveArch }),
      /Comando desconhecido/
    );
  });

  it("deve passar account e track para o handler", async () => {
    const handler = mock.fn(async () => {});
    const handlers = { start: handler };

    await cli(
      ["node", "bin", "start", "--account", "test-org", "--track", "prod"],
      handlers,
      { resolveArch: stubResolveArch }
    );

    assert.strictEqual(handler.mock.calls.length, 1);
    const [options] = handler.mock.calls[0].arguments;
    assert.strictEqual(options.account, "test-org");
    assert.strictEqual(options.track, "prod");
  });

  it("deve retornar sem chamar handler quando --help é passado", async () => {
    const handler = mock.fn(async () => {});
    const handlers = { start: handler };
    const logSpy = mock.method(console, "log", () => {});
    try {
      await cli(["node", "bin", "--help"], handlers);
      assert.strictEqual(handler.mock.calls.length, 0);
    } finally {
      logSpy.mock.restore();
    }
  });

  it("deve retornar sem chamar handler quando --version é passado", async () => {
    const handler = mock.fn(async () => {});
    const handlers = { start: handler };
    const logSpy = mock.method(console, "log", () => {});
    try {
      await cli(["node", "bin", "--version"], handlers);
      assert.strictEqual(handler.mock.calls.length, 0);
    } finally {
      logSpy.mock.restore();
    }
  });

  it("deve retornar sem chamar handler quando comando é help", async () => {
    const handler = mock.fn(async () => {});
    const handlers = { start: handler };
    const logSpy = mock.method(console, "log", () => {});
    try {
      await cli(["node", "bin", "help"], handlers);
      assert.strictEqual(handler.mock.calls.length, 0);
    } finally {
      logSpy.mock.restore();
    }
  });

  it("deve retornar sem chamar handler quando comando é help start", async () => {
    const handler = mock.fn(async () => {});
    const handlers = { start: handler };
    const logSpy = mock.method(console, "log", () => {});
    try {
      await cli(["node", "bin", "help", "start"], handlers);
      assert.strictEqual(handler.mock.calls.length, 0);
    } finally {
      logSpy.mock.restore();
    }
  });

  it("deve lançar para comando desconhecido com --help (A3)", async () => {
    const handlers = {};
    await assert.rejects(
      () => cli(["node", "bin", "foo-inexistente", "--help"], handlers),
      /Comando desconhecido/
    );
  });

  it("deve lançar para template desconhecido — prototype pollution: constructor (C1)", async () => {
    const handlers = defaultHandlers;
    await assert.rejects(
      () => cli(["node", "bin", "constructor"], handlers),
      /Comando desconhecido/
    );
  });

  it("deve lançar para template desconhecido — prototype pollution: toString (C1)", async () => {
    const handlers = defaultHandlers;
    await assert.rejects(
      () => cli(["node", "bin", "toString"], handlers),
      /Comando desconhecido/
    );
  });
});

describe("[cli] parseArgumentsIntoOptions — flags informacionais", () => {
  it("deve retornar help=true quando --help é passado", () => {
    const result = parseArgumentsIntoOptions(["node", "bin", "--help"]);
    assert.strictEqual(result.help, true);
  });

  it("deve retornar help=true quando -h é passado", () => {
    const result = parseArgumentsIntoOptions(["node", "bin", "-h"]);
    assert.strictEqual(result.help, true);
  });

  it("deve retornar version=true quando --version é passado", () => {
    const result = parseArgumentsIntoOptions(["node", "bin", "--version"]);
    assert.strictEqual(result.version, true);
  });

  it("deve retornar version=true quando -v é passado", () => {
    const result = parseArgumentsIntoOptions(["node", "bin", "-v"]);
    assert.strictEqual(result.version, true);
  });

  it("deve retornar template=help e helpSubcommand=start para 'millbody help start'", () => {
    const result = parseArgumentsIntoOptions(["node", "bin", "help", "start"]);
    assert.strictEqual(result.template, "help");
    assert.strictEqual(result.helpSubcommand, "start");
  });

  it("deve retornar help=true e helpSubcommand=start para 'millbody start --help'", () => {
    const result = parseArgumentsIntoOptions(["node", "bin", "start", "--help"]);
    assert.strictEqual(result.help, true);
    assert.strictEqual(result.helpSubcommand, "start");
  });

  it("deve lançar para flag desconhecida com mensagem de sugestão", () => {
    assert.throws(
      () => parseArgumentsIntoOptions(["node", "bin", "--xyz-unknown"]),
      /Use "millbody --help"/
    );
  });

  it("M2: start -v deve retornar version=true (version tem prioridade)", () => {
    const result = parseArgumentsIntoOptions(["node", "bin", "start", "-v"]);
    assert.strictEqual(result.version, true);
    assert.strictEqual(result.template, "start");
  });
});

describe("[A2] paridade registry <-> defaultHandlers (cli.test.js)", () => {
  it("nomes + aliases do registry devem cobrir exatamente as chaves do defaultHandlers", () => {
    const legacyRegistryKeys = new Set(
      commands
        .filter((c) => c.archs && c.archs.includes("legacy"))
        .flatMap((c) => [c.name, ...c.aliases])
    );
    const fromHandlers = new Set(Object.keys(defaultHandlers));
    for (const key of legacyRegistryKeys) {
      assert.ok(fromHandlers.has(key), `"${key}" do registry (legacy) não tem handler em defaultHandlers`);
    }
    for (const key of fromHandlers) {
      const inRegistry = commands.some(
        (c) => c.name === key || c.aliases.includes(key)
      );
      assert.ok(inRegistry, `"${key}" do defaultHandlers não está no registry`);
    }
  });
});
