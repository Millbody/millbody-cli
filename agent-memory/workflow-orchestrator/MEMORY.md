# Agent Memory — workflow-orchestrator

## Padrões do Projeto
- `@millbody/millbody-cli`: CLI Node.js ESM (`"type": "module"`), pequeno (~15 arquivos .js + `bin/millbody` sem extensão). Entrypoint real é `bin/millbody` → `src/cli.js` → `src/commands/*.js` (cada comando é `default export`).
- `src/services/api.js` resolve módulos/arquivos do PROJETO CONSUMIDOR (`process.cwd()/mbCore/...`), que NÃO existem neste repo — por isso testes usam fixtures em tmpdir e `rootFolder` injetável em `getAppAccount(account, rootFolder = process.cwd())`.
- `functions.js::executeCommand` usa `exec` (shell) — interpola args direto no shell (risco de injection, fora de escopo hoje).
- Dois lockfiles coexistem (`package-lock.json` + `yarn.lock`); histórico git os atualiza juntos.

## Decisões Arquiteturais
- JSON no Node 23: preferir `fs.promises.readFile` + `JSON.parse` (com remoção de BOM) em vez de import attributes — mais portável e mockável.
- Import de caminho absoluto no ESM: usar `pathToFileURL`; para extensionless, tentar candidatos (`X.js`, `X/index.js`) e capturar `ERR_MODULE_NOT_FOUND` só do próprio path (Node 23 usa caminhos posix, não `file://`, nas mensagens — checar ambos).
- Prompt: inquirer 14 NÃO tem `type:"list"` (lança `UnknownPromptTypeError`). Usar `select` de `@inquirer/prompts` e remover o pacote `inquirer`. Em não-TTY, não abrir prompt (`!process.stdin.isTTY` → default).
- Testabilidade sem mock de módulo ESM: exportar funções puras (`parseArgumentsIntoOptions`, `promptForMissingOptions`) e aceitar handlers injetáveis (`cli(args, handlers)`).
- `bin` deve ter `.catch` (exit code; `ExitPromptError` → 130), senão erros viram unhandled rejection.

## Erros Recorrentes & Soluções
- `ERR_IMPORT_ATTRIBUTE_MISSING` ao importar JSON no Node 23 → ler via fs.
- `ERR_MODULE_NOT_FOUND` em import extensionless → pathToFileURL + candidatos.
- `node --check` NÃO detecta imports quebrados — complementar com smoke de carga via `import()` de cada módulo.
- `node --test` sem dir explícito pode varrer `tasks/`/`node_modules` — usar `node --test test/`.

## Aprendizados de QA
- QA pode sinalizar os trailers de atribuição como "violação"; quando a atribuição é EXIGIDA pela config do ambiente/instrução do usuário, NÃO é defeito — não reescrever histórico.
- Trivy `fs .` escaneia os DOIS lockfiles e DOBRA a contagem. Para número real, escanear cada lockfile isolado (copiar `package.json` + um lockfile para dir separado). Baseline real = 38/lockfile.
- Vuln pode vir de transitiva profunda (CVE-2026-44705 `tmp` via `@inquirer/prompts → external-editor → tmp`) — corrigir com `overrides` (npm) + `resolutions` (yarn) `tmp ^0.2.6`.

## Dependências & Integrações
- Removidas: `axios` (fonte da CRITICAL form-data), `node-fetch@2`, `strip-ansi`, `inquirer` (pesado, puxava tmp vulnerável).
- Mantidas: `arg`, `ttab`, `@inquirer/prompts` (direta, p/ `select`).
- fetch nativo do Node 23 NÃO respeita `HTTP(S)_PROXY` (regressão potencial vs axios).
- API externa: ALDERAAN (`{uri}api/alderaan/v1/{account}/app/`) via Bearer token lido de `mbCore/fastlane/keys/millbody.json`.

