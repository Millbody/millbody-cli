import { describe, it } from "node:test";
import assert from "node:assert/strict";
import commands from "../src/commands/registry.js";
import { findCommand } from "../src/help.js";
import { defaultHandlers } from "../src/cli.js";

describe("[registry] estrutura do registro de comandos", () => {
  it("deve exportar um array não vazio de descritores de comando", () => {
    assert.ok(Array.isArray(commands));
    assert.ok(commands.length > 0);
  });

  it("deve conter os 8 comandos esperados", () => {
    const names = commands.map((c) => c.name);
    assert.deepEqual(names.sort(), [
      "build-android",
      "codepush",
      "create",
      "run-android",
      "run-ios",
      "start",
      "test",
      "update-apk",
    ]);
  });

  it("update-apk deve ter alias updateapp", () => {
    const updateApk = commands.find((c) => c.name === "update-apk");
    assert.ok(updateApk);
    assert.deepEqual(updateApk.aliases, ["updateapp"]);
  });

  it("cada descritor deve ter os campos obrigatórios", () => {
    const required = [
      "name",
      "aliases",
      "summary",
      "usage",
      "description",
      "flags",
      "examples",
      "prerequisites",
      "external",
      "sideEffects",
      "interactive",
    ];
    for (const cmd of commands) {
      for (const field of required) {
        assert.ok(field in cmd, `Campo "${field}" ausente em "${cmd.name}"`);
      }
    }
  });

  it("comandos interativos devem ser: start, run-ios, run-android, codepush, create", () => {
    const interactiveNames = commands
      .filter((c) => c.interactive)
      .map((c) => c.name)
      .sort();
    assert.deepEqual(interactiveNames, [
      "codepush",
      "create",
      "run-android",
      "run-ios",
      "start",
    ]);
  });
});

describe("[findCommand]", () => {
  it("deve encontrar um comando pelo nome exato", () => {
    const cmd = findCommand("start");
    assert.ok(cmd);
    assert.strictEqual(cmd.name, "start");
  });

  it("deve encontrar um comando pelo alias", () => {
    const cmd = findCommand("updateapp");
    assert.ok(cmd);
    assert.strictEqual(cmd.name, "update-apk");
  });

  it("deve retornar undefined para nome desconhecido", () => {
    assert.strictEqual(findCommand("inexistente"), undefined);
  });

  it("deve retornar undefined para nome vazio", () => {
    assert.strictEqual(findCommand(""), undefined);
  });

  it("deve funcionar com registry customizado", () => {
    const customRegistry = [{ name: "foo", aliases: ["bar"] }];
    assert.strictEqual(findCommand("foo", customRegistry).name, "foo");
    assert.strictEqual(findCommand("bar", customRegistry).name, "foo");
    assert.strictEqual(findCommand("baz", customRegistry), undefined);
  });
});

describe("[A2] paridade registry <-> defaultHandlers", () => {
  it("nomes + aliases do registry devem ser iguais às chaves do defaultHandlers", () => {
    const fromRegistry = new Set(commands.flatMap((c) => [c.name, ...c.aliases]));
    const fromHandlers = new Set(Object.keys(defaultHandlers));
    assert.deepEqual(fromRegistry, fromHandlers);
  });
});
