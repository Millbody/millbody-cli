import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import commands from "../src/commands/registry.js";
import {
  getVersion,
  findCommand,
  renderGeneralHelp,
  renderCommandHelp,
  renderUnknownCommand,
  resolveInformational,
} from "../src/help.js";
import { defaultHandlers } from "../src/cli.js";

const readmePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "README.md"
);

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

describe("[renderGeneralHelp]", () => {
  it("deve conter todos os nomes de comandos do registry", () => {
    const output = renderGeneralHelp();
    for (const cmd of commands) {
      assert.ok(
        output.includes(cmd.name),
        `"${cmd.name}" não encontrado na ajuda geral`
      );
    }
  });

  it("deve conter as opções globais --source, --account, --track, --help, --version", () => {
    const output = renderGeneralHelp();
    assert.ok(output.includes("--source"));
    assert.ok(output.includes("--account"));
    assert.ok(output.includes("--track"));
    assert.ok(output.includes("--help"));
    assert.ok(output.includes("--version"));
  });

  it("deve conter a instrução de uso", () => {
    const output = renderGeneralHelp();
    assert.ok(output.includes("millbody <comando>"));
  });

  it("deve conter sugestão millbody help <comando>", () => {
    const output = renderGeneralHelp();
    assert.ok(output.includes("millbody help"));
  });

  it("deve mencionar alias do update-apk", () => {
    const output = renderGeneralHelp();
    assert.ok(output.includes("updateapp"));
  });

  it("deve funcionar com registry customizado", () => {
    const custom = [{ name: "foo", aliases: [], summary: "desc-foo" }];
    const output = renderGeneralHelp(custom);
    assert.ok(output.includes("foo"));
    assert.ok(output.includes("desc-foo"));
  });
});

describe("[renderCommandHelp]", () => {
  it("deve conter o nome, summary e usage do comando", () => {
    const output = renderCommandHelp("start");
    assert.ok(output.includes("start"));
    assert.ok(output.includes("Sobe o Metro/React Native bundler"));
    assert.ok(output.includes("millbody start"));
  });

  it("deve conter flags quando presentes", () => {
    const output = renderCommandHelp("start");
    assert.ok(output.includes("--source"));
  });

  it("deve conter exemplos quando presentes", () => {
    const output = renderCommandHelp("start");
    assert.ok(output.includes("millbody start"));
  });

  it("deve conter pré-requisitos quando presentes", () => {
    const output = renderCommandHelp("start");
    assert.ok(output.includes("millbody"));
  });

  it("deve conter comandos externos quando presentes", () => {
    const output = renderCommandHelp("start");
    assert.ok(output.includes("react-native start") || output.includes("npm start"));
  });

  it("deve conter efeitos colaterais quando presentes", () => {
    const output = renderCommandHelp("start");
    assert.ok(output.includes("millbodyApp.json"));
  });

  it("deve renderizar ajuda do create com aliases de flags", () => {
    const output = renderCommandHelp("create");
    assert.ok(output.includes("--account"));
    assert.ok(output.includes("--track"));
  });

  it("deve renderizar ajuda do update-apk com alias de comando", () => {
    const output = renderCommandHelp("update-apk");
    assert.ok(output.includes("updateapp"));
  });

  it("deve aceitar alias como nome do comando", () => {
    const output = renderCommandHelp("updateapp");
    assert.ok(output.includes("update-apk"));
  });

  it("deve retornar mensagem de desconhecido para nome inválido", () => {
    const output = renderCommandHelp("inexistente");
    assert.ok(output.includes("Comando desconhecido") || output.includes("inexistente"));
  });

  for (const cmd of commands) {
    it(`deve renderizar ajuda de "${cmd.name}" sem lançar exceção`, () => {
      assert.doesNotThrow(() => renderCommandHelp(cmd.name));
    });

    it(`ajuda de "${cmd.name}" contém o nome do comando`, () => {
      const output = renderCommandHelp(cmd.name);
      assert.ok(output.includes(cmd.name));
    });

    it(`ajuda de "${cmd.name}" contém o summary`, () => {
      const output = renderCommandHelp(cmd.name);
      assert.ok(output.includes(cmd.summary));
    });
  }
});

describe("[renderUnknownCommand]", () => {
  it("deve conter o nome do comando desconhecido", () => {
    const output = renderUnknownCommand("xyz-desconhecido");
    assert.ok(output.includes("xyz-desconhecido"));
  });

  it("deve sugerir --help", () => {
    const output = renderUnknownCommand("xyz-desconhecido");
    assert.ok(output.includes("--help"));
  });

  it("deve listar comandos disponíveis", () => {
    const output = renderUnknownCommand("xyz-desconhecido");
    for (const cmd of commands) {
      assert.ok(output.includes(cmd.name));
    }
  });

  it("deve conter Comando desconhecido", () => {
    const output = renderUnknownCommand("foo-bar");
    assert.ok(output.includes("Comando desconhecido"));
  });
});

