const legacyCommands = [
  {
    name: "start",
    aliases: [],
    archs: ["legacy"],
    summary: "Sobe o Metro/React Native bundler",
    usage: "millbody start [--source theme|root]",
    description:
      "Inicia o servidor Metro (React Native bundler). Quando --source é theme, copia millbodyApp.json para a raiz do projeto antes de subir o bundler.",
    flags: [
      {
        flags: "--source, -s <theme|root>",
        description:
          "Define o tipo de pasta: theme (padrão) usa ./screens + ./millbodyApp.json; root usa ./mbCore + ./millbodyApp.json.",
      },
    ],
    examples: ["millbody start", "millbody start --source root"],
    prerequisites: [
      "source=theme: pasta deve conter ./screens e ./millbodyApp.json",
      "source=root: pasta deve conter ./mbCore e ./millbodyApp.json",
    ],
    external: [
      "npm start --reset-cache (source=theme)",
      "npx react-native start --reset-cache (source=root)",
    ],
    sideEffects: [
      "Copia millbodyApp.json para ../../../ quando source=theme",
    ],
    interactive: true,
  },
  {
    name: "test",
    aliases: [],
    archs: ["legacy"],
    summary: "Roda os testes Android no ambiente de teste",
    usage: "millbody test [--source theme|root]",
    description:
      "Executa a suite de testes Android. Requer arquivo index.test.js na pasta atual. Limpa o cache do gradle antes de rodar.",
    flags: [
      {
        flags: "--source, -s <theme|root>",
        description:
          "Define o tipo de pasta: theme usa estrutura de tema; root usa estrutura raiz.",
      },
    ],
    examples: ["millbody test", "millbody test --source root"],
    prerequisites: [
      "Arquivo index.test.js na pasta atual",
      "Android SDK e gradle configurados",
      "source=theme: pasta deve conter ./screens e ./millbodyApp.json",
      "source=root: pasta deve conter ./mbCore e ./millbodyApp.json",
    ],
    external: [
      "cd android/ && ./gradlew clean",
      "ENVFILE=.env.test react-native run-android",
    ],
    sideEffects: [],
    interactive: false,
  },
  {
    name: "codepush",
    aliases: [],
    archs: ["legacy"],
    summary: "Publica atualização OTA via CodePush",
    usage: "millbody codepush [--source theme|root]",
    description:
      "Executa o deploy do CodePush via script do mbCore. Quando source=theme, chdir ../../../ antes de rodar o script. Não disponível no modo expo (use EAS Update).",
    flags: [
      {
        flags: "--source, -s <theme|root>",
        description:
          "Define o tipo de pasta: theme usa estrutura de tema; root usa estrutura raiz.",
      },
    ],
    examples: ["millbody codepush", "millbody codepush --source root"],
    prerequisites: [
      "mbCore/framework/script.js disponível",
      "Conta CodePush configurada",
      "source=theme: pasta deve conter ./screens e ./millbodyApp.json",
      "source=root: pasta deve conter ./mbCore e ./millbodyApp.json",
    ],
    external: [
      "node ./mbCore/framework/script.js codepush deploy",
    ],
    sideEffects: [],
    interactive: true,
  },
];

export default legacyCommands;
