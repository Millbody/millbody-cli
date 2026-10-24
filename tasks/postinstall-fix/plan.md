# Plano — postinstall-fix (release 2.0.1)

## 🎯 SCOPE

### Problema
`npm i -g @millbody/millbody-cli` (v2.0.0) dispara `scripts/postinstall.js`, que chama
`src/commands/setup.js` com `projectDir = process.cwd()` (o diretório do pacote dentro de
`.../lib/node_modules/@millbody/millbody-cli`). `setup()` chama `resolveArch()` que lança
`"Não foi possível detectar a arquitetura do projeto em: ..."`. O erro é engolido para
`.millbody-postinstall.log` e a auto-instalação das ferramentas externas NUNCA acontece.

### Arquivos Afetados
- [ ] `src/commands/setup.js` — nova trilha `allArchs` que ignora `resolveArch`
- [ ] `src/requirements/requirements.js` — helper de união dedup de requisitos entre arquiteturas + `evaluateRequirements` aceitando lista explícita
- [ ] `scripts/postinstall.js` — usa `allArchs: true` (sem detecção de arch no install)
- [ ] `src/cli.js` — flag opcional `--all` → `options.allArchs`
- [ ] `src/commands/registry/shared.js` — descritor do `setup` (flag `--all`, exemplo)
- [ ] `README.md` — seção de instalação / `millbody setup`
- [ ] `package.json` — bump de versão `2.0.0` → `2.0.1`
- [ ] `.qa-gate.json` (novo, raiz) — checks do gate global
- [ ] `test/smoke/smoke-install.sh` (novo, NÃO publicado) — smoke test real de instalação
- [ ] `.gitignore` — adiciona `.worktrees/`
- [ ] testes em `test/` — nova trilha de setup + postinstall

### Fora do Escopo
- `../app-mobile` (NÃO tocar)
- Checkout principal / `yarn.lock` do checkout principal (NÃO tocar)
- Refatorar o `exec`+shell do caminho legado, injections, consolidação de lockfile
- Publicar/push/PR/tag (parar após commits locais)

### Riscos de Impacto
- R1: `resolveArch` é usado também por `doctor` e pelo `setup` em projeto — a trilha `all` NÃO pode alterar o comportamento existente de `millbody setup` dentro de um projeto.
- R2: Ordem/estabilidade da união de requisitos — dedup por `key` precisa ser determinística.
- R3: Smoke test precisa ser hermético (nunca chamar brew/corepack/gem reais nem tocar o prefixo global real do usuário).
- R4: `scripts/postinstall.js` auto-executa `run()` no import — testes devem setar `MILLBODY_SKIP_SETUP=1` antes de importar.
- R5: Cobertura (lines 90 / branches 85 / functions 90) precisa continuar passando com os novos ramos.

## 📋 REQUIREMENTS

### Requisitos Funcionais
- [ ] RF01: Instalar o pacote instala os requisitos da UNIÃO de ambas as arquiteturas (dedup por `key`), sem detecção de arquitetura em tempo de install.
- [ ] RF02: `setup` aceita opção `allArchs: true` (ou `arch: "all"`) que ignora `resolveArch` e avalia `requirementsFor` de cada arch.
- [ ] RF03: `millbody setup` rodado dentro de um projeto mantém o comportamento atual (detectar arch / `--arch` / `--project`). Opcional: `millbody setup --all`.
- [ ] RF04: Regras de skip mantidas (`MILLBODY_SKIP_SETUP`, CI, non-darwin, root, dev-install) e timeout de 180s.
- [ ] RF05: Postinstall nunca falha o `npm install` (exit 0); log registra claramente `setup concluído` no sucesso ou `erro:` na falha.
- [ ] RF06: Homebrew ausente não derruba o resto — reportado como manual, e o que for possível (ex.: corepack) ainda roda.
- [ ] RF07: README (instalação) e `millbody --help` atualizados se flags/comportamento mudarem.
- [ ] RF08: Versão em `package.json` passa para `2.0.1` (e qualquer constante/teste que a espelhe — hoje só `package.json`; testes leem dinâmico).
- [ ] RF09: `.qa-gate.json` na raiz com `{"checks":[{name,run,timeout}]}`; cada `run` via `bash -lc` na raiz, exit 0. Checks: `npm test`, `npm run test:coverage`, smoke real.
- [ ] RF10: `.worktrees/` adicionado ao `.gitignore`.

