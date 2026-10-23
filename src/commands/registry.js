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
    name: "run-ios",
    aliases: [],
    archs: ["legacy", "expo"],
    summary: "Roda a aplicação no simulador iOS",
    usage: "millbody run-ios [--source theme|root]",
    description:
      "Compila e executa a aplicação React Native no simulador iOS. No modo legacy usa react-native run-ios; no modo expo usa yarn ios.",
    flags: [
      {
        flags: "--source, -s <theme|root>",
        description:
          "Define o tipo de pasta: theme usa estrutura de tema; root usa estrutura raiz. (Somente no modo legacy)",
      },
    ],
    examples: ["millbody run-ios", "millbody run-ios --source root", "millbody run-ios --arch expo --project ./app-mobile"],
    prerequisites: [
      "Xcode instalado",
      "Simulador iOS configurado",
      "source=theme: pasta deve conter ./screens e ./millbodyApp.json (legacy)",
      "source=root: pasta deve conter ./mbCore e ./millbodyApp.json (legacy)",
    ],
    external: [
      "react-native run-ios (legacy, source=theme chdir ../../../ antes)",
      "yarn ios (expo)",
    ],
    sideEffects: [],
    interactive: true,
  },
  {
    name: "run-android",
    aliases: [],
    archs: ["legacy", "expo"],
    summary: "Roda a aplicação no emulador Android",
    usage: "millbody run-android [--source theme|root]",
    description:
      "Limpa o cache gradle e executa a aplicação no emulador Android. No modo legacy usa react-native run-android; no modo expo usa yarn android.",
    flags: [
      {
        flags: "--source, -s <theme|root>",
        description:
          "Define o tipo de pasta: theme usa estrutura de tema; root usa estrutura raiz. (Somente no modo legacy)",
      },
    ],
    examples: ["millbody run-android", "millbody run-android --source root", "millbody run-android --arch expo --project ./app-mobile"],
    prerequisites: [
      "Android SDK, emulador Android configurado",
      "arquivo millbodyApp.json na pasta atual (legacy)",
      "source=theme: pasta deve conter ./screens e ./millbodyApp.json (legacy)",
      "source=root: pasta deve conter ./mbCore e ./millbodyApp.json (legacy)",
    ],
    external: [
      "cd android/ && ./gradlew clean (legacy)",
      "ENVFILE=.env react-native run-android (legacy)",
      "yarn android (expo)",
    ],
    sideEffects: [],
    interactive: true,
  },
  {
    name: "build-android",
    aliases: [],
    archs: ["legacy", "expo"],
    summary: "Gera o bundle de release Android",
    usage: "millbody build-android [--source theme|root]",
    description:
      "Gera o bundle de release Android. No modo legacy usa gradlew assembleRelease; no modo expo usa yarn predeploy:android.",
    flags: [
      {
        flags: "--source, -s <theme|root>",
        description:
          "Define o tipo de pasta: theme usa estrutura de tema; root usa estrutura raiz. (Somente no modo legacy)",
      },
    ],
    examples: [
      "millbody build-android",
      "millbody build-android --source root",
      "millbody build-android --arch expo --project ./app-mobile",
    ],
    prerequisites: [
      "Android SDK e gradle configurados",
      "source=theme: pasta deve conter ./screens e ./millbodyApp.json (legacy)",
      "source=root: pasta deve conter ./mbCore e ./millbodyApp.json (legacy)",
    ],
    external: [
      "cd android/ && ./gradlew clean && ./gradlew assembleRelease (legacy)",
      "yarn predeploy:android (expo)",
    ],
    sideEffects: [],
    interactive: false,
  },
  {
    name: "build-ios",
    aliases: [],
    archs: ["expo"],
    summary: "Gera o build de release iOS (expo)",
    usage: "millbody build-ios --arch expo --project <caminho>",
    description:
      "Executa o pipeline de build iOS do app-mobile via yarn predeploy:ios. Disponível somente no modo expo.",
    flags: [],
    examples: ["millbody build-ios --arch expo --project ./app-mobile"],
    prerequisites: [
      "Xcode instalado",
      "yarn instalado",
      "Projeto expo em --project",
    ],
    external: ["yarn predeploy:ios"],
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
  {
    name: "create",
    aliases: [],
    archs: ["legacy", "expo"],
    summary: "Cria uma nova configuração de app (setup completo)",
    usage: "millbody create --account <conta>",
    description:
      "Setup completo para uma nova conta. No modo legacy: busca metadados via API, cria millbodyApp.json, branch git, executa fastlane e abre Xcode. No modo expo: valida conta, grava EXPO_PUBLIC_ACCOUNT em .env.account e roda yarn millbody:create.",
    flags: [
      {
        flags: "--account, -a <conta>",
        description:
          "Identificador da conta. Obrigatório. No modo expo: deve seguir o padrão /^[a-z0-9][a-z0-9_-]*$/i.",
      },
      {
        flags: "--track, -t <prod|beta>",
        description:
          "Define a faixa de publicação: prod executa fastlane deploy; outros valores executam fastlane create_app. (Somente legacy)",
      },
    ],
    examples: [
      "millbody create --account minha-conta",
      "millbody create --account minha-conta --track prod",
      "millbody create --account minha-conta --arch expo --project ./app-mobile",
    ],
    prerequisites: [
      "source=root: pasta deve conter ./mbCore e ./millbodyApp.json (legacy)",
      "git, fastlane, ttab, xed (Xcode) instalados (legacy)",
      "Pasta mbContent/themes/<themeName> existente (legacy)",
      "Arquivo millbodyapp.config.js na raiz (legacy)",
      "mbCore/fastlane/keys/millbody.json com token de API (legacy)",
      "Android SDK e gradle configurados (legacy)",
      "yarn instalado (expo)",
    ],
    external: [
      "git checkout master && git checkout -b <account> (legacy)",
      "node millbodyapp.config.js (legacy)",
      "killall Xcode (legacy)",
      "kill -9 'lsof -t -i:8081' (legacy)",
      "cd android && fastlane default_setapp theme_folder:<themeName> (legacy)",
      "git add --all && git commit -m 'launch app' && git push origin <account> (legacy)",
      "ttab 'cd <themeFolder>; millbody start' (legacy)",
      "cd ios && xed . (legacy)",
      "cd android && ./gradlew bundleRelease (legacy)",
      "cd ios && fastlane deploy|create_app theme_folder:<themeName> (legacy)",
      "yarn millbody:create (expo)",
    ],
    sideEffects: [
      "Cria millbodyApp.json na raiz do projeto (legacy)",
      "Cria millbodyApp.json na pasta do tema (legacy)",
      "Cria branch git com o nome da conta (legacy)",
      "Faz git commit e git push (legacy)",
      "Abre nova aba no terminal (ttab) (legacy)",
      "Abre Xcode (xed) (legacy)",
      "Grava EXPO_PUBLIC_ACCOUNT em .env.account (expo)",
    ],
    interactive: true,
  },
  {
    name: "update-apk",
    aliases: ["updateapp"],
    archs: ["legacy", "expo"],
    summary: "Atualiza um app existente e gera novo build",
    usage: "millbody update-apk --account <conta>",
    description:
      "Atualiza um app existente. No modo legacy: faz merge do master, executa millbodyapp.config.js, roda fastlane. No modo expo: executa yarn millbody (pipeline completo: connect-alderaan → download-images → ícones → rebuild).",
    flags: [
      {
        flags: "--account, -a <conta>",
        description:
          "Identificador da conta na API Millbody. Obrigatório. (Somente legacy)",
      },
      {
        flags: "--track, -t <prod|beta>",
        description:
          "Define a faixa de publicação: prod executa fastlane deploy; outros valores executam fastlane beta. (Somente legacy)",
      },
    ],
    examples: [
      "millbody update-apk --account minha-conta",
      "millbody updateapp --account minha-conta --track prod",
      "millbody update-apk --account minha-conta --track prod",
      "millbody update-apk --arch expo --project ./app-mobile",
    ],
    prerequisites: [
      "source=root: pasta deve conter ./mbCore e ./millbodyApp.json (legacy)",
      "git, fastlane, ttab, xed (Xcode) instalados (legacy)",
      "Pasta mbContent/themes/<themeName> existente (legacy)",
      "Arquivo millbodyapp.config.js na raiz (legacy)",
      "Android SDK e gradle configurados",
      "yarn instalado (expo)",
    ],
    external: [
      "git checkout master && git branch -c <account> && git merge master (legacy)",
      "kill -9 'lsof -t -i:8081' (legacy)",
      "killall Xcode (legacy)",
      "ttab 'cd <themeFolder>; millbody start' (legacy)",
      "cd ios && xed . (legacy)",
      "node millbodyapp.config.js (legacy)",
      "git add --all && git commit -m 'update app' && git push origin <account> (legacy)",
      "cd ios && fastlane deploy|beta theme_folder:<themeName> update_config:true (legacy)",
      "cd android && fastlane deploy|beta theme_folder:<themeName> update_config:true (legacy)",
      "yarn millbody (expo)",
    ],
    sideEffects: [
      "Faz merge do master no branch da conta (legacy)",
      "Faz git commit e git push (legacy)",
      "Abre nova aba no terminal (ttab) (legacy)",
      "Abre Xcode (xed) (legacy)",
    ],
    interactive: false,
  },
  {
    name: "web",
    aliases: [],
    archs: ["expo"],
    summary: "Sobe o servidor web do app-mobile (expo start --web)",
    usage: "millbody web --arch expo --project <caminho>",
    description:
      "Inicia o servidor Expo para a plataforma web via yarn web. Disponível somente no modo expo.",
    flags: [],
    examples: ["millbody web --arch expo --project ./app-mobile"],
    prerequisites: ["yarn instalado", "Projeto expo em --project"],
    external: ["yarn web"],
    sideEffects: [],
    interactive: false,
  },
  {
    name: "connect-alderaan",
    aliases: [],
    archs: ["expo"],
    summary: "Atualiza millbody.json da API Alderaan sem rebuild completo (expo)",
    usage: "millbody connect-alderaan --arch expo --project <caminho>",
    description:
      "Executa yarn connect-alderaan no app-mobile: atualiza millbody.json a partir da API Alderaan sem disparar o pipeline completo de rebuild. Operação idempotente. Disponível somente no modo expo.",
    flags: [],
    examples: ["millbody connect-alderaan --arch expo --project ./app-mobile"],
    prerequisites: ["yarn instalado", "Projeto expo em --project"],
    external: ["yarn connect-alderaan"],
    sideEffects: ["Atualiza millbody.json no projeto"],
    interactive: false,
  },
  {
    name: "doctor",
    aliases: [],
    archs: ["legacy", "expo"],
    summary: "Verifica requisitos externos do projeto",
    usage: "millbody doctor [--arch <expo|legacy>] [--project <caminho>]",
    description:
      "Exibe uma tabela ✓/✗ dos requisitos externos para a arquitetura detectada (ou forçada com --arch). Somente leitura — não instala nada. Sai com código 1 se faltar algum requisito obrigatório.",
    flags: [
      {
        flags: "--arch <expo|legacy>",
        description: "Força a arquitetura a verificar.",
      },
      {
        flags: "--project, -p <caminho>",
        description: "Diretório do projeto a verificar (padrão: diretório atual).",
      },
    ],
    examples: [
      "millbody doctor",
      "millbody doctor --arch expo --project ./app-mobile",
    ],
    prerequisites: [],
    external: [],
    sideEffects: [],
    interactive: false,
  },
  {
    name: "setup",
    aliases: [],
    archs: ["legacy", "expo"],
    summary: "Instala requisitos externos faltantes automaticamente",
    usage: "millbody setup [--arch <expo|legacy>] [--project <caminho>] [--yes] [--dry-run]",
    description:
      "Detecta requisitos faltantes e auto-instala os que suportam instalação automática (via brew, corepack, gem). Solicita confirmação antes de instalar (use --yes para pular). Com --dry-run apenas exibe o plano sem instalar.",
    flags: [
      {
        flags: "--arch <expo|legacy>",
        description: "Força a arquitetura a configurar.",
      },
      {
        flags: "--project, -p <caminho>",
        description: "Diretório do projeto (padrão: diretório atual).",
      },
      {
        flags: "--yes, -y",
        description: "Confirma a instalação sem aguardar input do usuário.",
      },
      {
        flags: "--dry-run",
        description: "Exibe o plano de instalação sem executar nada.",
      },
    ],
    examples: [
      "millbody setup",
      "millbody setup --dry-run",
      "millbody setup --yes",
      "millbody setup --arch expo --project ./app-mobile",
    ],
    prerequisites: ["macOS (darwin) — instalação automática não suportada em outros sistemas"],
    external: ["brew install <formula>", "corepack enable", "gem install <formula>"],
    sideEffects: ["Instala dependências externas no sistema"],
    interactive: false,
  },
];

export default commands;
