# Plano — Suporte a Dupla Arquitetura (legacy + expo/app-mobile) + Setup/Doctor Automático

> Tarefa: `dual-arch-setup` · CLI `@millbody/millbody-cli` · Node 23.11.1 · macOS (darwin arm64)
> Worktree: `.worktrees/node23-upgrade` (branch `node23-upgrade`, NÃO mergeada)

## 🎯 SCOPE

### Objetivo
Fazer o CLI suportar DUAS arquiteturas de projeto com detecção automática:
- **legacy**: comportamento ATUAL (mbCore/, millbodyApp.json, mbContent/themes, millbodyapp.config.js, fastlane, react-native CLI, `--source theme|root`). NÃO muda.
- **expo**: projeto `app-mobile` (Expo ~57, RN 0.86, yarn). Comandos do CLI mapeiam para scripts `yarn <script>` do app-mobile via `spawn` (array de args, SEM shell).
Além disso: instalação automática de dependências externas (postinstall best-effort), e comandos `millbody setup` e `millbody doctor`.

### Arquivos Afetados (criar)
- [x] `src/arch/detect.js` — detecção de arquitetura (expo|legacy) + resolução de `--project`
- [x] `src/arch/runner.js` — runner `spawn` seguro (array args, sem shell) para o caminho expo
- [x] `src/arch/expoCommands.js` — mapeamento comando→script yarn (SSOT) + handlers expo
- [x] `src/requirements/requirements.js` — SSOT de requisitos externos por arquitetura/comando
- [x] `src/requirements/detect.js` — detectores (command -v, xcode-select -p, ANDROID_HOME/adb, java -version)
- [x] `src/commands/doctor.js` — handler `millbody doctor`
- [x] `src/commands/setup.js` — handler `millbody setup`
- [x] `scripts/postinstall.js` — postinstall best-effort (sempre exit 0)
- [x] `docs/003-dual-arch-setup.md` — doc de entrega

### Arquivos Afetados (modificar)
- [x] `src/cli.js` — parse de `--arch`/`--project`/`-p`, roteamento por arquitetura, handlers doctor/setup
- [x] `src/commands/registry.js` — novos descritores (doctor, setup), flags globais, coluna de suporte por arquitetura
- [x] `src/help.js` — render com suporte por arquitetura; flags `--arch`/`--project`
- [x] `package.json` — adicionar `"postinstall": "node scripts/postinstall.js"`, incluir `scripts` em `files`
- [x] `README.md` — seções de arquitetura, instalação automática, tutorial expo, correção do texto de PATH
- [ ] `test/*` — novos testes + ajustes de consistência README↔registry

### Fora do Escopo (NÃO tocar)
- Corrigir bugs legados: injeção de shell em `functions.js::executeCommand` (exec), `kill -9 lsof:8081`, `killall Xcode`, `--source theme` chdir. O fluxo legado permanece **idêntico** (213 pass + 9 todo continuam valendo).
- Qualquer alteração em `../../../app-mobile` (SOMENTE LEITURA; nunca executar scripts dele).
- Corrigir a exposição de senha do keystore em `app-mobile/millbody.json` (outro repo) — apenas DOCUMENTAR no doc de entrega (item E).
- `npm i -g` real ou execução do postinstall real.

### Riscos de Impacto
- R1: Introduzir `spawn` sem shell no caminho novo NÃO pode alterar o caminho legado (que usa `exec`). Isolar em módulo novo.
- R2: Testes NÃO podem executar brew/gem/npm/yarn/expo/git/fastlane/kill de verdade — todo `child_process` (exec/execFile/spawn/spawnSync) deve ser mockado; usar fixtures em tmpdir. Incidente anterior rodou `npx react-native start` de verdade por mock desfeito — garantir mocks escopados e restaurados em afterEach.
- R3: postinstall pode disparar brew ao instalar deps de dev deste próprio repo — precisa pular em dev install / CI / non-darwin / MILLBODY_SKIP_SETUP.
- R4: Detecção ambígua (projeto tem tanto marcadores expo quanto legacy) — precedência clara + `--arch` força.

---

## 📋 REQUIREMENTS

