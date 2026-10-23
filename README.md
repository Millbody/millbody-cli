# millbody CLI

CLI para projetos que usam o framework **gym.Millbody**. Automatiza tarefas de desenvolvimento, build, publicação e configuração de aplicativos React Native gerenciados pela plataforma Millbody.

---

## Requisitos

- **Node.js** >= 23 (definido em `.nvmrc`; use `nvm use` para selecionar a versão correta)
- **npm** ou **yarn**

Na instalação global (`npm install -g`), o CLI detecta e instala automaticamente as dependências externas necessárias via `millbody setup`. Para pular a instalação automática, use `MILLBODY_SKIP_SETUP=1` ou `npm install -g --ignore-scripts`.

As ferramentas necessárias variam por arquitetura e comando — use `millbody doctor` para verificar e `millbody setup` para instalar as que faltarem.

---

## Instalação

### Global (recomendado)

```bash
npm install -g @millbody/millbody-cli
# ou
yarn global add @millbody/millbody-cli
```

O postinstall detecta a arquitetura do projeto e instala automaticamente as dependências externas faltantes (git, Homebrew, yarn, watchman, CocoaPods, JDK 17, fastlane) via `brew`, `corepack` ou `gem`. A instalação é **best-effort**: se falhar, o CLI ainda fica disponível. Ferramentas que exigem interação manual (Xcode, Android SDK, Homebrew) são apenas orientadas.

Para pular a instalação automática:
```bash
# Variável de ambiente
MILLBODY_SKIP_SETUP=1 npm install -g @millbody/millbody-cli

# Flag npm
npm install -g --ignore-scripts @millbody/millbody-cli
```

### Local / npx

```bash
npx @millbody/millbody-cli <comando>
```

---

## Início rápido

```bash
# Verificar versão instalada
millbody --version

# Listar todos os comandos
millbody --help

# Subir o bundler no projeto raiz
millbody start --source root

# Criar setup completo para uma nova conta
millbody create --account minha-conta
```

---

## Arquiteturas suportadas

O CLI suporta dois modos de projeto com detecção automática:

### Arquitetura `legacy`

Projetos React Native clássicos gerenciados pelo framework gym.Millbody:
- Detectado por: presença de `mbCore/` **ou** `millbodyApp.json`
- Comandos: `start`, `test`, `run-ios`, `run-android`, `build-android`, `codepush`, `create`, `update-apk`
- Ferramentas: react-native CLI, fastlane, git, ttab, Xcode, Android SDK

### Arquitetura `expo`

Projetos usando o repositório `app-mobile` (Expo SDK ~57, RN 0.86, Yarn 1.x):
- Detectado por: presença de `millbody.json` **e** (`app.config.ts` ou `app.json` com chave `expo` ou `expo` em `package.json`)
- Comandos: `start`, `run-ios`, `run-android`, `build-android`, `build-ios`, `web`, `connect-alderaan`, `create`, `update-apk`
- Ferramentas: yarn, watchman, CocoaPods, JDK 17, Xcode, Android SDK

### Regras de detecção

1. `--arch <expo|legacy>` — força a arquitetura (bypassa detecção)
2. Marcadores expo presentes → `expo`
3. Marcadores legacy presentes → `legacy`
4. Ambos presentes → `expo` (registrado como ambíguo; use `--arch` para forçar)
5. Nenhum marcador → erro (especifique `--arch` ou navegue para o projeto correto)

```bash
# Forçar arquitetura
millbody doctor --arch expo --project ./app-mobile
millbody setup --arch legacy --project ./meu-projeto-legacy
```

---

## Estrutura esperada do projeto

O CLI diferencia dois tipos de pasta com a opção `--source`:

### `--source theme` (padrão)

Pasta de um **tema** Millbody. Deve conter:
- `./screens/` — pasta com as telas do tema
- `./millbodyApp.json` — configuração do app

Caminho típico: `mbContent/themes/<themeName>/`

### `--source root`

Pasta **raiz** do projeto Millbody. Deve conter:
- `./mbCore/` — núcleo do framework
- `./millbodyApp.json` — configuração do app