## Observações
- Trabalho feito na worktree `.worktrees/node23-upgrade` (branch `node23-upgrade`). NÃO fazer merge/push/publish sem aprovação explícita do usuário.
- Resultado da tarefa 001: 46/46 testes, Trivy 0/0, 8 commits. Doc em `docs/001-node23-upgrade.md`.
- Resultado da tarefa 002 (cli-help-readme): 213 pass/0 fail/9 todo, cobertura 99.78/98.30/100 (limiares 90/85/90), Trivy 0/0. 5 commits. Doc em `docs/002-cli-help-readme.md`. Plano em `tasks/cli-help-readme/plan.md`.
- Recomendações futuras pendentes: engines `>=23.5.0`+MAJOR bump, injections, executeCommand/spawn, bug lsof, process.exit, consolidar lockfile, eslint config.

## Padrões do Projeto (cont. — tarefa 002)
- CLI agora tem SSOT de comandos em `src/commands/registry.js` (name, aliases, summary, usage, description, flags, examples, prerequisites, external, sideEffects, interactive). QUALQUER novo comando = 1 descritor no registry + 1 handler em `defaultHandlers` (cli.js). Help, menu e README derivam do registry.
- `src/help.js`: render puro + `resolveInformational(parsed, registry)` + `getVersion()` (lê `../package.json` via `import.meta.url`, NÃO via cwd). `findCommand` usa `array.find` (NUNCA lookup em objeto — evita prototype pollution com `constructor`/`__proto__`).
- Roteamento de execução usa `Object.hasOwn(handlers, template)`; `defaultHandlers` é exportado de cli.js para teste de paridade com o registry.
- README resolvido por `import.meta.url` nos testes (eles fazem `process.chdir` em sandbox).

## Aprendizados de QA (cont.)
- CONFIRMADO de novo na tarefa 002: o gate de QA reclama dos trailers `Co-Authored-By: Claude...` como "violação" e sugere `git filter-branch`. Quando o trailer é EXIGIDO pelo usuário E a reescrita é PROIBIDA, isso NÃO é defeito — resolver a favor da instrução do usuário e NÃO bloquear. QA já registra esse conflito como "escalar ao orchestrator".
- IMPORTANTE sobre o pipeline: o `@software-engineer` faz SubagentHandback para o orchestrator ANTES de a cadeia test-engineer→qa-reviewer terminar (só informa "test-engineer delegado"). O VEREDITO do QA NÃO chega como mensagem direta ao orchestrator. Para a decisão da FASE 3, verificar o estado real: `git log`, rodar `npm test`/`test:coverage`, rodar os comandos do CLI, e ler `agent-memory/qa-reviewer/MEMORY.md` (o QA registra lá o resultado dos gates).
- Limiar de tamanho de arquivo do QA: 300 linhas efetivas. Arquivos de teste grandes devem ser divididos por responsabilidade (ex.: `help.test.js` → registry/help-render/help-consistency).
- `smoke.test.js` tinha asserção que codificava o bug de exit 0 para comando desconhecido; ao fazer comando desconhecido sair com código 1, esse teste precisou ser atualizado.

## Padrões do Projeto (cont. — tarefa 003 dual-arch-setup)
- CLI agora suporta DUAS arquiteturas: `legacy` (mbCore/millbodyApp.json/fastlane/react-native CLI) e `expo` (projeto `../../../app-mobile`: Expo SDK 57, RN 0.86, Yarn 1.22.22 classic, `engines node>=20`). Detecção automática por marcadores; `--arch` força; `--project/-p` define dir (default cwd).
- SEAM OBRIGATÓRIO: SÓ `src/arch/proc.js` importa `node:child_process`. Todo o resto recebe `spawn`/`execFile` por injeção de dependência. Isso evita SyntaxError de link-time quando os testes legados fazem `mock.module("node:child_process",{namedExports:{exec}})`, e permite testar sem `mock.module` (usar `mock.fn`). `src/functions.js` legado também importa child_process (exceção conhecida do teste estático).
- Resolução de arch é LAZY (D2): legado permanece bit-a-bit idêntico. `src/arch/{detect,runner,expoCommands}.js`, `src/requirements/{requirements,detect}.js`, `src/commands/{doctor,setup}.js`, `scripts/postinstall.js`.
- Caminho expo usa `spawn("yarn",[script,...],{cwd:projectDir,stdio:"inherit",shell:false})` — sem shell, sem interpolação (contraste com o `exec`+shell do legado). `bin/millbody` propaga exit code numérico do handler.
- Detecção de binário por PATH scan (`fs.existsSync`), NÃO `command -v` (builtin de shell). Inclui `/opt/homebrew/bin` e `/usr/local/bin`. JDK 17 via `java -version` (stderr) + `/usr/libexec/java_home -v 17` (openjdk@17 é keg-only). `ttab` via `createRequire(import.meta.url).resolve("ttab")`.
- postinstall: `shouldSkip(env,platform,pkgDir)` puro + `run({deps})` import-testável; SEMPRE exit 0; pula em MILLBODY_SKIP_SETUP/CI/non-darwin/não-global(`npm_config_global!=="true"`)/dev-install(realpath INIT_CWD===pkgDir)/root. Grava log em `<pkg>/.millbody-postinstall.log` (adicionado ao .gitignore). `package.json` tem `"postinstall"` e `files` inclui `scripts`.
- registry foi dividido: `src/commands/registry.js` (agregador fino, 59 linhas, default-exporta o array na MESMA ordem + `globalFlags`) importa de `src/commands/registry/{legacy,expo,shared}.js`. Caminho de import `./commands/registry.js` preservado.