### Requisitos Funcionais
- [ ] RF01: Detecção de arquitetura automática:
  - `expo` quando o diretório do projeto tem `millbody.json` **e** (`app.config.ts` OU `app.json` com chave expo OU dependência `expo` no `package.json`).
  - `legacy` quando tem `mbCore/` OU `millbodyApp.json` (inclui modo theme: `screens/` + `millbodyApp.json`).
  - Mensagem clara e exit ≠ 0 se nenhuma arquitetura for detectada.
- [ ] RF02: Flag `--arch <expo|legacy>` força a arquitetura (bypassa detecção). Valor inválido → erro claro, exit 1.
- [ ] RF03: Flag `--project/-p <caminho>` define o diretório do projeto (default: `process.cwd()`). Caminho inexistente → erro claro, exit 1.
- [ ] RF04: Fluxo **legacy** mantém comportamento atual byte-a-byte (mesmos comandos externos, mesmas mensagens). `--source theme|root` continua válido só no legacy.
- [ ] RF05: Comandos no modo **expo** mapeiam para scripts do app-mobile via `yarn <script>` usando `spawn` (array args, sem shell), `cwd` = projeto, `stdio: "inherit"`, propagando o exit code do processo filho.
- [ ] RF06: `create --account X` no modo expo: validar `X` com `/^[a-z0-9][a-z0-9_-]*$/i`; gravar `EXPO_PUBLIC_ACCOUNT=X` em `<project>/.env.account`; rodar `yarn millbody:create`. Conta inválida → erro, exit 1, sem gravar nada.
- [ ] RF07: Comando sem equivalente na arquitetura detectada (ex.: `codepush` no expo) → mensagem explicativa + exit ≠ 0.
- [ ] RF08: `millbody doctor [--arch] [--project]`: imprime tabela ✓/✗ dos requisitos da arquitetura com instrução de correção; exit 1 se faltar algo **obrigatório**, exit 0 se tudo ok. Doctor é SOMENTE LEITURA (só detecta).
- [ ] RF09: `millbody setup [--yes] [--dry-run] [--arch] [--project]`: lista o que fará; em `--dry-run` não executa nada; sem `--yes` e em TTY pede confirmação; instala apenas o que faltar E for auto-instalável.
- [ ] RF10: postinstall (`scripts/postinstall.js`) roda setup não-interativo best-effort com timeout; SEMPRE exit 0; pula quando: `MILLBODY_SKIP_SETUP=1`, `CI=true`, plataforma ≠ darwin (só reporta), ou dev install deste repo (ver RF11).
- [ ] RF11: Detecção de "dev install": pular quando `npm_config_global` não está setado (instalação local/dev) OU `INIT_CWD` === diretório do próprio pacote. Só roda setup quando for instalação global (`npm i -g`).
- [ ] RF12: `ttab` deve resolver do `node_modules` do próprio CLI (dependência npm), não do PATH.
- [ ] RF13: Help/README/registry SSOT atualizados: novos comandos (doctor, setup), flags (`--arch`, `--project`), coluna/indicação de suporte por arquitetura. Teste de consistência README↔registry mantido/estendido.

### Requisitos Não-Funcionais
- [ ] RNF01: Sem novas dependências de produção além das já instaladas (arg, ttab, @inquirer/prompts). Testes com `node:test` puro.
- [ ] RNF02: Cobertura ≥ 90 linhas / 85 branches / 90 funções (`npm run test:coverage`).
- [ ] RNF03: Nenhuma nova injeção de shell. Caminho expo usa `spawn`/`execFile` com array de args, sem `shell:true`, sem interpolação de string.
- [ ] RNF04: Código auto-documentado, sem comentários, SOLID/DRY, sem credenciais.
- [ ] RNF05: Trivy continua 0 (sem novas deps de prod).

### Critérios de Aceitação
- [ ] CA01: `node bin/millbody --help` lista doctor, setup, `--arch`, `--project` e indica suporte por arquitetura.
- [ ] CA02: `node bin/millbody doctor --project ../../../app-mobile` roda de verdade (read-only), mostra tabela e sai com código coerente.
- [ ] CA03: `node bin/millbody setup --dry-run --project ../../../app-mobile` mostra o plano sem executar nada.
- [ ] CA04: `npm test` verde; `npm run test:coverage` ≥ limiares. Os 213 pass + 9 todo legados continuam.
- [ ] CA05: Nenhum teste executa comando externo real (verificado por mocks escopados).