Arquivos importantes na raiz:
- `mbCore/Constants.js` (ou `mbCore/Constants/index.js`) — deve exportar `constants.uri` com a URL da API
- `mbCore/fastlane/keys/millbody.json` — token de API (`{ "token": "..." }`)
- `millbodyapp.config.js` — script de configuração executado por `create` e `update-apk`
- `mbContent/themes/<themeName>/` — pasta do tema referenciado em `millbodyApp.json`

---

## Referência completa de comandos

### millbody start

Sobe o Metro/React Native bundler.

Quando `--source theme`, copia `millbodyApp.json` para `../../../` antes de subir o bundler.

**Flags:**
- `--source, -s <theme|root>` — tipo de pasta (padrão: `theme`)

**Comandos externos executados:**
- `npm start --reset-cache` (source=theme)
- `npx react-native start --reset-cache` (source=root)

**Efeitos colaterais:**
- Copia `millbodyApp.json` para `../../../` quando source=theme

**Exemplos:**
```bash
millbody start
millbody start --source root
```

---

### millbody test

Roda os testes Android no ambiente de teste.

Requer o arquivo `index.test.js` na pasta atual. Caso o arquivo não exista, exibe aviso e não executa nada.

**Flags:**
- `--source, -s <theme|root>` — tipo de pasta (padrão: `theme`)

**Comandos externos executados:**
- `cd android/ && ./gradlew clean`
- `ENVFILE=.env.test react-native run-android`

**Exemplos:**
```bash
millbody test
millbody test --source root
```

---

### millbody run-ios

Roda a aplicação no simulador iOS.

**Flags:**
- `--source, -s <theme|root>` — tipo de pasta (padrão: `theme`)

**Comandos externos executados:**
- `react-native run-ios` (quando source=theme, executa a partir de `../../../`)

**Exemplos:**
```bash
millbody run-ios
millbody run-ios --source root
```

---

### millbody run-android

Limpa o cache gradle e roda a aplicação no emulador Android.

Lê o campo `account` do `millbodyApp.json` local para exibir qual app está sendo executado. Requer o arquivo `millbodyApp.json` na pasta atual.

**Flags:**
- `--source, -s <theme|root>` — tipo de pasta (padrão: `theme`)

**Comandos externos executados:**
- `cd android/ && ./gradlew clean`
- `ENVFILE=.env react-native run-android`

**Exemplos:**
```bash
millbody run-android
millbody run-android --source root
```

---

### millbody build-android

Gera o bundle de release Android (`assembleRelease`).

**Flags:**
- `--source, -s <theme|root>` — tipo de pasta (padrão: `theme`)

**Comandos externos executados:**
- `cd android/ && ./gradlew clean && ./gradlew assembleRelease`

**Exemplos:**
```bash
millbody build-android
millbody build-android --source root
```

---

### millbody codepush

Publica uma atualização OTA (over-the-air) via CodePush.

**Flags:**
- `--source, -s <theme|root>` — tipo de pasta (padrão: `theme`)

**Comandos externos executados:**
- `node ./mbCore/framework/script.js codepush deploy`
  (quando source=theme, executa a partir de `../../../`)

**Exemplos:**
```bash
millbody codepush
millbody codepush --source root
```

---

### millbody create

Setup completo para uma nova conta: busca metadados via API Millbody, cria `millbodyApp.json` na raiz e na pasta do tema, cria branch git com o nome da conta, executa `millbodyapp.config.js`, roda `fastlane` e abre o Xcode. Faz `git commit` e `git push` ao final.

**Requer** `--account`. Sem ele, exibe aviso e encerra sem executar nada.

**Flags:**
- `--account, -a <conta>` — identificador da conta na API Millbody (**obrigatório**)
- `--track, -t <prod|beta>` — faixa de publicação: `prod` → `fastlane deploy`; outros → `fastlane create_app`

**Comandos externos executados (na ordem):**
1. `git checkout master && git checkout -b <account>` (na pasta do tema)
2. `node millbodyapp.config.js`
3. `killall Xcode`
4. `kill -9 'lsof -t -i:8081'`
5. `cd android && fastlane default_setapp theme_folder:<themeName>`
6. `git add --all && git commit -m "launch app" && git push origin <account>`
7. `ttab "cd <themeFolder>; millbody start"`
8. `cd ios && xed .`
9. `cd android && ./gradlew bundleRelease`
10. `cd ios && fastlane deploy|create_app theme_folder:<themeName>`

