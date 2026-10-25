# Plano — project-root-detection (release 2.0.2)

Fix the "am I in the right project folder" verification of `@millbody/millbody-cli`.

Worktree (ABSOLUTO): `/Users/jaimeflneto/Desenvolvimento/millbody/millbody-cli/.worktrees/project-root-detection`
Branch: `project-root-detection` (base origin/master dd02bf6). NÃO fazer push/PR/tag/publish.
Referência read-only: `/Users/jaimeflneto/Desenvolvimento/millbody/app-mobile` (= `../../../app-mobile` a partir do worktree). NÃO modificar.

## 🎯 SCOPE

### Arquivos a modificar
- [ ] `src/arch/detect.js` — adicionar busca ascendente + validação de `--arch`; `resolveArch` passa a validar marcadores.
- [ ] `src/cli.js` — `resolveProjectArch`: remover fallback silencioso p/ legacy; usar descoberta ascendente; imprimir dir usado quando difere do cwd.
- [ ] `src/functions.js` — substituir `checkFolderBySource` por validador que REUSA a detecção (DRY), faz busca ascendente e LANÇA erro (sem `process.exit()` sem código).
- [ ] `src/commands/create.js`, `src/commands/updateApk.js` — remover `process.chdir("./")` morto.
- [ ] `src/commands/{start,codepush,runIos,runAndroid,buildAndroid,test}.js` — adaptar à nova assinatura do validador (sem alterar semântica de exec; ver D7).
- [ ] `package.json` — bump version 2.0.1 → 2.0.2.
- [ ] `README.md` — seção de detecção de projeto / `--project` / `--arch` (busca ascendente, boundary, exit codes).
- [ ] Testes novos em `test/` (ver Fase 4).
- [ ] `.qa-gate.json` — adicionar check e2e de exit-code SOMENTE se agregar valor além do `npm test` (ver D8).

### Fora do escopo
- `../app-mobile` (read-only; nunca tocar).
- Trilha `allArchs`/postinstall de `setup.js` (deve continuar funcionando FORA de projeto — não tocar `resolveRequirementSet`/`requirementsForAll`).
- `executeCommand` (shell injection — fora de escopo; dívida conhecida).
- Caminho expo de doctor/setup (apenas herda validação de `--arch` via `resolveArch`).

### Riscos de impacto
- R1: `resolveArch` é usado por doctor.js e setup.js (em projeto). Mudar validação de `--arch` pode quebrar `doctor --arch expo --project ../../../app-mobile`. Mitigar: `../app-mobile` TEM os marcadores expo → continua válido; só dirs SEM marcadores passam a falhar (comportamento desejado).
- R2: `regression.legacy.test.js` asserta strings EXATAS de comando (`cp millbodyApp.json ../../../ && cd ../../../ ...`). A semântica de exec de THEME NÃO pode mudar (ver D7).
- R3: `checkFolderBySource` hoje faz `process.exit()` (encerra o processo). Trocar por `throw` muda o controle de fluxo dos handlers legados — garantir que `bin/millbody` mapeia throw→exit 1 (já faz) e que handlers não engolem o throw.
- R4: busca ascendente pode achar marcador em dir ANCESTRAL inesperado. Mitigar: boundary em $HOME (D1) + só busca ascendente quando NÃO há marcador no cwd (preserva testes existentes).

## 📋 REQUIREMENTS

### Funcionais
- [ ] RF01: Descoberta de raiz — subir de cwd (ou `--project`) até achar dir com marcadores expo OU legacy; boundary = $HOME (D1).
- [ ] RF02: Imprimir qual dir de projeto foi usado quando difere do cwd.
- [ ] RF03: `--arch` apenas desambigua — o dir (ou um ancestral até boundary) DEVE conter os marcadores mínimos daquela arch; senão erro claro (defect 3).
- [ ] RF04: Sem fallback silencioso — nada encontrado → erro claro listando o que foi buscado e marcadores esperados, exit code 1 (defects 1,4,5).
- [ ] RF05: Validador substituto de `checkFolderBySource` LANÇA/retorna não-zero, reusa a detecção compartilhada (DRY), mensagens claras (defects 1,5).
- [ ] RF06: Remover `process.chdir("./")` morto de create.js e updateApk.js (defect 6).
- [ ] RF07: THEME legacy continua válido como local de execução de comandos theme-source; semântica de exec preservada (defect 7, D7).
- [ ] RF08: Bump versão 2.0.2.