### Requisitos Não-Funcionais
- [ ] RNF01: Node 23, `node:test`, ESM, sem comentários no código, sem credenciais.
- [ ] RNF02: Cobertura mantida (90/85/90) e todos os testes existentes passando.
- [ ] RNF03: Smoke test hermético, limpa dirs temporários, FALHA no código pré-fix e PASSA no código final.
- [ ] RNF04: Commits incrementais em português, da perspectiva do desenvolvedor, SEM menção a Claude/IA/ferramenta e SEM trailer Co-Authored-By.
- [ ] RNF05: Arquivos ≤ 300 linhas efetivas (limite do QA) — dividir se necessário.

### Critérios de Aceitação
- [ ] CA01: `npm test` e `npm run test:coverage` passam no worktree.
- [ ] CA02: Smoke test FALHA no commit pré-fix e PASSA no commit final (evidência registrada).
- [ ] CA03: `python3 ~/.claude/hooks/qa_gate.py check <worktree>` imprime `RESULTADO: APROVADO`.
- [ ] CA04: `git log origin/master..HEAD --format=%B` sem menção a Claude/IA/Co-Authored-By.
- [ ] CA05: `setup` com `allArchs` instala formulas de AMBAS as archs (ex.: watchman/cocoapods de expo E fastlane de legacy).

### Edge Cases
- EC01: Homebrew ausente → brew installs falham per-requirement, loop continua, corepack roda, setup retorna não-zero mas postinstall exit 0 e log sem travar.
- EC02: `allArchs` não deve chamar `resolveArch` (sem throw por falta de marcador).
- EC03: dedup: `git`, `jdk17`, `ttab`, `xcode`, `android-sdk` aparecem em ambas as archs — contar uma vez.
- EC04: Smoke: `INIT_CWD` não deve indicar dev-install (apontar para dir externo), CI vars limpas, `npm_config_global` setado, prefixo temporário.
- EC05: postinstall em dev deste repo continua pulando (INIT_CWD === pkgDir).

## 🏗️ DESIGN

### Padrões Utilizados
- Injeção de dependência (já presente): `setup(options, deps)` recebe `execFile/existsSync/env/stdin/stdout`.
- SSOT de requisitos em `requirements.js`; derivar união sem duplicar dados.
- Decisão arquitetural: trilha `all` é um BRANCH novo e isolado em `setup.js` que NÃO altera o caminho `resolveArch` (preserva doctor + setup-em-projeto). Justificativa: menor superfície de regressão, cumpre RF03.

### Fluxo (postinstall)
```
npm i -g → postinstall.run() → shouldSkip? não
   → setup({ allArchs:true, yes:true, dryRun:false, env:childEnv })
   → requirementsForAll() (união dedup por key)
   → evaluateRequirements({ reqs, deps })
   → instala autoInstallable faltantes (brew/corepack/gem), erros por-item não travam
   → log "setup concluído" | catch → log "erro:" ; exit 0 sempre
```