**Efeitos colaterais:**
- Cria/sobrescreve `millbodyApp.json` na raiz e na pasta do tema
- Cria branch git com o nome da conta e faz push
- Abre nova aba no terminal (`ttab`)
- Abre Xcode (`xed`)

**Exemplos:**
```bash
millbody create --account minha-conta
millbody create --account minha-conta --track prod
```

---

### millbody update-apk

Atualiza um app existente: faz merge do `master` no branch da conta, executa `millbodyapp.config.js`, roda `fastlane beta/deploy` para iOS e Android, e faz `git commit` e `git push`.

Também disponível pelo alias `updateapp`.

**Flags:**
- `--account, -a <conta>` — identificador da conta na API Millbody (**obrigatório**)
- `--track, -t <prod|beta>` — faixa de publicação: `prod` → `fastlane deploy`; outros → `fastlane beta`

**Comandos externos executados (na ordem):**
1. `git checkout master && git branch -c <account> && git merge master` (na pasta do tema)
2. `kill -9 'lsof -t -i:8081'`
3. `killall Xcode`
4. `ttab "cd <themeFolder>; millbody start"`
5. `cd ios && xed .`
6. `node millbodyapp.config.js`
7. `git add --all && git commit -m "update app" && git push origin <account>`
8. `cd ios && fastlane deploy|beta theme_folder:<themeName> update_config:true`
9. `cd android && fastlane deploy|beta theme_folder:<themeName> update_config:true`

**Efeitos colaterais:**
- Faz merge do `master` no branch da conta
- Faz `git commit` e `git push`
- Abre nova aba no terminal (`ttab`)
- Abre Xcode (`xed`)

**Exemplos:**
```bash
millbody update-apk --account minha-conta
millbody updateapp --account minha-conta
millbody update-apk --account minha-conta --track prod
```

---

### millbody build-ios

Executa o pipeline de build iOS do app-mobile via `yarn predeploy:ios`. **Disponível somente no modo expo.**

**Flags:**
- `--arch <expo|legacy>` — força a arquitetura (obrigatório para este comando)
- `--project, -p <caminho>` — diretório do projeto app-mobile

**Comandos externos executados:**
- `yarn predeploy:ios` (clean + install + compile + millbody + prebuild + `xed ios`)

**Exemplos:**
```bash
millbody build-ios --arch expo --project ./app-mobile
```

---

### millbody web

Inicia o servidor Expo para a plataforma web via `yarn web`. **Disponível somente no modo expo.**

**Flags:**
- `--arch <expo|legacy>` — força a arquitetura
- `--project, -p <caminho>` — diretório do projeto app-mobile

**Comandos externos executados:**
- `yarn web`

**Exemplos:**
```bash
millbody web --arch expo --project ./app-mobile
```

---

### millbody connect-alderaan

Atualiza `millbody.json` a partir da API Alderaan sem disparar o pipeline completo de rebuild. Operação idempotente. **Disponível somente no modo expo.**

**Flags:**
- `--arch <expo|legacy>` — força a arquitetura
- `--project, -p <caminho>` — diretório do projeto app-mobile

**Comandos externos executados:**
- `yarn connect-alderaan`

**Exemplos:**
```bash
millbody connect-alderaan --arch expo --project ./app-mobile
```

---

### millbody doctor

Verifica os requisitos externos para a arquitetura detectada (ou forçada). Somente leitura — não instala nada. Exibe tabela ✓/✗ com instrução de correção para cada item. Sai com código 1 se faltar algum requisito obrigatório.

**Flags:**
- `--arch <expo|legacy>` — força a arquitetura a verificar
- `--project, -p <caminho>` — diretório do projeto (padrão: diretório atual)

**Exemplos:**
```bash
millbody doctor
millbody doctor --arch expo --project ./app-mobile
millbody doctor --arch legacy
```

---

### millbody setup

Detecta requisitos faltantes e instala automaticamente os que suportam instalação automática (via `brew`, `corepack` ou `gem`). Solicita confirmação antes de instalar. Com `--dry-run` apenas exibe o plano sem instalar.