## Aprendizados de QA & Pipeline (cont. — tarefa 003)
- O limite de 300 linhas efetivas do QA vale TAMBÉM para arquivos de PRODUÇÃO, não só testes. `registry.js` com 448 linhas gerou REJECTED_CODE. Correção: dividir em subdir mantendo interface pública (default export + mesmo caminho/ordem). PLANEJAR divisão de arquivos grandes já no plano.
- Os sub-agentes `@software-engineer`/`@test-engineer` ATINGIRAM o limite de 50 turnos SEM handback nesta tarefa (tarefa grande). Sintoma: notificação "stopped at its 50-turn limit (partial result)" e nenhum relatório. SOLUÇÃO: verificar o estado real (git log, `npm test`, arquivos criados, checkboxes do plan.md) e spawnar um agente FRESCO de CONTINUAÇÃO com status PRECISO do que já existe/falta (ele é stateless). Para tarefas grandes, considerar quebrar a delegação em fatias menores desde o início (ex.: Fase 0+1 numa, Fase 2 noutra) OU instruir o agente a commitar e dar handback parcial bem antes do limite.
- Nesta tarefa o QA RODOU de verdade e deu veredito (REJECTED_CODE) — mas a cadeia foi concluída pelo test-engineer, cujo handback reportou o veredito do QA ao orchestrator. Ainda assim: SEMPRE validar estado real antes de aprovar. O `@qa-reviewer` reportou que seus próprios sub-analistas upsidedown/downsideup estavam "indisponíveis" e ele fez a dual analysis sozinho.
- Verificação final do orchestrator (FASE 3): rodar `node bin/millbody --help` (CA01), `doctor --project ../../../app-mobile` (CA02, read-only pode rodar real), `setup --dry-run --project ...` (CA03), `npm test`, `npm run test:coverage`, e `node scripts/postinstall.js` (deve skipar+exit 0 em dev). Cuidado: `node X | head` mascara o exit code do X — medir sem pipe.

## Resultado tarefa 003
- APROVADO. 355 testes (346 pass/0 fail/9 todo legados), cobertura 97.80/94.53/91.23 (gate 90/85/90). Commits `71f020f`→`bddd369` (~11). Doc em `docs/003-dual-arch-setup.md`. Plano em `tasks/dual-arch-setup/plan.md`. Branch `node23-upgrade` NÃO mergeada (aguardar aprovação do usuário).
- Segurança documentada (não corrigida, outro repo): `app-mobile/millbody.json` tem senhas de keystore Android em texto puro; `account.json`(sfall) diverge de `millbody.json.account`(crossevolution).