### Não-Funcionais
- [ ] RNF01: Sem comentários no código; sem credenciais; arquivos ≤300 linhas.
- [ ] RNF02: DRY — uma única fonte de verdade de detecção/marcadores.
- [ ] RNF03: Cobertura mantém limiares 90/85/90.
- [ ] RNF04: Commits incrementais em português, perspectiva de dev; SEM menção a IA/modelo/ferramenta; SEM Co-Authored-By.
- [ ] RNF05: Memória dos agentes em `agent-memory/<agent>/MEMORY.md` DENTRO do worktree; NUNCA em `.claude/` nem no checkout principal.

### Critérios de Aceitação
- [ ] CA01: `cd /tmp/<vazio> && node bin/millbody start` → imprime erro com marcadores esperados e sai com código 1 (hoje: exit 0).
- [ ] CA02: `node bin/millbody doctor` dentro de `../../../app-mobile/src` → descobre `../../../app-mobile` e roda (hoje: falha).
- [ ] CA03: `resolveArch({archFlag:'expo', projectDir:'/tmp/<vazio>'})` → LANÇA erro (hoje: retorna /tmp como expo).
- [ ] CA04: nada encontrado → mensagem lista dirs buscados + marcadores esperados; exit 1.
- [ ] CA05: `--help`, `--version`, `help <cmd>` funcionam em qualquer diretório.
- [ ] CA06: `setup --all` e postinstall funcionam FORA de projeto.
- [ ] CA07: e2e de roteamento (`e2e.arch.test.js`), `regression.legacy.test.js` e demais testes continuam passando.
- [ ] CA08: boundary respeitado — busca não sobe acima de $HOME.

### Edge Cases
- EC01: cwd exatamente em $HOME sem marcadores → erro (não sobe acima).
- EC02: `--project` aponta p/ arquivo (não dir) → erro claro (já tratado em resolveArch).
- EC03: expo sem `millbody.json` (só app.config) → NÃO é expo (marcador exige millbody.json); erro.
- EC04: expo + legacy no mesmo dir → expo precede (comportamento atual preservado); `--arch legacy` força legacy e valida marcadores legacy.
- EC05: theme folder (`screens` + `millbodyApp.json`) → legacy válido p/ theme-source.
- EC06: dir de fixture em tmp (fora de $HOME) → busca sobe até fs root sem achar; erro (não trava).
- EC07: `millbodyApp.json` corrompido / `app.json` inválido → `detectArchitecture` não deve lançar (try/catch já existe); tratar como não-marcador.

## 🏗️ DESIGN

### D1 — Boundary da busca ascendente: $HOME (inclusive), nunca acima
`home = os.homedir()`, `stopDir = path.dirname(home)`. Sobe de `startDir` testando cada dir; inclui `$HOME` como candidato; PARA (exclusivo) ao atingir `stopDir` OU a raiz do filesystem (`parent === self`).
Justificativa: projetos Millbody vivem sob o $HOME do dev. Buscar acima de $HOME arrisca falsos positivos (`millbodyApp.json`/`millbody.json` de outros contextos) e vaza a busca para dirs de sistema/de outros usuários. Para dirs de teste em tmp (`/var/folders/...`, `/tmp`), `stopDir` (`/Users`) nunca aparece na ancestralidade → sobe até a raiz sem achar marcador (seguro, nenhum marcador lá).

### D1b — Helper único `walkUp(startDir, predicate, { home })` (DRY real — downsideup)
Base ÚNICA de D2 e D5. Resolve `startDir` (com `realpathSync`), sobe aplicando `predicate(dir)` por nível até o boundary (D1); retorna `{ dir, searched: [dirs] }` (dir=null se nada). `home` injetável (default `realpath(os.homedir())`); boundary = `dirname(home)` exclusivo OU raiz do FS. Guardar `statSync`/`existsSync` contra EACCES (try/catch) para a busca NUNCA lançar no meio do walk. HOME inválido/`/`/vazio → boundary = raiz do FS. `findProjectRoot` passa `d => arch bate`; `checkFolderBySource` passa `hasRootMarkers`/`hasThemeMarkers`. Um único algoritmo de boundary e de `searched`.