**Flags:**
- `--arch <expo|legacy>` — força a arquitetura a configurar
- `--project, -p <caminho>` — diretório do projeto (padrão: diretório atual)
- `--yes, -y` — confirma a instalação sem aguardar input do usuário
- `--dry-run` — exibe o plano de instalação sem executar nada

**Exemplos:**
```bash
millbody setup
millbody setup --dry-run
millbody setup --yes
millbody setup --arch expo --project ./app-mobile
```

---

## Tutoriais passo a passo

### Nova conta com `create`

```bash
# 1. Entrar na pasta raiz do projeto Millbody
cd /caminho/para/projeto-raiz

# 2. Criar setup completo
millbody create --account nome-da-conta

# Para publicar direto em produção:
millbody create --account nome-da-conta --track prod
```

### Atualizar app existente com `update-apk`

```bash
# 1. Entrar na pasta raiz do projeto Millbody
cd /caminho/para/projeto-raiz

# 2. Atualizar (envia para beta por padrão)
millbody update-apk --account nome-da-conta

# Para publicar direto em produção:
millbody update-apk --account nome-da-conta --track prod
```

### Desenvolvimento dia a dia

```bash
# Subir o bundler (em pasta de tema)
millbody start

# Rodar no iOS
millbody run-ios

# Rodar no Android
millbody run-android
```

### Publicar atualização OTA via CodePush

```bash
# Em pasta de tema
millbody codepush

# Em pasta raiz
millbody codepush --source root
```

### Build Android

```bash
millbody build-android
millbody build-android --source root
```

### Fluxo completo com app-mobile (expo)

```bash
# 1. Verificar requisitos
millbody doctor --arch expo --project ./app-mobile

# 2. Instalar o que faltar (opcional — postinstall já faz isso na instalação global)
millbody setup --arch expo --project ./app-mobile

# 3. Criar configuração para nova conta
millbody create --account minha-conta --arch expo --project ./app-mobile

# 4. Rodar no iOS
millbody run-ios --arch expo --project ./app-mobile

# 5. Rodar no Android
millbody run-android --arch expo --project ./app-mobile

# 6. Atualizar app existente (pipeline completo)
millbody update-apk --arch expo --project ./app-mobile

# 7. Build iOS para release
millbody build-ios --arch expo --project ./app-mobile

# 8. Build Android para release
millbody build-android --arch expo --project ./app-mobile

# 9. Atualizar apenas a configuração Alderaan (sem rebuild completo)
millbody connect-alderaan --arch expo --project ./app-mobile
```

---

## Opções globais

| Opção | Alias | Descrição |
|-------|-------|-----------|
| `--arch <expo\|legacy>` | — | Força a arquitetura do projeto (bypassa detecção) |
| `--project <caminho>` | `-p` | Diretório do projeto (padrão: diretório atual) |
| `--source <theme\|root>` | `-s` | Tipo de pasta do projeto legado (padrão: `theme`) |
| `--account <conta>` | `-a` | Identificador da conta na API Millbody |
| `--track <prod\|beta>` | `-t` | Faixa de publicação para `fastlane` |
| `--yes` | `-y` | Confirma prompts interativos sem aguardar input |
| `--dry-run` | — | Exibe o plano sem executar nada (`setup`) |
| `--help` | `-h` | Exibe a ajuda geral ou do comando |
| `--version` | `-v` | Exibe a versão instalada |

**Subcomando `help`:**
```bash
millbody help           # ajuda geral
millbody help <cmd>     # ajuda do comando
```

**Precedência das flags informacionais:** `--version` > `--help` > execução do comando.

Exemplos:
- `millbody start -v` → imprime a versão (não executa `start`)
- `millbody start --help` → exibe ajuda do comando `start` (não executa)
- `millbody -hv` → imprime a versão

---

## Modo interativo e não-interativo

Quando nenhum comando é informado:

- **Com TTY** (`stdin` é terminal): exibe menu interativo com os comandos que possuem `interactive: true` (`start`, `run-ios`, `run-android`, `codepush`, `create`).
- **Sem TTY** (pipes, CI, `stdin` fechado): cai automaticamente em `start`.

Para forçar um comando específico em CI:
```bash
millbody start --source root
```

---

## Códigos de saída