### Edge Cases
- EC01: `--project` relativo → resolver para absoluto (`path.resolve`).
- EC02: Projeto com marcadores dos dois tipos → precedência: `--arch` > expo (millbody.json+expo) > legacy. Documentar.
- EC03: `millbody.json` presente mas sem marcador expo → não classificar como expo; cair para legacy ou "não detectado".
- EC04: `doctor` quando faltar binário opcional (ex.: fastlane fora do legacy) → não falhar.
- EC05: `java -version` escreve em stderr; parsing deve ler stderr. Versão ≥ 17.
- EC06: `.env.account` já existe com outra chave → preservar demais linhas, atualizar/juntar `EXPO_PUBLIC_ACCOUNT`.
- EC07: Homebrew ausente → setup não pode auto-instalar (exige interação/sudo) → orientar, não falhar instalação.

---

## 🏗️ DESIGN

### Decisão arquitetural central
Introduzir uma camada de **arquitetura** acima dos handlers. O `cli.js` resolve `{ arch, projectDir }` cedo e roteia:
- `arch === "legacy"` → handlers atuais (inalterados).
- `arch === "expo"` → handlers expo (novos) que chamam o runner `spawn`.
Comandos informacionais (`doctor`, `setup`, `--help`, `--version`) e detecção ocorrem ANTES de qualquer efeito colateral.

### Módulo de detecção (`src/arch/detect.js`)
```
detectArchitecture(projectDir) -> "expo" | "legacy" | null
resolveArch({ archFlag, projectDir }) -> { arch, projectDir } | throws Error(claro)
```
- expo: `exists(millbody.json)` && (`exists(app.config.ts)` || `app.json`→tem `expo` || `package.json`.dependencies.expo).
- legacy: `exists(mbCore/)` || `exists(millbodyApp.json)`.
- Precedência: `--arch` explícito vence; senão expo; senão legacy; senão `null` → erro.
- Funções puras/injetáveis (recebem `projectDir`) para testar com fixtures tmpdir.

### Runner seguro (`src/arch/runner.js`)
```
runScript(projectDir, script, extraArgs = [], { spawn, env } = {}) -> Promise<exitCode>
```
- `spawn("yarn", [script, ...extraArgs], { cwd: projectDir, stdio: "inherit", shell: false })`.
- Propaga exit code; rejeita/retorna código ≠ 0 adequadamente.
- `spawn` injetável para teste (default: `child_process.spawn`). SEM `shell`, SEM template string.

### Mapeamento comando→script (`src/arch/expoCommands.js`) — SSOT
**CONFIRMADO** via recon do `package.json` real do app-mobile (Yarn 1.22.22 classic, `engines.node >=20`, Expo SDK 57, RN 0.86.3):
| comando CLI | script yarn (app-mobile) | o que faz |
|-------------|--------------------------|-----------|
| start       | `start`                  | `expo start` |
| run-ios     | `ios`                    | `expo run:ios` |
| run-android | `android`                | `expo run:android` |
| update-apk  | `millbody`               | `bash scripts/millbody.sh` (connect-alderaan → download-images → ícones → limpa ios/android/.expo/caches → yarn install → lingui extract/compile → prebuild --clean) |
| create --account X | `millbody:create` | grava `EXPO_PUBLIC_ACCOUNT=X` em `.env.account`, depois `yarn millbody:create` (= `yarn millbody && create-keystore.cjs`) |
| build-android | `predeploy:android`     | clean+install+compile+millbody+prebuild+`expo run:android` |
| build-ios   | `predeploy:ios`          | clean+install+compile+millbody+prebuild+`xed ios` (NOVO alias de comando, só expo) |
| codepush    | (sem equivalente)        | mensagem explicando ausência no app-mobile + exit ≠ 0 |
| test        | (sem equivalente útil)   | app-mobile `test` = `jest --watchAll` (interativo, não CI). Mensagem orientando e exit ≠ 0 (não mapear para evitar watch travando CLI) |

Scripts extras EXPOSTOS (com justificativa):
- `connect-alderaan` → NOVO subcomando util `millbody connect-alderaan` (expo): atualiza `millbody.json` da API Alderaan sem rebuild completo. Justificativa: operação idempotente e frequente, evita rodar o pipeline inteiro (`millbody`) só para refazer config.
- `web` → NOVO `millbody web` (expo): `expo start --web`. Justificativa: alvo de primeira classe do app-mobile, análogo a run-ios/run-android.
- `prebuild` → NÃO exposto isolado: já é a etapa final de `millbody`/`update-apk`; expor isolado confundiria (sem clean). Fica fora.
- `desktop:*` / `tv:*` → fora de escopo (exigem cargo/tauri/tizen/webos; não pedido).