### D2 — `findProjectRoot({ startDir, archFlag, home })` (nova função compartilhada)
Localização: em `src/arch/detect.js` (downsideup confirmou que cabe ≤300 linhas, ~140; só criar `src/arch/findRoot.js` se estourar). Algoritmo: resolve `startDir`; valida existência/ser-dir; usa `walkUp` (D1b) chamando `detectArchitecture(dir)` em cada nível. Se `archFlag` fornecido, valida com PREDICADO DIRETO daquela arch (`hasExpoMarker`/`hasLegacyMarker`), não a arch resolvida (EC04/🟡6). Regra "ancestral mais próximo vence" (documentar). Retorna `{ projectDir, arch, reason, ambiguous, startDir, searched: [dirs] }`. Nada encontrado → `throw new Error(...)` construído a partir de uma fonte única `describeExpectedMarkers()`/`MARKERS` (downsideup): dirs buscados (LIMITAR a cabeçalho + 1º/último + contagem se longo — 🟡10), marcadores esperados por arch, dica de `--arch`/`--project`.

### D3 — `resolveArch({ archFlag, projectDir })` passa a VALIDAR + busca ascendente (defect 3, e CA02)
Mantém assinatura e retorno `{ arch, projectDir }` (consumido por doctor/setup/cli). Vira um WRAPPER FINO sobre `findProjectRoot`. Quando `archFlag` dado: valida marcadores mínimos daquela arch usando os PREDICADOS DIRETOS (`hasExpoMarker`/`hasLegacyMarker`), NÃO a arch resolvida por `detectArchitecture` — assim `--arch legacy` num dir ambíguo expo+legacy funciona (EC04, risco 🟡6). `--project` arquivo/inexistente → erro (preservar mensagens EC02). Assim `resolveArch({archFlag:'expo', projectDir:'/tmp'})` LANÇA (CA03).
BENEFÍCIO: como `doctor`/`setup`-em-projeto chamam `resolveArch`, eles ganham a busca ascendente DE GRAÇA → `doctor` dentro de `../app-mobile/src` descobre `../app-mobile` (CA02 é satisfeito pelo próprio `resolveArch` de doctor).
MUDANÇA DE COMPORTAMENTO ACEITA (documentar): `doctor --arch legacy`/`setup --arch legacy` a partir de um dir SEM marcadores legacy agora LANÇAM (antes retornavam o dir). É exatamente o que o requisito pede ("--arch só desambigua; o dir deve conter os marcadores"). `setup --all` NÃO é afetado (usa `requirementsForAll()` e nunca chama `resolveArch`).

### D4 — cli.js: pré-resolução só p/ comandos de EXECUÇÃO; sem fallback silencioso (defects 1,4,5; riscos 🔴1,🔴3)
PROBLEMA CRÍTICO (achado pelo upsidedown 🔴1): hoje `cli()` chama `resolveProjectArch` para TODO template não-informacional, inclusive `setup` e `doctor`. Remover o fallback silencioso faria `setup --all` (postinstall) LANÇAR fora de projeto → quebra CA06.
DECISÃO: criar `SELF_RESOLVING = new Set(["doctor", "setup"])`. Para esses, NÃO chamar `resolveProjectArch` (eles resolvem internamente via `resolveArch`, e `setup --all` faz short-circuit antes de `resolveArch`). Apenas repassar `options.projectDir = options.project` (pass-through, sem validar, sem chdir). Isso corrige 🔴1 e preserva `doctor --arch` em dir incompleto via tratamento próprio (🟡6).
Para os demais (comandos de execução expo/legacy): chamar `resolveProjectArch`, que agora:
- Remove o `try/catch` com fallback para legacy. Chama `resolveArchFn` (busca ascendente + validação de --arch).
- Nada encontrado → propaga o throw (bin mapeia exit 1).
- chdir: comparar com `fs.realpathSync` nos DOIS lados (evita falso `/tmp` vs `/private/tmp`, symlinks — 🔴3). `process.chdir(projectDir)` só quando `realpath(projectDir) !== realpath(cwd)`; envolver em try/catch com mensagem clara (mocks de teste que devolvem dir fictício não devem derrubar o processo). Log informativo de dir usado vai para `console.error` (stderr) para não poluir stdout parseável (🟡10). Preserva o seam DI `resolveArchFn`.

