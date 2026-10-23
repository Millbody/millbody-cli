import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import commands, { globalFlags } from "../src/commands/registry.js";
import { renderGeneralHelp } from "../src/help.js";
import { EXPO_COMMAND_MAP } from "../src/arch/expoCommands.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const UTILITY_COMMANDS = new Set(["doctor", "setup"]);

describe("[consistência] archs ↔ expoCommands (O3)", () => {
  it("todo comando do registry que suporta expo tem linha em EXPO_COMMAND_MAP", () => {
    const mapped = new Set(EXPO_COMMAND_MAP.map((r) => r.command));
    for (const cmd of commands) {
      if (!cmd.archs.includes("expo")) continue;
      if (UTILITY_COMMANDS.has(cmd.name)) continue;
      assert.ok(
        mapped.has(cmd.name),
        `Comando expo "${cmd.name}" não tem linha (mapeamento ou unsupported) em EXPO_COMMAND_MAP`
      );
    }
  });

  it("toda linha de EXPO_COMMAND_MAP tem script OU unsupported, nunca ambos", () => {
    for (const row of EXPO_COMMAND_MAP) {
      const hasScript = typeof row.script === "string";
      const hasUnsupported = typeof row.unsupported === "string";
      assert.ok(hasScript !== hasUnsupported, `"${row.command}" deve ter exatamente um dos dois`);
    }
  });
});

describe("[consistência] help render arquitetura e flags globais", () => {
  const help = renderGeneralHelp();

  it("exibe os rótulos de arquitetura", () => {
    assert.match(help, /\[legacy\+expo\]/);
    assert.match(help, /\[expo\]/);
    assert.match(help, /\[legacy\]/);
  });

  it("documenta as flags globais --arch e --project", () => {
    assert.match(help, /--arch <expo\|legacy>/);
    assert.match(help, /--project, -p/);
    const flagNames = globalFlags.map((f) => f.flags);
    assert.ok(flagNames.some((f) => f.includes("--arch")));
    assert.ok(flagNames.some((f) => f.includes("--project")));
  });

  it("descreve as arquiteturas suportadas", () => {
    assert.match(help, /Arquiteturas suportadas/);
    assert.match(help, /expo/);
    assert.match(help, /legacy/);
  });
});

describe("[consistência] invariante de seam: child_process na superfície dual-arch", () => {
  const newModules = [
    "src/arch/proc.js",
    "src/arch/detect.js",
    "src/arch/runner.js",
    "src/arch/expoCommands.js",
    "src/requirements/requirements.js",
    "src/requirements/detect.js",
    "src/commands/doctor.js",
    "src/commands/setup.js",
    "scripts/postinstall.js",
  ];

  it("apenas src/arch/proc.js importa node:child_process entre os módulos novos", () => {
    for (const rel of newModules) {
      const content = fs.readFileSync(path.join(rootDir, rel), "utf8");
      const importsChildProcess = /from\s+["']node:child_process["']|from\s+["']child_process["']/.test(content);
      if (rel === "src/arch/proc.js") {
        assert.ok(importsChildProcess, "proc.js deve ser o único seam de child_process");
      } else {
        assert.ok(!importsChildProcess, `${rel} não deve importar child_process diretamente (use DI/seam)`);
      }
    }
  });
});
