import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import commands from "./commands/registry.js";

const packageJsonPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "package.json"
);

export async function getVersion() {
  const raw = await fs.readFile(packageJsonPath, "utf8");
  return JSON.parse(raw).version;
}

export function findCommand(name, registry = commands) {
  return registry.find(
    (cmd) => cmd.name === name || cmd.aliases.includes(name)
  );
}

export function renderGeneralHelp(registry = commands) {
  const lines = [
    "millbody — CLI para projetos usando o framework gym.Millbody",
    "",
    "Uso:",
    "  millbody <comando> [opções]",
    "  millbody help <comando>",
    "",
    "Comandos:",
  ];

  for (const cmd of registry) {
    const aliasText =
      cmd.aliases.length > 0 ? ` (alias: ${cmd.aliases.join(", ")})` : "";
    lines.push(`  ${cmd.name}${aliasText.padEnd(20 - cmd.name.length)}  ${cmd.summary}`);
  }

  lines.push(
    "",
    "Opções globais:",
    "  --source, -s <theme|root>   Tipo de pasta do projeto (padrão: theme)",
    "  --account, -a <conta>       Identificador da conta na API Millbody",
    "  --track, -t <prod|beta>     Faixa de publicação (fastlane)",
    "  --help, -h                  Exibe esta ajuda",
    "  --version, -v               Exibe a versão instalada",
    "",
    'Use "millbody help <comando>" para detalhes de um comando específico.'
  );

  return lines.join("\n");
}

export function renderCommandHelp(name, registry = commands) {
  const cmd = findCommand(name, registry);
  if (!cmd) {
    return renderUnknownCommand(name, registry);
  }

  const lines = [
    `millbody ${cmd.name} — ${cmd.summary}`,
    "",
    "Uso:",
    `  ${cmd.usage}`,
  ];

  if (cmd.aliases.length > 0) {
    lines.push("", `Aliases: ${cmd.aliases.join(", ")}`);
  }

  lines.push("", "Descrição:", `  ${cmd.description}`);

  if (cmd.flags.length > 0) {
    lines.push("", "Opções:");
    for (const flag of cmd.flags) {
      lines.push(`  ${flag.flags}`);
      lines.push(`      ${flag.description}`);
    }
  }

  if (cmd.examples.length > 0) {
    lines.push("", "Exemplos:");
    for (const example of cmd.examples) {
      lines.push(`  $ ${example}`);
    }
  }

  if (cmd.prerequisites.length > 0) {
    lines.push("", "Pré-requisitos:");
    for (const prereq of cmd.prerequisites) {
      lines.push(`  - ${prereq}`);
    }
  }

  if (cmd.external.length > 0) {
    lines.push("", "Comandos externos executados:");
    for (const ext of cmd.external) {
      lines.push(`  ${ext}`);
    }
  }

  if (cmd.sideEffects.length > 0) {
    lines.push("", "Efeitos colaterais:");
    for (const effect of cmd.sideEffects) {
      lines.push(`  - ${effect}`);
    }
  }

  return lines.join("\n");
}

export function renderUnknownCommand(name, registry = commands) {
  const knownNames = registry.map((cmd) => cmd.name).join(", ");
  return `Comando desconhecido: ${name}\n\nComandos disponíveis: ${knownNames}\n\nUse "millbody --help" para ver a lista completa.`;
}

export function resolveInformational(parsed, registry = commands) {
  if (parsed.version) {
    return { kind: "version" };
  }

  if (parsed.help || parsed.template === "help") {
    const subcommand = parsed.helpSubcommand;

    if (!subcommand || subcommand === "help") {
      return { kind: "general-help", text: renderGeneralHelp(registry) };
    }

    const cmd = findCommand(subcommand, registry);
    if (cmd) {
      return { kind: "command-help", text: renderCommandHelp(subcommand, registry) };
    }
    return { kind: "unknown-command", text: renderUnknownCommand(subcommand, registry) };
  }

  return null;
}