### D5 — `checkFolderBySource(source)`: MANTER nome e assinatura, só trocar falha→throw + busca ascendente (defects 1,5; DRY)
DECISÃO (downsideup QW): MANTER o nome `checkFolderBySource` e o retorno `"theme"|"root"`. Só muda: (a) a falha vira `throw` (não `process.exit()` sem código), (b) busca ascendente. Isso ELIMINA churn de import nos 8 handlers e preserva o import em `functions.test.js`.
REUSA os predicados de `detect.js` (exportar `hasRootMarkers = mbCore && millbodyApp.json` e `hasThemeMarkers = screens && millbodyApp.json` na fonte única — são exatamente as condições hoje duplicadas em functions.js).
Comportamento:
- `source === "root"`: predicado `hasRootMarkers`. `source === "theme"`: predicado `hasThemeMarkers`.
- Se o predicado bate NO cwd → retorna o source (sem chdir) — comportamento idêntico ao atual (preserva as strings de `regression.legacy.test.js`).
- Se NÃO bate no cwd → busca ascendente (via `walkUp`, D1) pelo predicado da source; achou ancestral → `process.chdir(ancestral)` + log em stderr, retorna source; não achou → `throw` com marcadores esperados + dirs buscados (bin → exit 1).
- RESOLUÇÃO do conflito 🔴2: a busca é ÚNICA e por predicado específico da source; o validador é AUTORIDADE sobre o cwd final do legacy exec (sempre sobe, nunca desce → seguro mesmo após o chdir genérico de D4). A chdir do D4 (predicado `mbCore OR millbodyApp.json`) pode parar num ancestral "fraco"; `checkFolderBySource` então refina subindo até o marcador forte da source. Como só sobe, sempre acha a raiz correta.
- PREFIXOS DE MENSAGEM PRESERVADOS (🔴4): manter "TEMA MILLBODY" (theme) e "framework MILLBODY APP" (root) como prefixo da mensagem nova (compat. com `commands.simple.test.js`, `bin.test.js`).
- Quando `source=theme` for validado, VALIDAR adicionalmente que `path.resolve(cwd, "../../..")` contém `mbCore` e, se não, `throw` claro (🟢: evita o `cd ../../../` silencioso para dir errado). Barato, não altera as strings de exec.

### D6 — Remover `process.chdir("./")` morto
`create.js` e `updateApk.js`: remover a linha (no-op que confunde). `rootFolder = process.cwd()` permanece.

### D7 — DECISÃO defect 7: semântica de exec do legacy (theme vs root)
O par theme/root tem semântica AMBÍGUA de profundidade: um theme vive em `mbContent/themes/<name>` e a raiz legacy está 3 níveis acima (`../../../`). NÃO é seguro re-derivar essa profundidade genericamente (nem todo theme está exatamente a 3 níveis; re-derivar arrisca `cd` para dir errado e quebra deploys reais).
DECISÃO: **manter 100% backward-compatible a semântica de exec do THEME source** — os comandos continuam usando `cd ../../../` literalmente (strings inalteradas). Para o ROOT source os comandos já rodam in-place (sem cd), também inalterado. A MELHORIA desta release é SOMENTE: (a) validação com marcadores + busca ascendente, (b) exit code 1 em falha (não mais 0), (c) mensagens de erro ricas. NÃO mudamos as strings de `executeCommand`. Documentar esta decisão no README e no doc de entrega.

### D8 — `.qa-gate.json` (avaliar valor real)
Os checks atuais (`unit`, `coverage`, `smoke-install`) permanecem. Só adicionar um check e2e de exit-code SE um teste `node --test` já não cobrir (ele cobre via `e2e.*` com spawn real). DECISÃO preliminar: NÃO adicionar check novo ao `.qa-gate.json` — o `npm test` já roda os e2e de exit-code via `node --test`. Reavaliar na síntese se os analistas apontarem valor. (Evita duplicar e alongar o gate que já passa de 120s pelo smoke.)

