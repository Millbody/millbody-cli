const commands = [
  {
    name: "start",
    aliases: [],
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
    name: "run-ios",
    aliases: [],
    summary: "Roda a aplicação no simulador iOS",
    usage: "millbody run-ios [--source theme|root]",
    description:
      "Compila e executa a aplicação React Native no simulador iOS via react-native run-ios.",
    flags: [
      {
        flags: "--source, -s <theme|root>",
        description:
          "Define o tipo de pasta: theme usa estrutura de tema; root usa estrutura raiz.",
      },
    ],
    examples: ["millbody run-ios", "millbody run-ios --source root"],
    prerequisites: [
      "Xcode instalado",
      "Simulador iOS configurado",
      "source=theme: pasta deve conter ./screens e ./millbodyApp.json",
      "source=root: pasta deve conter ./mbCore e ./millbodyApp.json",
    ],
    external: [
      "react-native run-ios (source=theme chdir ../../../ antes)",
    ],
    sideEffects: [],
    interactive: true,
  },
  {
    name: "run-android",
    aliases: [],
    summary: "Roda a aplicação no emulador Android",
    usage: "millbody run-android [--source theme|root]",
    description:
      "Limpa o cache gradle e executa a aplicação React Native no emulador Android. Lê o account do millbodyApp.json para exibir qual app está rodando.",
    flags: [
      {
        flags: "--source, -s <theme|root>",
        description:
          "Define o tipo de pasta: theme usa estrutura de tema; root usa estrutura raiz.",
      },
    ],
    examples: ["millbody run-android", "millbody run-android --source root"],
    prerequisites: [
      "Android SDK, emulador Android configurado",
      "arquivo millbodyApp.json na pasta atual",
      "source=theme: pasta deve conter ./screens e ./millbodyApp.json",
      "source=root: pasta deve conter ./mbCore e ./millbodyApp.json",
    ],
    external: [
      "cd android/ && ./gradlew clean",
      "ENVFILE=.env react-native run-android",
    ],
    sideEffects: [],
    interactive: true,
  },
  {
    name: "build-android",
    aliases: [],
    summary: "Gera o bundle de release Android",
    usage: "millbody build-android [--source theme|root]",
    description:
      "Limpa o cache gradle e gera o bundle de release Android (assembleRelease).",
    flags: [
      {
        flags: "--source, -s <theme|root>",
        description:
          "Define o tipo de pasta: theme usa estrutura de tema; root usa estrutura raiz.",
      },
    ],
    examples: [
      "millbody build-android",
      "millbody build-android --source root",
    ],
    prerequisites: [
      "Android SDK e gradle configurados",
      "source=theme: pasta deve conter ./screens e ./millbodyApp.json",
      "source=root: pasta deve conter ./mbCore e ./millbodyApp.json",
    ],
    external: [
      "cd android/ && ./gradlew clean && ./gradlew assembleRelease",
    ],
    sideEffects: [],
    interactive: false,
  },
  {
    name: "codepush",
    aliases: [],
    summary: "Publica atualização OTA via CodePush",
    usage: "millbody codepush [--source theme|root]",
    description:
      "Executa o deploy do CodePush via script do mbCore. Quando source=theme, chdir ../../../ antes de rodar o script.",
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
  {
    name: "create",
    aliases: [],
    summary: "Cria uma nova configuração de app (setup completo)",
    usage: "millbody create --account <conta>",
    description:
      "Setup completo para uma nova conta: busca metadados via API, cria millbodyApp.json na raiz e na pasta do tema, cria branch git com o nome da conta, executa millbodyapp.config.js, roda fastlane e abre Xcode. Faz git commit e push ao final.",
    flags: [
      {
        flags: "--account, -a <conta>",
        description:
          "Identificador da conta na API Millbody. Obrigatório.",
      },
      {
        flags: "--track, -t <prod|beta>",
        description:
          "Define a faixa de publicação: prod executa fastlane deploy; outros valores executam fastlane create_app.",
      },
    ],
    examples: [
      "millbody create --account minha-conta",
      "millbody create --account minha-conta --track prod",
    ],
    prerequisites: [
      "source=root: pasta deve conter ./mbCore e ./millbodyApp.json",
      "git, fastlane, ttab, xed (Xcode) instalados",
      "Pasta mbContent/themes/<themeName> existente",
      "Arquivo millbodyapp.config.js na raiz",
      "mbCore/fastlane/keys/millbody.json com token de API",
      "Android SDK e gradle configurados",
    ],
    external: [
      "git checkout master && git checkout -b <account>",
      "node millbodyapp.config.js",
      "killall Xcode",
      "kill -9 'lsof -t -i:8081'",
      "cd android && fastlane default_setapp theme_folder:<themeName>",
      "git add --all && git commit -m 'launch app' && git push origin <account>",
      "ttab 'cd <themeFolder>; millbody start'",
      "cd ios && xed .",
      "cd android && ./gradlew bundleRelease",
      "cd ios && fastlane deploy|create_app theme_folder:<themeName>",
    ],
    sideEffects: [
      "Cria millbodyApp.json na raiz do projeto",
      "Cria millbodyApp.json na pasta do tema",
      "Cria branch git com o nome da conta",
      "Faz git commit e git push",
      "Abre nova aba no terminal (ttab)",
      "Abre Xcode (xed)",
    ],
    interactive: true,
  },
  {
    name: "update-apk",
    aliases: ["updateapp"],
    summary: "Atualiza um app existente e gera novo build",
    usage: "millbody update-apk --account <conta>",
    description:
      "Atualiza um app existente: faz merge do master no branch da conta, executa millbodyapp.config.js, roda fastlane beta/deploy nos dois targets (iOS e Android) e faz git commit e push.",
    flags: [
      {
        flags: "--account, -a <conta>",
        description:
          "Identificador da conta na API Millbody. Obrigatório.",
      },
      {
        flags: "--track, -t <prod|beta>",
        description:
          "Define a faixa de publicação: prod executa fastlane deploy; outros valores executam fastlane beta.",
      },
    ],
    examples: [
      "millbody update-apk --account minha-conta",
      "millbody updateapp --account minha-conta --track prod",
      "millbody update-apk --account minha-conta --track prod",
    ],
    prerequisites: [
      "source=root: pasta deve conter ./mbCore e ./millbodyApp.json",
      "git, fastlane, ttab, xed (Xcode) instalados",
      "Pasta mbContent/themes/<themeName> existente",
      "Arquivo millbodyapp.config.js na raiz",
      "Android SDK e gradle configurados",
    ],
    external: [
      "git checkout master && git branch -c <account> && git merge master",
      "kill -9 'lsof -t -i:8081'",
      "killall Xcode",
      "ttab 'cd <themeFolder>; millbody start'",
      "cd ios && xed .",
      "node millbodyapp.config.js",
      "git add --all && git commit -m 'update app' && git push origin <account>",
      "cd ios && fastlane deploy|beta theme_folder:<themeName> update_config:true",
      "cd android && fastlane deploy|beta theme_folder:<themeName> update_config:true",
    ],
    sideEffects: [
      "Faz merge do master no branch da conta",
      "Faz git commit e git push",
      "Abre nova aba no terminal (ttab)",
      "Abre Xcode (xed)",
    ],
    interactive: false,
  },
];

export default commands;
