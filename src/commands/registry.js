import legacyCommands from "./registry/legacy.js";
import expoCommands from "./registry/expo.js";
import sharedCommands from "./registry/shared.js";

export const globalFlags = [
  {
    flags: "--arch <expo|legacy>",
    description:
      "Força a arquitetura do projeto (bypassa detecção automática). Valores: expo, legacy.",
  },
  {
    flags: "--project, -p <caminho>",
    description:
      "Define o diretório do projeto (padrão: diretório atual). Deve existir e ser um diretório.",
  },
  {
    flags: "--source, -s <theme|root>",
    description:
      "Tipo de pasta do projeto (legado). theme (padrão) usa ./screens + ./millbodyApp.json; root usa ./mbCore + ./millbodyApp.json.",
  },
  {
    flags: "--account, -a <conta>",
    description: "Identificador da conta na API Millbody.",
  },
  {
    flags: "--track, -t <prod|beta>",
    description: "Faixa de publicação (fastlane).",
  },
  {
    flags: "--yes, -y",
    description: "Confirma prompts interativos sem aguardar entrada do usuário.",
  },
  {
    flags: "--dry-run",
    description: "Mostra o que seria feito sem executar nada.",
  },
  {
    flags: "--help, -h",
    description: "Exibe ajuda.",
  },
  {
    flags: "--version, -v",
    description: "Exibe a versão instalada.",
  },
];

const commands = [
  ...legacyCommands.slice(0, 2),
  ...sharedCommands.slice(0, 3),
  expoCommands[0],
  legacyCommands[2],
  ...sharedCommands.slice(3, 5),
  expoCommands[1],
  expoCommands[2],
  sharedCommands[5],
  sharedCommands[6],
];

export default commands;