describe("[resolveInformational]", () => {
  it("deve retornar {kind:'version'} quando version=true", () => {
    const result = resolveInformational({ version: true });
    assert.deepEqual(result, { kind: "version" });
  });

  it("deve retornar {kind:'general-help'} quando help=true sem subcomando", () => {
    const result = resolveInformational({ help: true });
    assert.strictEqual(result.kind, "general-help");
    assert.ok(typeof result.text === "string");
    assert.ok(result.text.includes("millbody"));
  });

  it("deve retornar {kind:'general-help'} quando template=help sem subcomando", () => {
    const result = resolveInformational({ template: "help" });
    assert.strictEqual(result.kind, "general-help");
  });

  it('deve retornar {kind:"general-help"} quando helpSubcommand é "help"', () => {
    const result = resolveInformational({ help: true, helpSubcommand: "help" });
    assert.strictEqual(result.kind, "general-help");
  });

  it("deve retornar {kind:'command-help'} quando help=true e subcomando conhecido", () => {
    const result = resolveInformational({ help: true, helpSubcommand: "start" });
    assert.strictEqual(result.kind, "command-help");
    assert.ok(result.text.includes("start"));
  });

  it("deve retornar {kind:'command-help'} para alias de comando (updateapp)", () => {
    const result = resolveInformational({ help: true, helpSubcommand: "updateapp" });
    assert.strictEqual(result.kind, "command-help");
    assert.ok(result.text.includes("update-apk"));
  });

  it("deve retornar {kind:'unknown-command'} quando subcomando não é encontrado", () => {
    const result = resolveInformational({ help: true, helpSubcommand: "inexistente-xyz" });
    assert.strictEqual(result.kind, "unknown-command");
    assert.ok(result.text.includes("inexistente-xyz"));
  });

  it("deve retornar {kind:'unknown-command'} para template=help com subcomando desconhecido", () => {
    const result = resolveInformational({ template: "help", helpSubcommand: "nao-existe" });
    assert.strictEqual(result.kind, "unknown-command");
  });

  it("deve retornar null para comando normal (sem help/version)", () => {
    const result = resolveInformational({ template: "start" });
    assert.strictEqual(result, null);
  });

  it("deve retornar null para options vazias", () => {
    const result = resolveInformational({});
    assert.strictEqual(result, null);
  });

  it("version tem prioridade sobre help", () => {
    const result = resolveInformational({ version: true, help: true });
    assert.strictEqual(result.kind, "version");
  });
});

describe("[getVersion]", () => {
  it("deve retornar a versão lida do package.json", async () => {
    const packageJson = JSON.parse(
      await fs.readFile(
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"),
        "utf8"
      )
    );
    const version = await getVersion();
    assert.strictEqual(version, packageJson.version);
    assert.match(version, /^\d+\.\d+\.\d+/);
  });

  it("deve propagar erro quando o arquivo não está acessível", async () => {
    const fsMod = await import("node:fs/promises");
    const original = fsMod.default.readFile;
    let restored = false;
    mock.method(fsMod.default, "readFile", async () => {
      throw new Error("ENOENT simulado");
    });
    try {
      await assert.rejects(getVersion(), /ENOENT simulado/);
    } finally {
      if (!restored) {
        fsMod.default.readFile = original;
        restored = true;
      }
    }
  });
});

describe("[A2] paridade registry <-> defaultHandlers", () => {
  it("nomes + aliases do registry devem ser iguais às chaves do defaultHandlers", () => {
    const fromRegistry = new Set(commands.flatMap((c) => [c.name, ...c.aliases]));
    const fromHandlers = new Set(Object.keys(defaultHandlers));
    assert.deepEqual(fromRegistry, fromHandlers);
  });
});

describe("[A5] consistência README.md <-> registry", () => {
  let readmeContent;

  it("README deve conter heading '### millbody <name>' para cada comando do registry", async () => {
    readmeContent = await fs.readFile(readmePath, "utf8");
    for (const cmd of commands) {
      const heading = `### millbody ${cmd.name}`;
      assert.ok(
        readmeContent.includes(heading),
        `README não contém heading "${heading}"`
      );
    }
  });

  it("cada heading '### millbody <cmd>' do README deve existir no registry", async () => {
    if (!readmeContent) {
      readmeContent = await fs.readFile(readmePath, "utf8");
    }
    const headingPattern = /^### millbody (\S+)$/gm;
    const names = commands.map((c) => c.name);
    const aliases = commands.flatMap((c) => c.aliases);
    let match;
    while ((match = headingPattern.exec(readmeContent)) !== null) {
      const cmdName = match[1];
      assert.ok(
        names.includes(cmdName) || aliases.includes(cmdName),
        `Heading "### millbody ${cmdName}" do README não existe no registry`
      );
    }
  });

  it("cada flag do registry deve aparecer na seção do README do seu comando", async () => {
    if (!readmeContent) {
      readmeContent = await fs.readFile(readmePath, "utf8");
    }
    for (const cmd of commands) {
      for (const flag of cmd.flags) {
        const flagName = flag.flags.split(",")[0].trim();
        assert.ok(
          readmeContent.includes(flagName),
          `Flag "${flagName}" do comando "${cmd.name}" não encontrada no README`
        );
      }
    }
  });
});