Observações de segurança do recon (apenas DOCUMENTAR no doc de entrega — item E):
- `app-mobile/millbody.json` contém senhas do keystore Android em texto puro (`android.key.storePassword`/`keyPassword`).
- `account.json` (`sfall`) diverge de `millbody.json.account` (`crossevolution`) e não é lido pela config atual (legado).
- `connect-alderaan.cjs`/`download-images.cjs` auto-executam no `require` e chamam `process.exit` — irrelevante para o CLI pois rodam no processo filho via `yarn`.
- `FA_TOKEN` é obrigatório no `preinstall` do app-mobile (gera `.npmrc`/`.yarnrc.yml`); `millbody`/`update-apk` que disparam `yarn install` dependem dele — doctor (expo) deve orientar sobre as envs necessárias (sem exigir, pois são do projeto consumidor).

### Requisitos externos SSOT (`src/requirements/requirements.js`)
Cada requisito: `{ key, name, archs: ["expo"|"legacy"], commands: [] (vazio = base), required: bool, detect, autoInstall: {method:"brew|brew-cask|gem|corepack|none", formula}, autoInstallable, manualInstruction }`.
Recon confirmou: app-mobile usa **Node >=20, Yarn 1.22.22 classic, cocoapods p/ iOS, keytool (Java)**. Não há versão JDK documentada → adotar **JDK 17** (padrão RN 0.86 / Expo SDK 57). Lista final:
- **git** — archs ambas, required. detect `command -v git`. autoInstall brew `git` (true). manual: instalar Command Line Tools (`xcode-select --install`).
- **Homebrew** — archs ambas, required (gateway dos demais). detect `command -v brew`. autoInstallable **false** (exige curl+bash interativo/sudo). manual: instruções oficiais brew.sh.
- **yarn (1.x)** — SÓ expo, required. detect `command -v yarn`. autoInstall `corepack enable` (preferido; Node 23 tem corepack) com fallback brew `yarn`. autoInstallable true.
- **watchman** — SÓ expo, required (Metro/RN). detect `command -v watchman`. autoInstall brew `watchman` (true).
- **cocoapods** — SÓ expo, required (iOS). detect `command -v pod`. autoInstall brew `cocoapods` (preferido sobre gem p/ evitar sudo). autoInstallable true.
- **JDK 17** — archs ambas, required (Android/keytool; RN 0.86). detect `java -version` lendo **stderr**, exigir major ≥ 17. autoInstall brew-cask/formula `openjdk@17` (fallback `zulu17`). autoInstallable true. manual: exportar `JAVA_HOME`.
- **fastlane** — SÓ legacy, required. detect `command -v fastlane`. autoInstall brew `fastlane` (true). No expo NÃO é requisito.
- **ttab** — ambas, required mas **resolvido do `node_modules` do próprio CLI** (dependência npm): detect via `require.resolve`/`existsSync(node_modules/.bin/ttab)` relativo ao pacote, NÃO via PATH. autoInstall none (vem com `npm i`). Flag `bundled: true`.
- **Xcode + Command Line Tools** — ambas (iOS), required p/ iOS. detect `xcode-select -p`. autoInstallable **false** (só App Store / `xcode-select --install`). SÓ detectar/orientar.
- **Android SDK / adb** — ambas (Android), required p/ Android. detect `ANDROID_HOME`/`ANDROID_SDK_ROOT` + `command -v adb`. autoInstallable **false** (Android Studio). SÓ detectar/orientar.

Classificação required vs opcional no `doctor`: faltar um item `required:true && autoInstallable` ou core (git, homebrew, yarn/watchman/cocoapods/JDK conforme arch) → exit 1. Itens só-detecção (Xcode/Android SDK) entram como aviso; exit 1 apenas se forem genuinamente necessários à arch (documentar: tratados como obrigatórios para a arch pois a app-mobile faz prebuild nativo iOS+Android).

### Detectores (`src/requirements/detect.js`)
- `execFile`-based, injetável. Nunca `shell:true`. Timeout curto.
- `java -version` lê stderr; parse `version "17..."` ou `17.`.