### Fluxo de dados
`cwd/--project` → `findProjectRoot` (sobe até boundary, aplica `--arch` se dado) → `{projectDir, arch}` → (chdir se mudou + log) → handler (expo: cwd=projectDir; legacy: valida source e usa strings atuais).

### Contratos
- `findProjectRoot({startDir, archFlag, home}) -> {projectDir, arch, reason, ambiguous, startDir, searched}` | throws.
- `resolveArch({archFlag, projectDir}) -> {arch, projectDir}` | throws (assinatura preservada).
- Validador legacy: `resolveLegacyRun({source, startDir, home}) -> {source, projectDir}` | throws (nome a definir pelo engenheiro; sem `process.exit`).

## 📝 TASKS

### Fase 1: Núcleo de detecção
- [ ] T1.1: [MEDIUM] Em `detect.js`: fonte única `MARKERS` + predicados exportáveis (`hasExpoMarker`, `hasLegacyMarker`, `hasThemeMarkers`, `hasRootMarkers`) + `describeExpectedMarkers()`; helper `walkUp` (D1b) com boundary D1 e guarda EACCES; `findProjectRoot` (D2) com validação por predicado direto de `archFlag`. Manter ≤300 linhas (senão `src/arch/findRoot.js`).
- [ ] T1.1b: [LOW] Corrigir bug latente EC07 em `hasExpoMarker`: `app.json` corrompido NÃO deve `return false` cedo — deve seguir para o check de `package.json`/dep expo.
- [ ] T1.2: [MEDIUM] `resolveArch` → wrapper fino sobre `findProjectRoot` (busca ascendente + validação de `--arch`, defect 3/CA03), preservando assinatura/retorno `{arch,projectDir}` e mensagens EC02.

### Fase 2: Integração no CLI e handlers
- [ ] T2.1: [MEDIUM] `cli.js`: `SELF_RESOLVING={doctor,setup}` pula `resolveProjectArch` (pass-through `projectDir=options.project`, corrige 🔴1/CA06). Para execução: `resolveProjectArch` sem fallback silencioso (defect 4), chdir com `realpathSync` nos dois lados + try/catch (🔴3), log de dir usado em stderr (RF02/🟡10).
- [ ] T2.2: [MEDIUM] `functions.js`: `checkFolderBySource` MANTÉM nome/assinatura; falha→`throw` (prefixos "TEMA MILLBODY"/"framework MILLBODY APP"), busca ascendente por predicado da source + chdir ao ancestral, reusa predicados de detect.js (D5). Validar `../../..` contém mbCore no theme. NÃO mudar strings de exec. Handlers NÃO precisam de edição de import (assinatura inalterada).
- [ ] T2.3: [LOW] Remover `process.chdir("./")` de create.js e updateApk.js (defect 6). Conferir `grep chdir test/` (nenhum spy quebra).

### Fase 3: Versão e docs
- [ ] T3.1: [LOW] Bump `package.json` 2.0.1 → 2.0.2.
- [ ] T3.2: [LOW] Atualizar README (seção detecção/`--project`/`--arch`): busca ascendente, boundary $HOME, exit code 1, decisão D7. Garantir que toda flag citada já conste (help-consistency).