### Decisões (entrada única, sem ambiguidade)
- D1: ENTRADA ÚNICA = `options.allArchs === true`. NÃO implementar o alias `arch:"all"` (ambos analistas convergem: menos ramos, menos contrato público). CLI `--all` → `options.allArchs`.
- D2: Precedência — quando `allArchs` é verdadeiro, `--arch`/`--project`/`projectDir` são IGNORADOS (não lança erro; `allArchs` tem precedência). Documentar em README/help.
- D3: `requirementsForAll()` = união dedup por `key` derivada do SSOT `ARCHS` (`for arch of ARCHS { for req of requirementsFor(arch) { if !seen }}`), ordem determinística (ARCHS × ordem de declaração). Exclui archs desconhecidas por construção.
- D4: `evaluateRequirements({ arch, reqs, deps })` → `const applicable = reqs ?? requirementsFor(arch)` (nullish; `reqs:[]` = avalia nada).
- D5: `setup.js` extrai um seam `resolveRequirementSet(options)`: se `allArchs` → `{ reqs: requirementsForAll() }`; senão `resolveArch(...)` + `requirementsFor(arch)`. O resto do fluxo (loop de instalação, prints) permanece COMPARTILHADO. `resolveArch` fica intocado (preserva doctor + setup-em-projeto).

### Interfaces/Contratos
- `requirementsForAll(): Requirement[]` — ver D3.
- `evaluateRequirements({ arch, reqs, deps })` — ver D4.
- `setup(options, deps)` — ver D5.
- CLI arg `--all: Boolean` → `options.allArchs`.

### Seam de hermeticidade (SCOPE +, mínimo e autoexplicativo)
- `src/requirements/detect.js::hasBinary` HOJE concatena `/opt/homebrew/bin` e `/usr/local/bin` fixos → o smoke NÃO consegue ser hermético (vê o brew/watchman/fastlane reais da máquina do dev → não-determinístico). CORREÇÃO: os diretórios de sistema passam a vir de `env.MILLBODY_SYSTEM_BIN_PATHS` (default `"/opt/homebrew/bin:/usr/local/bin"`). Comportamento de produção idêntico (default). O smoke seta `MILLBODY_SYSTEM_BIN_PATHS=""` → detecção olha só o PATH controlado. Sem comentários; nome da env é autoexplicativo. Cobrir com teste unitário.

### Postinstall — robustez e observabilidade (resolve riscos críticos 4 e 5)
- RISCO 4 (timeout 180s mata `npm i -g`): o handler atual faz `process.kill(pid,"SIGKILL")` → npm vê sinal → `npm install` FALHA/rollback (viola RF05). CORREÇÃO: no timeout, `writelog(timeout)` e SAIR LIMPO com código 0. Tornar injetável: `run({ timeoutMs = 180000, exit = (c)=>process.exit(c) })`; handler chama `exit(0)` (teste injeta `exit = mock.fn()` + `timeoutMs` pequeno + runSetup lento → assert `exit` chamado com 0, SEM matar o runner).
- RISCO 5 (marcador falso-verde): logar o código de retorno — `setup concluído (exit=N)` (sucesso/parcial) e `erro: <msg>` (exceção). Smoke NÃO depende de xcode/android (não-determinísticos): asserts fortes são os LOGS DOS SHIMS (argv) + `setup concluído` + ausência de `erro:`.
- Observabilidade: se `appendFileSync` no dir do pacote falhar (prefixo root-owned), fallback para `os.tmpdir()/.millbody-postinstall.log`. README aponta onde fica o log.
- postinstall passa SOMENTE `{ allArchs:true, yes:true, dryRun:false, env:childEnv }` (remover `projectDir`/`arch`/`project`). Skips e (novo) timeout injetável mantidos (RF04). `npx`/não-global: comportamento atual de `isDevInstall` mantido (decisão da tarefa 003 Ciclo 2); opt-out documentado via `MILLBODY_SKIP_SETUP`.