### doctor (`src/commands/doctor.js`)
- Resolve arch+project; filtra requisitos aplicáveis; roda detectores; imprime tabela ✓/✗ + instrução; exit 1 se faltar obrigatório.

### setup (`src/commands/setup.js`)
- Resolve arch+project; detecta faltantes auto-instaláveis; mostra plano; `--dry-run` não executa; sem `--yes` em TTY confirma; executa instaladores via runner injetável.

### postinstall (`scripts/postinstall.js`)
- Guardas (ordem): `MILLBODY_SKIP_SETUP=1` → skip; `CI=true` → skip; `process.platform !== "darwin"` → reporta e skip; dev install (`!npm_config_global` ou `INIT_CWD===pkgDir`) → skip. Senão roda setup não-interativo com timeout global. `try/catch` cobre tudo; `process.exitCode = 0` sempre.
- **Trade-off documentado**: alternativa seria instruir `npm i -g --ignore-scripts`; rejeitada porque anula a automação pedida pelo usuário. Tempo de instalação pode crescer (brew); por isso best-effort + timeout + skip em CI. `sudo`: nunca invocado automaticamente; itens que exigem sudo/interação (Homebrew, Xcode) só são orientados.

### Parsing no cli.js
- Adicionar `--arch String`, `--project/-p String` ao `arg`. `doctor`/`setup` entram em `defaultHandlers` e no registry. Informacionais resolvidos antes. `--source` continua só relevante no legacy.

### Registry/help/README
- Registry: adicionar campo `archs: ["legacy"|"expo"|ambos]` por comando; descritores de doctor/setup; flags globais `--arch`/`--project`. Help deriva coluna de suporte. README ganha seções (arquitetura, detecção, instalação automática, tutorial expo) e corrige o texto de PATH. Teste de consistência estendido.

### Padrões utilizados
- SSOT (registry + requirements + expoCommands), Dependency Injection (spawn/execFile/env injetáveis p/ teste), funções puras para detecção, Strategy por arquitetura.

---

## 📝 TASKS

### Fase 0: Segurança de testes & seam (OBRIGATÓRIA ANTES DE TUDO — dono único)
- [x] T0.1 [MEDIUM] `src/arch/proc.js` — único módulo que importa `node:child_process` (seam)
- [x] T0.2 [MEDIUM] `test/helpers/processFake.js` — filho fake + respostas por binário, deny-all; estender `installExecMock` p/ `exec/execFile/spawn/spawnSync` num único `mock.module`
- [x] T0.3 [LOW] Fixtures `expoProject`, `expoProjectAppJson`, `ambiguousProject`, `legacyThemeProject` em `test/helpers/world.js`
- [x] T0.4 [LOW] Teste estático: só `src/arch/proc.js` importa child_process; smoke de carga dos módulos novos

### Fase 1: Detecção & Runner (base)
- [x] T1.1 [MEDIUM] `src/arch/detect.js` — `detectArchitecture`→{arch,reason,ambiguous} + `resolveArch` + `ARCHS` (fail-safe, anti-destrutivo D5)
- [x] T1.2 [MEDIUM] `src/arch/runner.js` — runner via seam: evento `error` (ENOENT), signal→code, propaga exit code (M2)
- [x] T1.3 [MEDIUM] `src/arch/expoCommands.js` — tabela SSOT + `makeExpoHandlers`; `create` grava `.env.account` (upsert atômico) + `millbody:create`; `codepush`/`test` unsupported exit≠0

### Fase 2: Requisitos externos
- [x] T2.1 [MEDIUM] `src/requirements/requirements.js` — SSOT + `requirementsFor` + `evaluateRequirements` (O2)
- [x] T2.2 [HIGH] `src/requirements/detect.js` — detectores injetáveis: `hasBinary` via PATH scan (NÃO command -v, M4), `javaMajor` (stderr + java_home, keg-only), `hasAndroidSdk`, `hasXcode`; cada um isolado

### Fase 3: Comandos doctor/setup
- [x] T3.1 [MEDIUM] `src/commands/doctor.js`
- [x] T3.2 [MEDIUM] `src/commands/setup.js`

