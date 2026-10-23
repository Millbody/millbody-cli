const expoCommands = [
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
];

export default expoCommands;