### Smoke test (`test/smoke/smoke-install.sh` + `test/smoke/shims/`, HERMÉTICO)
Shebang `#!/usr/bin/env bash`; `set -euo pipefail`; compatível com bash 3.2 (sem mapfile/assoc arrays/`${v,,}`).
- `trap 'cleanup' EXIT INT TERM`; tmp via `mktemp -d "${TMPDIR:-/tmp}/millbody-smoke.XXXXXX"`; watchdog interno (< timeout do gate) via subshell/`kill`.
- Afirma no topo: `node -v` começa com `v23` (senão falha com mensagem clara).
- `npm pack --pack-destination "$T" --json` → extrai nome do `.tgz` do JSON (sem glob). Assert via `--json`/`tar -tzf` que `test/`, `.qa-gate.json` NÃO estão no tarball (apenas bin/src/scripts).
- SHIMDIR com APENAS `brew`, `corepack`, `gem` (cada um registra `"$@"` num log próprio e sai 0). NÃO shimar watchman/pod/fastlane/java (precisam ficar ausentes para serem "instalados"). Symlink do `node`, `npm`, `git` reais para dentro do SHIMDIR. PATH = `"$SHIMDIR:/usr/bin:/bin"` (real homebrew NUNCA entra).
- Isolamento npm: `HOME="$T/home"`, `npm_config_userconfig="$T/npmrc"`, `npm_config_globalconfig="$T/gnpmrc"`, `npm_config_cache` = cache real (`/Users/<user>/.npm`) com `--prefer-offline` (velocidade/offline), `npm_config_prefix="$T/prefix"`, `--prefix "$T/prefix"`, `npm_config_update_notifier=false`, `npm_config_scripts_prepend_node_path=false`, `MILLBODY_SYSTEM_BIN_PATHS=""`, `ANDROID_HOME` unset.
- Limpa TODAS as 10 CI vars + `MILLBODY_SKIP_SETUP` com `env -u ...`. `npm install -g "$TGZ"` rodado a partir de um CWD temporário vazio (sem `node_modules`) → `INIT_CWD` = esse dir → `isDevInstall` falso → setup RODA.
- Localiza o log em `$T/prefix/.../node_modules/@millbody/millbody-cli/.millbody-postinstall.log` (ou fallback tmp).
- Guardas LOUD (falham, nunca `exit 0` silencioso): log contém `pulando setup` → FALHA; shim-brew-log vazio → FALHA (canário: brew real teria sido usado); em caso de falha, `cat` do log + shim-logs para diagnóstico.
- Asserts de SUCESSO (determinísticos): log contém `setup concluído`; log NÃO contém `erro:`; shim-brew-log contém `install watchman`, `install cocoapods` (expo) E `install fastlane` (legacy) → prova a UNIÃO (CA05); shim-corepack-log não-vazio (yarn via corepack, expo).
- Modo PRÉ-FIX: contra o código v2.0.0, o log contém `Não foi possível detectar a arquitetura` e NÃO contém `setup concluído` → o script sai ≠ 0 (CA02). Controle positivo: mesmo script passa no commit final.

### .qa-gate.json (raiz; os 3 checks exigidos pelo usuário)
```json
{"checks":[
  {"name":"unit","run":"npm test","timeout":300},
  {"name":"coverage","run":"npm run test:coverage","timeout":300},
  {"name":"smoke-install","run":"bash test/smoke/smoke-install.sh","timeout":420}
]}
```
Notas do gate (`~/.claude/hooks/qa_gate.py`): roda cada `run` via `bash -lc` na raiz do worktree; faz scan das MENSAGENS de commit em `origin/master..HEAD` por padrões IA (`\bclaude\b`, `\banthropic\b`, `Co-Authored-By...`) → qualquer menção REPROVA. `git add` dos arquivos cedo (o fingerprint de cache não vê conteúdo de arquivos untracked). O hook `subagent-stop` do orchestrator roda o gate inteiro no meu handback — TUDO precisa passar antes de concluir. `check` (CA03) ignora cache. Timeouts abaixo do watchdog do smoke.

## 📝 TASKS