### Fase 4: Integração CLI
- [x] T4.1a [HIGH] `src/cli.js` — parse `--arch`/`--project`/`-p`/`--yes`/`--dry-run`; validação de arch/project
- [x] T4.1b [HIGH] `src/cli.js` — roteamento LAZY por arch (D2: legado inalterado), handlers doctor/setup, menu arch-aware
- [x] T4.2 [LOW] `src/commands/registry.js` — descritores doctor/setup, flags globais, campo `archs`
- [x] T4.3 [LOW] `src/help.js` — render suporte por arquitetura; `bin/millbody` propaga exit code numérico (M2)

### Fase 5: postinstall
- [x] T5.1 [HIGH] `scripts/postinstall.js` — `shouldSkip` puro (D3) + `run({deps})` import-testável (D4/M7); env HOMEBREW_NO_AUTO_UPDATE/NONINTERACTIVE/COREPACK; timeout SIGKILL; sempre exit 0; `package.json` (postinstall + `files` inclui `scripts`)

### Fase 6: Docs
- [x] T6.1 [LOW] `README.md` — seções arquitetura/instalação automática/tutorial expo + correção PATH
- [x] T6.2 [LOW] `docs/003-dual-arch-setup.md` — doc de entrega (incluir item E: senha keystore em app-mobile/millbody.json)

### Fase 7: Testes (test-engineer) — TODOS com DI/processFake, deny-all, sem binário real
- [ ] T7.1 [MEDIUM] Detecção (fixtures expo/legacy/ambíguo/nenhum; app.json malformado fail-safe; --project arquivo vs dir)
- [ ] T7.2 [MEDIUM] Runner (spawn injetado; exit code; ENOENT/error; signal; sem shell)
- [ ] T7.3 [MEDIUM] expoCommands (mapeamento; create --account regex + upsert `.env.account` EC06; sem `--account`; unsupported exit≠0)
- [ ] T7.4 [HIGH] requirements/detect (execFile injetado; `hasBinary` PATH scan; java stderr/versão antiga; keg-only; Xcode/Android)
- [ ] T7.5 [MEDIUM] doctor/setup (dry-run; yes; TTY stdin+stdout; exit codes; detector que crasha não derruba tabela)
- [ ] T7.6 [MEDIUM] postinstall `shouldSkip` table-driven (CI/SKIP/dev-install realpath/non-darwin/root/global) + `run` sempre exit 0 (runSetup injetado)
- [ ] T7.7 [LOW] Consistência README↔registry + help render + completude archs↔expoCommands (O3)
- [ ] T7.8 [MEDIUM] Regressão legado (D2): cada comando legado em tmpdir legado gera os MESMOS comandos/mensagens; 213 pass + 9 todo intactos; bin real só `--help`/`--version`/`doctor`/`setup --dry-run` com detectores mockados

### Fase 8: QA
- [ ] T8.1 qa-reviewer (com dual analysis) → veredito ao orchestrator

---

## Análise Dual (síntese 1c — DECISÕES VINCULANTES)