## Aprendizados CRÍTICOS — tarefa 003 Ciclo 2 (reprovação pós-aprovação)
- ERRO GRAVE que cometi: APROVEI a entrega sem testar o comportamento REAL dos comandos compartilhados. Verificação independente do coordenador REPROVOU: o roteamento por arquitetura NÃO existia — `cli.js` chamava SEMPRE o handler legado para start/run-ios/run-android/build-android/create/update-apk; `resolveArch` só era usado em doctor/setup; e `--project` (parse→`options.project`) nunca virava `options.projectDir` (que os handlers expo liam) → `yarn web` rodava no cwd errado.
- POR QUE O QA (e eu) NÃO PEGAMOS: os testes unitários INJETAVAM handlers/options diretamente (`cli(args, fakeHandlers)`), contornando TODO o roteamento e a resolução de projectDir. Unit test com mock de handler NÃO prova comportamento de integração. LIÇÃO: para features de roteamento/dispatch/cwd, EXIGIR testes e2e comportamentais via `bin/<cli>` em processo filho (`spawnSync`), com `PATH` contendo SOMENTE shims falsos (yarn/git/npx/react-native/pod/adb que gravam argv+cwd num log) + o dir do node — NUNCA binários reais. Asserir script chamado E cwd===projeto. Arquivo: `test/e2e.arch.test.js`.
- VERIFICAÇÃO DO ORCHESTRATOR na FASE 3 deve incluir REPRODUÇÃO comportamental própria com fixture real + shim falso, não só `--help`/`doctor`/`setup --dry-run`. Rodei: fixture expo (millbody.json+app.config.ts+package.json expo) + `yarn` falso no PATH → confirmei `start→yarn start`, `run-ios→yarn ios`, `web→yarn web`, `create→yarn millbody:create` todos com cwd===projeto; e dir legado sem --project → caminho legado (tentou `cp`, nenhum yarn).
- postinstall F4: o gate original `npm_config_global==="true"` era seguro mas yarn1/pnpm global NÃO o setam → auto-setup nunca rodava. Substituído por `isDevInstall(env,pkgDir)`: pula se INIT_CWD===pkgDir (dev deste repo) OU pkgDir dentro de INIT_CWD/node_modules (dep local de outro projeto); senão RODA. npm/yarn/pnpm global setam INIT_CWD para o cwd da invocação (≠ pkgDir, ≠ node_modules local) → rodam setup, como o usuário pediu. realpath falho/INIT_CWD inexistente → skip seguro (sem throw). CI/non-darwin/root/MILLBODY_SKIP_SETUP continuam pulando. ATENÇÃO: `scripts/postinstall.js` auto-executa `run()` no import — testes DEVEM setar `MILLBODY_SKIP_SETUP=1` antes de importar.
- Sub-agentes criam `.claude/agent-memory/...` (dirs vazios) por engano às vezes — a memória real vai para `agent-memory/` na raiz. Remover `.claude` stray (`rm -rf .claude`) ao final; conferir que não é trackeado.
- Resultado Ciclo 2: 367 testes (358 pass/0 fail/9 todo), cobertura 97.84/94.43/93.81. QA verificou F1–F6. Commits até `a7e69dd`. Regra "No comments" (F5) reforçada: remover `//` dos arquivos da tarefa.

## Padrões do Projeto (cont. — tarefa 004 postinstall-fix / 2.0.1)
- Bug raiz v2.0.0: `scripts/postinstall.js` passava `projectDir: process.cwd()` (dir do pacote em node_modules global) a `setup()`, que chamava `resolveArch()` → throw "Não foi possível detectar a arquitetura" engolido no log → auto-install nunca rodava. Fix: trilha de install NÃO detecta arch.
- PADRÃO novo: setup é função de um CONJUNTO DE REQUISITOS, não de uma arch. `setup.js` tem seam `resolveRequirementSet(options)`: `options.allArchs` → `{reqs: requirementsForAll()}`; senão `resolveArch()+requirementsFor(arch)`. `resolveArch` fica INTOCADO (doctor + setup-em-projeto preservados). Entrada ÚNICA `allArchs` (NÃO criar alias `arch:"all"` — ambos analistas convergiram: menos ramos). CLI `--all`→`allArchs`; quando ligado ignora `--arch`/`--project`.
- `requirementsForAll()` = união dedup por `key` derivada do SSOT `ARCHS` (determinística). `evaluateRequirements({arch,reqs,deps})` usa `reqs ?? requirementsFor(arch)` (nullish, `reqs:[]`=nada).
- postinstall: timeout (180s, injetável via `timeoutMs`/`exit`) agora faz `exit(0)` LIMPO, NÃO `SIGKILL` — SIGKILL faz npm tratar o lifecycle como falha e abortar/rollback o `npm i -g` (upsidedown pegou isso; crítico). Loga `setup concluído (exit=N)` / `erro:`, fallback de log em `os.tmpdir()` quando prefixo root-owned. Testar timeout injetando `exit=mock.fn()` + `timeoutMs` pequeno (NUNCA deixar process.exit real matar o runner).
- Seam de hermeticidade: `detect.js::hasBinary` lê dirs de sistema de `env.MILLBODY_SYSTEM_BIN_PATHS` (default `/opt/homebrew/bin:/usr/local/bin`). Sem isso o smoke de install real NÃO é hermético (vê brew/watchman/fastlane reais da máquina). Smoke seta `MILLBODY_SYSTEM_BIN_PATHS=""`.