### Fase 1: Scaffolding + prova de FALHA pré-fix (fazer PRIMEIRO)
- [ ] T1.1: [LOW] Adicionar `.worktrees/` ao `.gitignore`. (commit)
- [ ] T1.2a: [HIGH] Criar `test/smoke/shims/{brew,corepack,gem}` + `test/smoke/smoke-install.sh` hermético conforme DESIGN (isolamento npm, PATH mínimo, env seam, guardas loud, watchdog, cleanup, pack --json).
- [ ] T1.2b: [MEDIUM] Criar `.qa-gate.json` (3 checks). `git add` tudo. Rodar o smoke contra o código ATUAL (v2.0.0, pré-fix) e CAPTURAR evidência: falha, log com `Não foi possível detectar a arquitetura`, sem `setup concluído`. (commit scaffolding)

### Fase 2: Implementação Core (fix) — informada pela análise dual do @software-engineer
- [ ] T2.1: [LOW] `detect.js`: `hasBinary` lê dirs de sistema de `env.MILLBODY_SYSTEM_BIN_PATHS` (default inalterado). (seam de hermeticidade)
- [ ] T2.2: [LOW] `requirements.js`: `requirementsForAll()` (D3) + `evaluateRequirements` com `reqs ?? requirementsFor(arch)` (D4).
- [ ] T2.3: [MEDIUM] `setup.js`: seam `resolveRequirementSet(options)` + branch `allArchs` (D5). Fluxo de instalação compartilhado preserva EC01 (loop já tolera falha por item).
- [ ] T2.4: [MEDIUM] `postinstall.js`: passar só `{allArchs:true,...}`; timeout injetável com `exit(0)` limpo (risco 4); logar `setup concluído (exit=N)`/`erro:` + fallback de log em tmp (risco 5). (commit fix core)
- [ ] T2.5: [LOW] `cli.js`: `--all: Boolean` → `options.allArchs`.
- [ ] T2.6: [LOW] `registry/shared.js`: flag `--all` + `usage` + exemplo `millbody setup --all`. (commit junto de T2.5)

### Fase 3: Docs + Versão
- [ ] T3.1: [LOW] `README.md`: instalação instala união de AMBAS as archs; `--all` como caminho de reparo manual p/ quem teve v2.0.0 falho; onde fica o log; opt-out `MILLBODY_SKIP_SETUP`. DEVE conter a string `--all` (help-consistency test exige flag do registry no README).
- [ ] T3.2: [LOW] `package.json`: bump `2.0.1`. (commit docs+versão)

### Fase 4: Testes (test-engineer)
- [ ] T4.1: [LOW] Unit: `requirementsForAll` (dedup por key com tabela; `new Set(keys).size===keys.length`; ordem) + `evaluateRequirements` com `reqs`/`reqs:[]`.
- [ ] T4.2: [MEDIUM] Unit/integ: `setup` trilha `allArchs` — NÃO chama resolveArch (sem throw em dir vazio, EC02), tenta instalar formulas de ambas archs; EC01 (brew falha, corepack roda, retorna 1). Reuso de `allOkDeps`/`noTTY`/`makeExecFileFn`.
- [ ] T4.3: [MEDIUM] `postinstall`: runSetup recebe `allArchs:true` e `projectDir` undefined; timeout injetável → `exit(0)` com runSetup lento; log `setup concluído (exit=N)` e `erro:`. Lembrar `MILLBODY_SKIP_SETUP=1` antes de importar (R4).
- [ ] T4.4: [LOW] Unit: `hasBinary` respeita `MILLBODY_SYSTEM_BIN_PATHS` (default e override vazio).
- [ ] T4.5: [LOW] Regressão: `doctor`/`resolveArch` ainda lançam em dir não-projeto (trilha padrão intocada).
- [ ] T4.6: [LOW] Atualizar/conferir consistency/help/registry tests p/ `--all` (podem passar sozinhos se README+registry alinhados).
- [ ] T4.7: [LOW] Rodar `npm test` + `npm run test:coverage`; garantir thresholds 90/85/90 (cobrir novos ramos).