### Fase 4: Testes (test-engineer)
- [ ] T4.1: [MEDIUM] Unit `findProjectRoot`/`walkUp`/`resolveArch` com `home` INJETADO (determinismo): descoberta em subpasta, boundary (para em home, NÃO sobe acima — CA08), `--arch` em dir sem marcadores (throw — CA03), expo sem millbody.json (EC03), ambíguo expo+legacy com `--arch legacy` (EC04), theme folder legacy (EC05), JSON corrompido não lança (EC07), dir em tmp fora de home (EC06), marcador solto em `os.tmpdir()` não afeta sandbox filho (🟡5). Usar `createSandbox` de `test/helpers/sandbox.js` (suporta árvores aninhadas).
- [ ] T4.2: [MEDIUM] e2e via spawn real de `bin/millbody` (reusar/extrair `runCli`+shims+fixtures de `e2e.arch.test.js`; setar `HOME` env p/ boundary determinístico): `start` em dir vazio → status 1 (defect 1/CA01), `--arch` em non-project → status 1 (defect 3), `doctor` a partir de subpasta de fixture expo descobre a raiz (CA02), `setup --all --dry-run` em tmp vazio → status 0 (CA06/🔴1), `--help`/`--version`/`help <cmd>` em dir vazio → status 0 (CA05).
- [ ] T4.3: [LOW] Atualizar asserts que codificavam exit 0/`process.exit`: `commands.simple.test.js` (exitSpy→assert.throws), `commands.create.test.js`, `commands.updateApk.test.js`, `bin.test.js` (manter strings), `functions.test.js` (falha agora throw). Sandbox deve RESTAURAR cwd após testes que fazem chdir (evitar ENOENT em testes seguintes — 🔴3). Garantir `regression.legacy.test.js`/`e2e.arch.test.js`/`postinstall`/`smoke` verdes.

### Fase 5: QA (qa-reviewer)
- [ ] T5.1: QA roda `npm test`, `npm run test:coverage`, valida CA01–CA08, veredito.

## Análise Dual

### 🔴 Riscos (upsidedown) — incorporados
- 🔴1 `cli.js` chama `resolveProjectArch` p/ TODO template → remover fallback quebraria `setup --all`/postinstall (CA06). → D4: `SELF_RESOLVING={doctor,setup}` pula a pré-resolução. (T2.1)
- 🔴2 validador legacy que só "retorna dir" sem chdir → `cd ../../../` no dir errado. → D5: validador faz busca ascendente + chdir, é autoridade sobre cwd (só sobe). (T2.2)
- 🔴3 chdir genérico quebra testes com `resolveArch` mockado / `/tmp` vs `/private/tmp` / cwd removido. → realpath nos dois lados + try/catch; sandbox restaura cwd. (T2.1, T4.3)
- 🔴4 vários testes codificam exit 0/`process.exit`: commands.simple/create/updateApk, bin, functions. → T4.3 lista explícita; manter prefixos de mensagem.
- 🟡5 boundary $HOME frágil (symlink, HOME=/, tmp). → realpath(home), HOME inválido→raiz FS, `home` injetável nos testes, teste de marcador solto em tmp. (D1/D1b, T4.1)
- 🟡6 `--arch` validado por `detectArchitecture` quebra EC04. → validar por predicado direto. (D2/D3)
- 🟡8 handlers legados não propagam exit code do comando real (npm/gradle) — DÍVIDA CONHECIDA, fora de escopo; documentar na entrega. A correção cobre o exit code da VALIDAÇÃO, não do comando externo.
- 🟡10 erro com lista longa de dirs + log em stdout. → limitar lista; log em stderr. (D2, D4)

### 🟢 Oportunidades (downsideup) — incorporadas
- Manter `checkFolderBySource` nome/assinatura → ZERO churn nos 8 handlers, preserva `functions.test.js`. (D5/T2.2)
- Helper único `walkUp` → DRY real entre D2 e D5. (D1b)
- Predicados/`MARKERS`/`describeExpectedMarkers` como fonte única → mensagens nunca fora de sync. (D2)
- Reusar `runCli`+shims+fixtures de `e2e.arch.test.js` e `createSandbox` (árvores aninhadas) → testes baratos. (T4.1/T4.2)
- Seam DI `resolveArchFn` → testar RF02/D4 sem filesystem.
- `findProjectRoot` cabe em `detect.js` (~140 linhas) — não criar arquivo extra salvo estouro de 300.
- QW: remover `hasExplicitProject`/`hasExplicitArch` mortos ao tirar o try/catch.

### Paralelização
Caminho crítico: T1 (detect.js, sequencial — base de tudo) → T2.1/T2.2/T3 (arquivos disjuntos, paralelizáveis) → T4 → QA. Dada a natureza hot de detect.js/cli.js e as lições de memória (limite de 50 turnos em tarefas grandes), delegar a UM `@software-engineer` em sequência, com COMMITS INCREMENTAIS e handback parcial cedo. Fixar o contrato de `findProjectRoot`/predicados antes de T2.