## Aprendizados — Smoke test de instalação REAL hermético (test/smoke/smoke-install.sh)
- Shimar SÓ brew/corepack/gem (que são INSTALADORES). NÃO shimar watchman/pod/fastlane/java (precisam ficar AUSENTES para serem "instalados" e provarem o install). Shims registram argv e saem 0.
- CONSTRUIR o shimdir em runtime DENTRO do `$T` temporário (copiar os 3 shims versionados + symlink node/npm/git reais ali). NUNCA criar symlinks dentro de `test/smoke/shims` versionado (o 1º engenheiro poluiu o repo com symlinks de nvm específicos da máquina — defeito que eu peguei na verificação). PATH=`$T/shimdir:/usr/bin:/bin` (homebrew real nunca entra).
- Isolar npm: HOME, npm_config_{userconfig,globalconfig,prefix}, cache real + `--prefer-offline`, `--prefix`. INIT_CWD vem do CWD do npm → rodar `npm i -g` de um CWD temporário VAZIO (sem node_modules) p/ `isDevInstall` ser falso. `env -u` nas 10 CI vars + MILLBODY_SKIP_SETUP. ANDROID_HOME unset.
- Asserts determinísticos: shim-brew-log tem watchman+cocoapods (expo) E fastlane (legacy) = prova da união; corepack enable; log tem `setup concluído`, sem `erro:`. NÃO assertar jdk17/xcode/android (não-determinísticos). Guardas LOUD: `pulando setup`→falha; shim-brew-log vazio→falha (canário de brew real). bash 3.2, `set -euo pipefail`, trap EXIT/INT/TERM, watchdog, `npm pack --json` (sem glob), mktemp BSD.
- CA02 (falha pré-fix): verifiquei EU MESMO criando `git worktree add -d <scratch> 09f107a` (commit de scaffolding, src pré-fix) e rodando o smoke lá → exit 1 com "Não foi possível detectar a arquitetura". Pós-fix passa. `git worktree remove --force` depois.

## Aprendizados de Pipeline (cont. — tarefa 004)
- `@software-engineer` atingiu limite de 50 turnos SEM handback (de novo, tarefa grande). Verifiquei estado real (git log: 3 commits, `npm test`/coverage/smoke rodados por mim) e spawnei CONTINUAÇÃO fresca com status PRECISO do que já existia. Funcionou. Para tarefas grandes, instruir handback parcial cedo.
- O gate global `~/.claude/hooks/qa_gate.py`: `check <wt>` roda os `.qa-gate.json` checks via `bash -lc` + scan de mensagens de commit em `origin/master..HEAD` (bloqueia `\bclaude\b`/`\banthropic\b`/Co-Authored-By). Como o smoke faz `npm i -g` real, o `check` leva >120s → rodar em background e aguardar notificação. O hook `subagent-stop` do workflow-orchestrator roda o gate no meu handback → TUDO tem de passar ANTES de concluir. `git add` os arquivos cedo (o cache do gate não vê conteúdo de untracked).
- help-consistency.test.js EXIGE que toda flag do registry apareça no README → ao adicionar `--all` no descritor, DEVE constar `--all` no README.