### Fase 5: Verificação final (orchestrator)
- [ ] T5.1: Confirmar smoke FALHA pré-fix (evidência T1.2b) e PASSA no estado final (controle positivo).
- [ ] T5.2: `python3 ~/.claude/hooks/qa_gate.py check <worktree>` → `RESULTADO: APROVADO`.
- [ ] T5.3: `git log origin/master..HEAD --format=%B` sem Claude/IA/Co-Authored-By.
- [ ] T5.4: Doc de entrega em `docs/004-postinstall-fix.md`.

## Análise Dual

### 🟢 Oportunidades (downsideup) incorporadas
- Branch `allArchs` isolado protege RF03/doctor por construção → seam `resolveRequirementSet` (D5).
- SSOT em `requirements.js`: dedup é derivação, não dado duplicado (D3).
- Reuso de helpers de teste existentes (`makeExecFileFn`, `allOkDeps`, `noTTY`, `createSandbox`, `MILLBODY_SKIP_SETUP` + `mock.fn`) → T4.x sem infra nova.
- Loop de instalação já tolera falha por item → EC01/RF06 já verdadeiros; só precisa teste.
- `--all` vira caminho de reparo manual documentado p/ usuários de v2.0.0 (valor de suporte).
- Entrada única `allArchs` (dropar `arch:"all"`) e `evaluateRequirements` em 1 linha reduzem ramos/cobertura.
- Paralelização sugerida: Lane B (smoke/gate pré-fix) PRIMEIRO; depois core + surface + testes. (Executaremos via pipeline sequencial de agentes, mas com a ordem B→core→resto.)

### 🔴 Riscos (upsidedown) mitigados — mudanças OBRIGATÓRIAS já no plano
- CRÍTICO shims mascaram tools → shimar SÓ brew/corepack/gem (DESIGN smoke).
- CRÍTICO detecção lê máquina real (`/opt/homebrew/bin` fixos, java_home, xcode, ANDROID_HOME) → seam `MILLBODY_SYSTEM_BIN_PATHS` + asserts só em requisitos determinísticos (watchman/cocoapods/fastlane/corepack); unset ANDROID_HOME.
- CRÍTICO brew/corepack reais podem rodar → PATH mínimo `shimdir:/usr/bin:/bin`, symlink node/npm/git, `scripts_prepend_node_path=false`, canário (shim-log vazio = FALHA).
- CRÍTICO timeout 180s SIGKILL quebra `npm i -g` → `exit(0)` limpo injetável (risco 4) + teste.
- CRÍTICO marcador `setup concluído` falso-verde → logar `exit=N` + asserts nos shim-logs (risco 5).
- CRÍTICO pré-fix pode falhar por motivo errado → exigir mensagem específica `Não foi possível detectar a arquitetura` + controle positivo no commit final.
- Vazamento de ambiente npm → isolar userconfig/globalconfig/cache/HOME/prefix; INIT_CWD via CWD temporário vazio; unset CI vars + MILLBODY_SKIP_SETUP; guardas loud contra skip silencioso.
- Cleanup sobrevive a kill do gate → trap EXIT/INT/TERM + watchdog; mktemp BSD; bash 3.2.
- `npm pack --json` (sem glob); assert tarball não inclui `test/`/`.qa-gate.json`.
- Cache do gate não vê untracked → `git add` cedo; CA03 usa `check` (sem cache).
- Fallback de log em tmp quando prefixo é root-owned.

### ⚖️ Itens deixados FORA (documentados, não corrigidos nesta tarefa)
- `installRequirement` usa `process.env` (não `deps.env`) — pré-existente; brew/corepack já setam o que precisam; sem impacto no fix.
- jdk17 keg-only pode seguir "missing" pós brew-cask — pré-existente, fora de escopo.
- Gating por `npm_config_global` para npx — mantido o `isDevInstall` da tarefa 003 (decisão prévia + intenção do usuário "instalar ao ser instalado"); opt-out via `MILLBODY_SKIP_SETUP`.
- `.qa-gate.json` com check dependente de rede acopla releases ao registry — aceito; smoke usa `--prefer-offline` + cache real.