| Código | Significado |
|--------|-------------|
| `0` | Sucesso (incluindo `--help` e `--version`) |
| `1` | Erro: flag desconhecida, comando desconhecido, erro de execução |
| `130` | Prompt interativo cancelado (Ctrl+C / `ExitPromptError`) |

---

## Troubleshooting

### "A pasta não corresponde a um TEMA MILLBODY"

A pasta atual não contém `./screens` e `./millbodyApp.json`. Use `--source root` se estiver na pasta raiz, ou navegue até a pasta correta do tema.

### "Esse projeto não corresponde ao framework MILLBODY APP"

A pasta atual não contém `./mbCore` e `./millbodyApp.json`. Use `--source theme` se estiver na pasta do tema, ou navegue até a pasta raiz do projeto.

### "Ops! não encontrei o argumento --account"

Os comandos `create` e `update-apk` requerem `--account`. Exemplo:
```bash
millbody create --account minha-conta
```

### Token / `Constants.uri` ausente

O arquivo `mbCore/Constants.js` (ou `mbCore/Constants/index.js`) não exporta `constants.uri`, ou `mbCore/fastlane/keys/millbody.json` está ausente. Verifique os arquivos de configuração.

### Node.js incompatível

Este CLI requer Node.js >= 23. Use `nvm use` com o `.nvmrc` do projeto para selecionar a versão correta.

### Porta 8081 ocupada

Os comandos `create` e `update-apk` tentam encerrar processos na porta 8081 com `kill -9 'lsof -t -i:8081'`. Veja a seção de limitações sobre o comportamento desta instrução.

---

## Desenvolvimento

### Executar testes

```bash
npm test
```

### Verificar cobertura (limiares: 90% linhas / 85% branches / 90% funções)

```bash
npm run test:coverage
```

### Estrutura de pastas

```
bin/
  millbody          — entrypoint executável
src/
  cli.js            — parse de argumentos, menu interativo, roteamento
  help.js           — funções puras de render de ajuda + leitura de versão
  functions.js      — executeCommand, checkFolderBySource
  commands/
    registry.js     — SSOT: descritores de todos os comandos
    start.js
    test.js
    runIos.js
    runAndroid.js
    buildAndroid.js
    codepush.js
    create.js
    updateApk.js
  services/
    api.js          — getAppAccount (fetch da API Millbody)
test/
  *.test.js         — testes unitários e de integração (Node built-in test runner)
  helpers/
    sandbox.js      — createSandbox: diretório temporário isolado por teste
    world.js        — installExecMock, mockFetch, rootProject, themeProject
    exitPromptPreload.js — preload para testes de processo filho com TTY
```

Os testes **nunca** executam comandos reais: `node:child_process` é mockado via `mock.module` e comandos externos são interceptados antes de chegar ao sistema operacional.

---

## Limitações conhecidas / segurança

As limitações abaixo são **bugs conhecidos não corrigidos** nesta versão. Use este CLI apenas com valores confiáveis nas opções.

### 1. Injeção de comando via `--account` e `themeName`

Os comandos `create` e `update-apk` interpolam diretamente `--account` e o campo `themeName` retornado pela API em strings de shell (ex.: `cd ${themeFolder} && git checkout -b ${account}`). Um valor malicioso como `minha-conta; rm -rf /` seria executado pelo shell sem sanitização.

**Mitigação:** use apenas valores de conta confiáveis e controle quem pode chamar a API que retorna `themeName`.

### 2. `kill -9 'lsof -t -i:8081'` não encerra o processo na porta 8081

Os comandos `create` e `update-apk` executam `kill -9 'lsof -t -i:8081'` com aspas simples, o que faz o shell interpretar `lsof -t -i:8081` como string literal em vez de substituição de comando. O processo na porta 8081 **não é encerrado**.

**Mitigação:** encerre manualmente o servidor Metro antes de executar `create` ou `update-apk`.

### 3. `executeCommand` não interrompe a sequência em caso de falha

A função `executeCommand` em `src/functions.js` resolve a Promise com o código de saída do processo (inclusive códigos de erro), sem rejeitar. Isso significa que se um passo intermediário falhar (ex.: `fastlane` retornar erro), os passos seguintes continuam sendo executados.

**Mitigação:** monitore a saída dos comandos e verifique manualmente os resultados.