## Padrões do Projeto (cont. — tarefa 005 project-root-detection / 2.0.2)
- Detecção de raiz: fonte única de marcadores em `src/arch/detect.js` (`hasExpoMarker/hasLegacyMarker/hasThemeMarkers/hasRootMarkers`), helper ÚNICO `walkUp(startDir, predicate, {home})` com boundary `$HOME` (`home` INJETÁVEL p/ testes determinísticos), `findProjectRoot`, e `resolveArch` como wrapper fino que valida `--arch` por PREDICADO DIRETO (não pela arch resolvida — p/ `--arch legacy` funcionar em dir ambíguo).
- `cli.js`: `SELF_RESOLVING = new Set(["doctor","setup"])` NÃO passa por `resolveProjectArch` — CRÍTICO p/ `setup --all`/postinstall rodar fora de projeto (upsidedown pegou isso; eu tinha errado no 1º draft). chdir compara com `realpathSync` nos dois lados + try/catch.
- `checkFolderBySource` manteve NOME/assinatura/retorno "theme"/"root"; só trocou `process.exit()` por `throw` (prefixos "TEMA MILLBODY"/"framework MILLBODY APP") + busca ascendente → zero churn nos 8 handlers e preserva imports de teste.
- D7: semântica de exec do `--source theme` legacy mantida literal (`cd ../../../`); só validação/exit/mensagens mudaram.

## Aprendizados CRÍTICOS de Pipeline — tarefa 005
- O hook `SubagentStop` roda `~/.claude/hooks/qa_gate.py` a CADA parada de QUALQUER subagente (incl. analistas read-only upsidedown/downsideup). Ele faz `bash -lc` dos checks de `.qa-gate.json` e usa o EXIT CODE; CACHEIA por fingerprint = `HEAD + git status + git diff HEAD + config + hook`. Isso significa: enquanto o `@software-engineer` está no MEIO da implementação (código mudado mas testes acoplados ainda não), QUALQUER parada de subagente aninhado dispara o gate sobre o estado VERMELHO em voo e o relatório vaza para o orchestrator como "Stop hook feedback" bloqueante. NÃO entre em pânico: é ruído de trabalho-em-progresso. Verifique o estado REAL (git status/log, `npm test`). Depois que o HEAD estiver COMMITADO e VERDE, as paradas subsequentes passam no gate.
- COROLÁRIO: committar o trabalho VERDE o quanto antes ESTABILIZA o gate (o fingerprint muda p/ um estado que passa). Como orchestrator, committar um checkpoint do trabalho verde (NÃO é escrever código) é defensável p/ proteger trabalho de subagentes que morreram.
- Os `@software-engineer` atingiram o limite de 50 turnos SEM handback DUAS vezes nesta tarefa (dual-analysis + impl + atualização de testes acoplados = muitos turnos). O trabalho ficou UNCOMMITTED no worktree (mesmo worktree, não isolado) e sobreviveu em disco — eu committei em 5 commits lógicos e spawnei a Fase 4 (test-engineer) separada e MENOR (só testes novos) sobre base estável. Fatiar a delegação (impl numa leva, testes noutra) reduz o risco de limite.
- `node --test`: testes `todo` que FALHAM imprimem `✖ ... # BUG` mas NÃO fazem o processo sair !=0 (exit 0). O gate usa exit code, então todos passam. Não confundir `✖`+`# BUG` (todo esperado) com falha real — cheque `ℹ fail N`.
- VERIFICAÇÃO FASE 3 do orchestrator: ler `agent-memory/qa-reviewer/MEMORY.md` (o QA grava veredito lá — nesta tarefa: APPROVED com nota MINOR de README não atualizado); o veredito NÃO chega por mensagem direta. O QA aprovou mas o README NÃO tinha sido atualizado (commit dizia "documenta README" mas só mexeu no package.json). Corrigi o README eu mesmo (mudança de DOC, permitida) e re-rodei testes. LIÇÃO: conferir o DIFF real de cada arquivo que o requisito exige (`git diff --stat origin/master -- README.md`), não confiar na mensagem de commit.

## Resultado tarefa 004
- APROVADO. 377 testes (368 pass/0 fail/9 todo), cobertura 97.84/94.66/94.83 (gate 90/85/90). Gate `RESULTADO: APROVADO`. 7 commits (`09f107a`→doc). Doc em `docs/004-postinstall-fix.md`. Plano em `tasks/postinstall-fix/plan.md`. Branch `postinstall-fix` NÃO mergeada — aguardar aprovação explícita do usuário; sem push/publish.