### 🔴 Riscos críticos incorporados (upsidedown)
- **D1 (C1/C5) — Seam de child_process + mock deny-by-default.** NENHUM módulo novo faz `import { spawn } from "child_process"` no topo. Toda execução passa por injeção de dependência: `runScript`/detectores recebem `spawn`/`execFile` como parâmetro (default resolvido via `import * as cp from "node:child_process"` dentro de um único módulo-seam `src/arch/proc.js`). Isso evita o SyntaxError de link-time que quebraria os 213 testes legados e remove a necessidade de `mock.module` na maioria dos testes. O harness `installExecMock` é estendido para cobrir `exec, execFile, spawn, spawnSync` num ÚNICO `mock.module` (um segundo é frágil) e é **deny-by-default**: qualquer binário não roteirizado lança. Usar sempre `node:child_process` (prefixo), consistente com o resto.
- **D2 (C2) — Resolução de arquitetura é LAZY, nunca no caminho legado.** O legado permanece IDÊNTICO: handlers legados continuam usando `checkFolderBySource` e `process.cwd()`. A resolução de arch só ocorre para: (a) comandos `doctor`/`setup`; (b) quando `--arch expo` é passado; (c) quando o diretório é expo-capável E o comando tem handler expo. Regra de ouro: se nada novo for acionado, o fluxo é bit-a-bit o atual. Teste de regressão: cada comando legado em tmpdir legado continua gerando exatamente os mesmos comandos (world.js fixtures) e as mesmas mensagens de `checkFolderBySource`.
- **D3 (C3) — `shouldSkip(env, platform, pkgDir)` puro e endurecido** no postinstall. Pula quando QUALQUER: `MILLBODY_SKIP_SETUP` truthy; CI (`CI`, `CONTINUOUS_INTEGRATION`, `GITHUB_ACTIONS`, etc.); `platform !== "darwin"`; `env.npm_config_global !== "true"` (só global dispara); `realpath(INIT_CWD) === realpath(pkgDir)` (dev install deste repo); rodando como root (`process.getuid?.() === 0`). Retorna a RAZÃO (string) para log. pnpm/yarn global não setam `npm_config_global` → nesses casos pula (seguro: usuário roda `millbody setup` manual).
- **D4 (C4) — postinstall nunca falha nem trava.** Entry mínima: handlers globais (`uncaughtException`/`unhandledRejection` → `process.exitCode=0`), `import()` dinâmico do setup dentro de `try/catch`, timeout rígido (SIGKILL) ~ 180s, env dos filhos com `HOMEBREW_NO_AUTO_UPDATE=1`, `NONINTERACTIVE=1`, `COREPACK_ENABLE_DOWNLOAD_PROMPT=0`, log em arquivo (`<pkg>/.millbody-postinstall.log`). SEMPRE `process.exitCode = 0`. Mantemos auto-install (decisão 2 do usuário) mas best-effort: se Homebrew faltar, só orienta (EC07). Setup real NÃO é rodado nos testes.
- **D5 (C6) — Detecção fail-safe e anti-destrutiva.** `detectArchitecture` retorna `{ arch, reason, ambiguous }`. Leituras de marcador em `try/catch` (app.json malformado não derruba). Precedência: `--arch` > (expo marker) > (legacy marker). Se AMBÍGUO (marcadores dos dois) e o comando é destrutivo no expo (`update-apk`→`yarn millbody` apaga ios/android), EXIGIR `--arch` explícito. `--project` validado como diretório existente (não arquivo). Alias `updateapp` e o menu interativo também cobertos.
- **D6 (C5) — Fase 0 de segurança de testes ANTES de qualquer código novo:** `test/helpers/processFake.js` (fábrica de filho fake + respostas roteirizadas por binário, deny-all), guard que falha em binário não roteirizado (CA05), extensão de `installExecMock`, preload que lança em uso não-mockado de child_process, e um **teste estático** garantindo que só `src/arch/proc.js` importa child_process. Testes que rodam o binário real limitam-se a `--help`/`--version` (e `doctor`/`setup --dry-run` com detectores injetados/mockados — nunca detectores reais que toquem o sistema).

### 🟡 Ajustes médios incorporados
- **M4 — `command -v` é builtin de shell**: NÃO usar via `execFile` sem shell. Detecção de binário por varredura de `PATH` (`fs.existsSync` em cada dir do PATH + `X_OK`) OU `execFile("which", [bin])`. Preferir varredura de PATH (sem processo). Incluir `/opt/homebrew/bin` e `/usr/local/bin` ao avaliar brew. openjdk@17 é keg-only → detectar via `/usr/libexec/java_home -v 17` além de `java -version` (stderr).
- **M2 — Runner robusto + propagação de exit code**: tratar evento `error` (ENOENT → mensagem clara, código ≠ 0), `exit`/`close` com `code`/`signal` (signal → código 128+n ou 1), encaminhar SIGINT. `bin/millbody` precisa `process.exitCode = ` do retorno quando for número. `bin/millbody` entra na lista de arquivos modificados.
- **M1 — parsing**: adicionar `--yes`/`-y` e `--dry-run` (Boolean) ao `arg`; normalizar `--arch` para lowercase; validar contra `ARCHS` exportado de `detect.js`. Testes de parse/help/registry que dependem do shape SERÃO atualizados (é esperado; não conflita com "legado inalterado" — o comportamento legado não muda, só o shape de parse ganha campos novos).
- **M3/EC06 — `.env.account`**: função pura `upsertEnvVar(content, key, value)` (preserva outras linhas, trata CRLF e chave duplicada). Escrita atômica (tmp+rename). `create` sem `--account` no expo → erro claro, exit 1, nada gravado.
- **M4/M5 — doctor/setup exit codes & TTY**: doctor exit 1 só se faltar item obrigatório da arch; cada detector isolado em `try/catch` (um crash não derruba a tabela). setup: TTY em stdin E stdout; `ExitPromptError` propaga (não engolir); re-verifica após instalar; whitelist fechada de métodos de install (`brew`/`brew-cask`/`gem`/`corepack`); partial failure reportado, best-effort. Xcode/Android SDK obrigatórios para a arch expo (prebuild nativo iOS+Android) mas isolados — documentar que usuário single-platform verá ✗ no outro.
- **M6 — package.json**: `files` passa a incluir `scripts`; manter `engines.node >=23` (CLI) — divergência com app (`>=20`) é esperada e documentada; documentar `npm i -g --ignore-scripts` como opt-out no README.
- **M7 — Cobertura por composition root injetável**: cada módulo expõe lógica pura + `main(deps)`; `scripts/postinstall.js` é import-testável (`run({env, platform, pkgDir, runSetup})`), com `platform` injetável. Apenas a borda mínima (o `#!/usr/bin/env node` + chamada) fica fora da cobertura.

### 🟢 Oportunidades incorporadas (downsideup)
- **O1 — Fan-out seguro com contratos congelados (Wave 0).** As assinaturas abaixo são o contrato. Paralelização: **3 agentes na Wave 1** (A: `src/arch/*`; B: `src/requirements/*`; C: `scripts/postinstall.js` guard + `package.json` + rascunhos de docs), depois **Wave 2** (D: doctor+setup; E: integração `cli.js`/`registry.js`/`help.js`). O harness de teste (`processFake` + fixtures) é entregue PRIMEIRO por um único dono. Dado o tamanho do repo e o acoplamento em arquivos compartilhados, o `@software-engineer` pode optar por execução sequencial disciplinada; a decisão de paralelismo é dele, mas os contratos abaixo são obrigatórios.
- **O2 — `evaluateRequirements({arch, detect}) -> [{req, ok, detail}]`** compartilhado por doctor, setup e postinstall (SSOT de avaliação; elimina drift).
- **O3 — Registry `archs` dirige help + filtro do menu interativo + asserção de consistência README↔registry.** Teste de completude: todo comando com `archs` incluindo `expo` tem linha em `expoCommands` (mapeamento OU "sem equivalente"). Fecha RF07+RF13.
- **O4 — Renderizadores puros** (`renderDoctorTable(results)`), `ttab` resolvido via `createRequire(import.meta.url).resolve("ttab")` (RF12), `ARCHS` const única (QW1).

### Contratos congelados (assinaturas obrigatórias)
```
// src/arch/proc.js  (ÚNICO módulo que importa node:child_process)
export const proc = { spawn, spawnSync, execFile };

// src/arch/detect.js
export const ARCHS = ["expo", "legacy"];
export function detectArchitecture(projectDir) -> { arch: "expo"|"legacy"|null, reason, ambiguous }
export function resolveArch({ archFlag, projectDir }) -> { arch, projectDir }  // throws Error claro

// src/arch/runner.js
export async function runScript(projectDir, script, args = [], { spawn } = {}) -> Promise<number>  // exit code

// src/arch/expoCommands.js
// rows: [{ command, script?, args?, unsupported? (string) }]
export function makeExpoHandlers({ runScript }) -> { [command]: (options) => Promise<number> }

// src/requirements/requirements.js
// req: { key, name, archs, required, bundled?, detect(deps), autoInstall:{method,formula}|null, autoInstallable, manualInstruction }
export const requirements = [...]
export function requirementsFor(arch) -> req[]
export async function evaluateRequirements({ arch, deps }) -> [{ req, ok, detail }]

// src/requirements/detect.js   (deps = { execFile, env, existsSync })
export function hasBinary(bin, { env, existsSync }) -> bool   // PATH scan, NÃO command -v
export async function javaMajor({ execFile }) -> number|null  // lê stderr / java_home
export function hasAndroidSdk({ env, existsSync }) -> bool
export async function hasXcode({ execFile }) -> bool          // xcode-select -p

// scripts/postinstall.js
export function shouldSkip(env, platform, pkgDir) -> string|null   // razão do skip ou null
export async function run({ env, platform, pkgDir, runSetup, log }) -> void  // sempre resolve
```

### Aceitação manual registrada
CA02/CA03 dependem de `../../../app-mobile` (fora do repo) — são verificações MANUAIS do orchestrator (doctor read-only pode rodar de verdade; setup só `--dry-run`). Não viram teste automatizado que toque o sistema.
