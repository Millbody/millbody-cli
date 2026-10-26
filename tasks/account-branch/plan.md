# Plano — release 2.0.3: `millbody create --account <code>` cria/troca para branch `accounts/<code>` sempre a partir de `main`

Worktree: `/Users/jaimeflneto/Desenvolvimento/millbody/millbody-cli/.worktrees/account-branch` (branch `account-branch`, base origin/master 7a3078a)
Memória dos agentes: `agent-memory/<agent>/MEMORY.md` DENTRO deste worktree. NUNCA em `.claude/` nem no checkout principal.

## 🎯 SCOPE

### Arquivos Afetados
- [ ] `src/git/accountBranch.js` — NOVO módulo compartilhado (lógica de branch com DI de execFile)
- [ ] `src/arch/expoCommands.js` — chamar `prepareAccountBranch` antes de `.env.account`+yarn; reusar ACCOUNT_REGEX do módulo
- [ ] `src/commands/create.js` — substituir o `git checkout` shell-interpolado por `prepareAccountBranch`; validar account antes de qualquer git
- [ ] `src/commands/registry/shared.js` — atualizar descrição/externals/sideEffects do `create` (help derivado)
- [ ] `README.md` — seção create (expo e legacy) + nota de comportamento de branch
- [ ] `package.json` — bump de versão 2.0.2 → 2.0.3
- [ ] `test/*` — novos testes unit (execFile injetado) + integração (repos git temporários reais)

### Fora do Escopo
- Qualquer alteração em `../app-mobile` (REFERÊNCIA READ-ONLY — nenhum comando git que o altere)
- Reescrever o restante do fluxo legacy (fastlane, gradle, xed, ttab, millbodyapp.config) — intocado
- Corrigir o bug conhecido `kill -9 'lsof...'` e o `executeCommand`/shell do legacy
- Push/PR/tag/publish — proibidos

### Riscos de Impacto
- R1: `src/arch/proc.js` é o ÚNICO seam para `node:child_process`. O módulo novo DEVE receber `execFile` por injeção (default `proc.execFile`), nunca importar child_process direto.
- R2: Legacy create hoje NÃO valida account e usa `master`. Mudança para `accounts/<code>` a partir de `main` altera comportamento; repo legacy sem `main` deve FALHAR claro (não adivinhar).
- R3: Legacy create tem `git push origin ${account}` mais adiante — o nome de branch mudou para `accounts/<code>`; ver DESIGN D6.
- R4: Testes acoplados existentes (`commands.create.test.js`, `arch.expoCommands.test.js`, `e2e.arch.test.js`) podem quebrar — devem ser atualizados, mantendo verdes.
- R5: Cobertura deve permanecer ≥ 90/85/90.

## 📋 REQUIREMENTS

### Requisitos Funcionais (modo expo — em projectDir, ANTES de `.env.account` + yarn)
- [ ] RF01: Verificar que `projectDir` é repo git; senão erro claro + exit 1.
- [ ] RF02: Recusar se a working tree tem mudanças rastreadas/staged (untracked NÃO bloqueiam — ver DESIGN D2); erro claro listando commit/stash + exit 1.
- [ ] RF03: `git fetch origin main`; se não há remoto/offline/sem ref main → erro claro + exit 1 (nunca basear em main local estável).
- [ ] RF04: Se `refs/heads/accounts/<code>` existe → checkout (sem reset). Senão se `refs/remotes/origin/accounts/<code>` existe → checkout com tracking. Senão → `git checkout -b accounts/<code> origin/main`. Imprimir qual caso ocorreu.
- [ ] RF05: Após branch pronto, seguir como hoje: `.env.account` (EXPO_PUBLIC_ACCOUNT) + `yarn millbody:create`.
- [ ] RF06: account inválido (`../x`, `a;rm`, com espaços, vazio) rejeitado ANTES de qualquer chamada git, exit 1.

### Requisitos Funcionais (modo legacy — create.js, no themeFolder)
- [ ] RF07: Substituir `cd <themeFolder> && git checkout master && git checkout -b ${account} ...` por `prepareAccountBranch` (execFile arrays, shell:false) com as MESMAS regras (base `main`).
- [ ] RF08: Repo legacy sem `main` (só `master`) → FALHA com erro claro (não adivinhar). Resto do fluxo legacy intocado.
- [ ] RF09: Validar account via ACCOUNT_REGEX antes de qualquer git no legacy.

### Requisitos Não-Funcionais
- [ ] RNF01: DRY — lógica de branch em UM módulo (`src/git/accountBranch.js`) usado por ambos.
- [ ] RNF02: Sem shell, sem interpolação de account em string de shell no caminho de branch (execFile com arrays).
- [ ] RNF03: Arquivos ≤ 300 linhas; sem comentários; sem credenciais.
- [ ] RNF04: Cobertura ≥ 90/85/90; todos os testes existentes verdes.
- [ ] RNF05: Versão 2.0.3; README + help derivado do registry atualizados.

### Critérios de Aceitação
- [ ] CA01: `npm test` e `npm run test:coverage` passam.
- [ ] CA02: Demo em clone temporário (NÃO app-mobile) com `node bin/millbody create --account demo --project <tmpclone>` e `yarn` falso no PATH: `accounts/demo` criada a partir de origin/main; 2ª execução troca para a branch existente.
- [ ] CA03: `python3 ~/.claude/hooks/qa_gate.py check <worktree>` → RESULTADO: APROVADO.
- [ ] CA04: Worktree limpo; checkout principal intocado; nenhum `.claude` criado.

### Edge Cases
- EC01: local main atrás/à frente de origin/main → a nova branch DEVE ter base == origin/main (não local).
- EC02: usuário em outra branch ao rodar → ainda baseia em origin/main.
- EC03: branch existe local E remoto → preferir local (checkout, sem reset).
- EC04: origin/accounts/<code> existe mas local não → criar tracking.
- EC05: sem remoto `origin` configurado → RF03 falha claro.
- EC06: fetch falha por rede → erro claro.
- EC07: account com maiúsculas é válido pelo regex (case-insensitive) — branch preserva o case informado.

## 🏗️ DESIGN

### Padrões Utilizados
- DI do `execFile` (seam `proc.js`), espelhando `runner.js`/`runScript`. Default `proc.execFile` promisificado.
- Módulo puro + função única `prepareAccountBranch(options)` retornando `{ branch, mode }` e lançando `Error` com mensagem clara em falha.

### Interface
```
export const ACCOUNT_REGEX = /^[a-z0-9][a-z0-9_-]*$/i;

export async function prepareAccountBranch({
  projectDir,
  account,
  baseBranch = "main",
  execFile = proc.execFile,
  log = console.log,
}) // -> { branch: `accounts/${account}`, mode: "local"|"remote"|"new" }
```
Helper interno `git(args)` = `promisify(execFile)("git", ["-C", projectDir, ...args], { shell:false })`.

### Contrato do runner git (seam execFile) — CRÍTICO
- `git(args)` interno encapsula `execFile("git", ["-C", projectDir, ...args], opts)` via Promise explícita (callback) para tolerar o mock DI (mock.fn NÃO tem `util.promisify.custom`). Normaliza resultado para `{ ok, code, stdout, stderr }` — NUNCA rejeita por exit!=0; quem decide é o chamador. `ENOENT` → `{ ok:false, code:"ENOENT" }`.
- `opts` SEMPRE: `{ shell:false, env: { ...process.env, GIT_TERMINAL_PROMPT:"0", GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND ?? "ssh -o BatchMode=yes" }, timeout: 60000, maxBuffer: 10*1024*1024 }`.
- Checagens de existência de ref usam `--verify --quiet` e tratam SÓ `code===1` como "ausente"; qualquer outro código → erro com 1ª linha do stderr. `ENOENT` → erro "git não encontrado. Instale git.".

### Fluxo (prepareAccountBranch) — mensagens EXATAS (tests asseguram verbatim)
1. Validar account (ACCOUNT_REGEX) → senão `throw new Error('Conta inválida: "<account>". ...')` (guard; handlers já validam antes de chamar).
2. `git rev-parse --is-inside-work-tree`: exit!=0 OU `stdout.trim()!=="true"` ⇒ `Error("<projectDir> não é um repositório git.")`.
3. Identidade do repo (U/finding 3): `git rev-parse --show-toplevel`; se `realpath(stdout.trim()) !== realpath(projectDir)` ⇒ `Error("O diretório não é a raiz do repositório git (toplevel: <top>).")`.
4. `git status --porcelain --untracked-files=no`: saída não-vazia ⇒ `Error("Working tree com mudanças não commitadas. Faça commit ou stash antes de continuar:\n<porcelain>")`.
5. Fetch base com refspec EXPLÍCITO: `git fetch origin +refs/heads/<base>:refs/remotes/origin/<base>`. exit!=0/ENOENT ⇒ `Error("Não foi possível buscar origin/<base> (remoto ausente, offline ou ref inexistente): <stderr 1ª linha>")`. Cobre repo legacy sem `main` (RF08) e offline (RF03).
6. Verificar `git rev-parse --verify --quiet refs/remotes/origin/<base>` presente; ausente ⇒ `Error("A branch <base> não existe no remoto origin. Crie origin/<base> ou use uma versão anterior do CLI.")`.
7. Probe remoto da conta: `git ls-remote --heads origin accounts/<account>`; se trouxe linha, `git fetch origin +refs/heads/accounts/<account>:refs/remotes/origin/accounts/<account>` (garante tracking ref atual — finding 1).
8. branch = `accounts/<account>`; usar `git switch` (sem ambiguidade com tags/paths):
   - local existe (`--verify --quiet refs/heads/<branch>`, code 0) → `git switch <branch>`; mode=local. Após, logar divergência vs origin/base: `git rev-list --left-right --count origin/<base>...<branch>` (apenas informativo; NUNCA reset).
   - senão remoto existe (`refs/remotes/origin/<branch>`) → `git switch -c <branch> --track origin/<branch>`; mode=remote.
   - senão → `git switch -c <branch> --no-track origin/<base>`; mode=new (--no-track evita upstream errado → finding 2).
   - Qualquer `switch` com exit!=0 (ex.: já em uso em outro worktree, untracked seria sobrescrito) ⇒ `Error("Falha ao trocar para <branch>: <stderr 1ª linha>")`.
9. `log` da linha do caso: new=`Branch accounts/<account> criada a partir de origin/<base>.`; remote=`Branch accounts/<account> criada rastreando origin/accounts/<account>.`; local=`Reaproveitando branch local accounts/<account> (origin/<base>: +A/-B).`
10. retorna `{ branch, mode }`.

### Decisões (justificativas)
- D1: Validação de account no handler E no módulo (defense-in-depth). Mantém ACCOUNT_REGEX em UM lugar (módulo) e re-exporta p/ expoCommands (remove duplicata).
- D2: Untracked NÃO bloqueiam. `create` no fluxo expo grava `.env.account` (arquivo novo/local) e o fluxo pode gerar artefatos; bloquear untracked seria hostil e não indica trabalho em risco de perda. Mudanças RASTREADAS/staged bloqueiam (risco real de perda ao trocar branch). Implementado via `--untracked-files=no`.
- D3: fetch obrigatório; sem silenciar offline (RF03) — evita basear em main local estável. `checkout -b ... origin/main` garante base == origin/main (EC01/EC02).
- D4: Preferência local > remoto > novo (RF04). Local nunca é resetado (preserva trabalho do usuário).
- D5: Repo legacy sem `main`: passo 5 falha claro (não cai para master). Documentado.
- D6: Legacy `create.js` tem adiante `git commit -m "launch app" && git push origin ${account}`. Como o nome da branch agora é `accounts/<account>`, o push referenciaria um ref inexistente. account é validado por ACCOUNT_REGEX antes de qualquer git, então interpolar `accounts/${account}` no push é seguro. Ajuste MÍNIMO e justificado: trocar o ref do push para `accounts/${account}` para consistência. Resto do fluxo legacy intocado. (Nenhum push real é executado nos testes/demo; demo é só expo.)
- D7: Legacy `create.js` ganha parâmetro `deps = {}` opcional (`deps.prepareAccountBranch`) para injeção em teste, default = real. Assinatura pública `create(options)` preservada (cli chama com 1 arg).
- D8: expo handler: ordem nova = validar account → `prepareAccountBranch` (try/catch → console.error(err.message) + return 1) → `.env.account` → yarn. Injetar `prepareAccountBranch` como dep de `makeExpoHandlers` (espelha `runScript`).
- D9 (finding 3): legacy `create.js` roda `prepareAccountBranch(themeFolder)` ANTES de `getAppAccount` e de qualquer `fs.writeFile` — evita estado parcial e dirty check sobre arquivo que o próprio CLI escreveu. Em falha, `throw` → `bin/millbody` captura → exit 1.
- D10 (git >= 2.23): usa `git switch`. Adicionar git às prerequisites do registry. macOS/CI atuais têm git moderno.
- D11 (--dry-run): `create` NÃO suporta `--dry-run` hoje; mantido SEM suporte (sem mudança de comportamento). Documentar.
- D12 (versão): usuário fixou 2.0.3. A mudança do ref de push legacy (`<account>`→`accounts/<account>`) e a exigência de `main` no legacy SÃO mudanças de comportamento — documentar claramente em README e doc de entrega como "behavior change" (sem bloquear o bump 2.0.3 pedido pelo usuário).
- D13 (promisify/DI): NÃO usar `promisify(execFile)` direto (mock sem `promisify.custom` diverge). Encapsular em Promise via callback no runner `git()` (ver Contrato).

### Componentes Reutilizáveis
- `proc.execFile` (seam existente), padrão de `runScript` (DI + Promise), ACCOUNT_REGEX existente, `createSandbox`/helpers de teste em `test/helpers`.

## 📝 TASKS

### Fase 1: Módulo compartilhado
- [ ] T1.1: [MEDIUM] Criar `src/git/accountBranch.js` (ACCOUNT_REGEX + prepareAccountBranch, DI execFile, ≤300 linhas, sem comentários).

### Fase 2: Integração expo + legacy
- [ ] T2.1: [MEDIUM] `expoCommands.js`: importar ACCOUNT_REGEX e prepareAccountBranch do módulo; nova ordem no handler create; remover ACCOUNT_REGEX duplicado.
- [ ] T2.2: [MEDIUM] `create.js`: validar account; substituir checkout shell por prepareAccountBranch(themeFolder); ajustar ref do push (D6); deps injetável (D7).

### Fase 3: Docs + versão
- [ ] T3.1: [LOW] `registry/shared.js` (hoje 276 linhas): atualizar descrição/externals/sideEffects do create (branch `accounts/<code>` a partir de main; add entrada `(expo)` para os passos git). MANTER < 300 linhas (verificar `wc -l`); se exceder, extrair o descritor `create` para `registry/create.js` preservando ordem/interface do agregador.
- [ ] T3.2: [LOW] `README.md`: seção create (expo+legacy) + comportamento de branch.
- [ ] T3.3: [LOW] `package.json`: versão 2.0.3.

### Fase 4: Testes (test-engineer)
- [ ] T4.0: [LOW] Criar `test/helpers/gitRepo.js`: `makeOriginAndClone()` → bare origin com `main` + clone, env hermético (`GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_SYSTEM=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`, `HOME=<tmp>`, `GIT_AUTHOR_*`/`GIT_COMMITTER_*`, `GIT_TERMINAL_PROMPT=0`, `GIT_CEILING_DIRECTORIES=<tmp parent>`), `git init -b main -c commit.gpgsign=false`. Assert `projectDir` começa com `os.tmpdir()`. Cleanup só em dirs mktemp.
- [ ] T4.1: [HIGH] Unit de `accountBranch.js` com execFile injetado (runner dispatcher por `args`): cada caso/erro (RF01-RF06), classificação de exit code (code 1=ausente vs code 128/ENOENT=erro, stderr na msg), account inválido rejeitado antes de git, mensagens verbatim, argv exato (`--no-track`, `switch -c --track`, fetch refspec explícito). Arquivo separado `test/git.accountBranch.test.js`.
- [ ] T4.2: [HIGH] Integração em repos git temporários REAIS (via gitRepo.js), arquivo `test/git.accountBranch.int.test.js` SEM module-mock: new from origin/main com SHA == origin/main (checar por `rev-parse`/`merge-base --is-ancestor`, com local atrás/à frente/em outra branch/detached), local existente (sem reset), remoto-only (tracking), dirty bloqueia, untracked permitido, sem remoto/fetch falha, legacy sem `main` (só master) falha claro, `branch.<b>.merge` ausente após mode=new (finding 2).
- [ ] T4.3: [MEDIUM] Atualizar testes acoplados: `arch.expoCommands.test.js` (injetar stub `prepareAccountBranch`, add ordem+falha), `commands.create.test.js`/`regression.legacy.test.js` (injetar `deps.prepareAccountBranch`, ajustar índices e o ref de push `accounts/acme`; `grep -rn "checkout master" test/`), e2e `create` (fixture real repo OU novo `test/e2e.accountBranch.test.js` com git real + shim só de yarn — cobre CA02), help-consistency/help-render (derivados do registry). Manter verdes e cobertura ≥ 90/85/90 (`npm run test:coverage` após cada fase).

## 🔀 Análise Dual

### 🔴 Riscos (upsidedown — síntese)
- U1: `git fetch origin main` cria/atualiza `refs/remotes/origin/main` mesmo sem rastreamento local — por isso o passo 5 verifica `refs/remotes/origin/main` (não `refs/heads/main`). Repo legacy só com `master`: `git fetch origin main` falha com "couldn't find remote ref main" → já é o erro claro exigido (RF08). Capturar stderr do reject do execFile promisificado e repassar na mensagem.
- U2: promisify(execFile) REJEITA em exit!=0 com `err.stdout/err.stderr/err.code`. TODO passo deve capturar e converter em `Error` com mensagem PT clara. `rev-parse --verify --quiet` sai !=0 quando ref ausente — tratar como "ausente" (não erro fatal), NÃO deixar rejeitar o fluxo. Usar wrapper que retorna código em vez de lançar nas checagens de existência (ex.: try/catch → boolean).
- U3: detached HEAD / usuário em outra branch: `checkout -b <branch> origin/main` funciona independente do HEAD atual (EC02). Shallow clone: `fetch origin main` traz o necessário; aceitável.
- U4: `--track origin/<branch>` só quando LOCAL não existe (mode=remote). Se local existe, mode=local sem `-b`/`--track` (evita "branch already exists"). Ordem de verificação garante isso.
- U5: D6 (push ref) — manter o ajuste mínimo `accounts/${account}` (account validado por regex antes ⇒ seguro). Documentar que nenhum push roda em teste/demo. Alternativa considerada e rejeitada: deixar `${account}` quebraria o push legacy.
- U6: `--untracked-files=no` casa com "bloquear rastreadas/staged, permitir untracked" (RF02/D2) — confirmado: porcelain omite `??` com essa flag; staged e modificações rastreadas aparecem.
- U7: Hermeticidade dos testes de integração: criar repos em `mktemp -d`, setar `HOME`/`GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` isolados e `user.email`/`user.name` locais; `GIT_TERMINAL_PROMPT=0`. NUNCA tocar `../app-mobile` nem config global do usuário. `git init -b main` (ou init + branch -m) para a bare origin.
- U8: Tamanho: `accountBranch.js` deve ficar bem < 300 linhas; dividir testes grandes por responsabilidade (unit vs integração em arquivos separados).

### 🟢 Oportunidades (downsideup — síntese)
- O1: Reusar o seam `proc.execFile` e o padrão Promise de `runScript` (runner.js) — mesma forma de DI (default real + injeção em teste via mock.fn), sem `mock.module`.
- O2: Reusar `test/helpers` (sandbox/tmpdir) e o padrão de e2e com shim no PATH (`test/e2e.arch.test.js`) para a demo/CA02 (yarn falso que grava argv+cwd).
- O3: ACCOUNT_REGEX já existe em expoCommands — mover p/ o módulo e re-exportar remove duplicata (DRY) com churn mínimo.
- O4: Testes acoplados: `arch.expoCommands.test.js` injeta `runScript`; adicionar injeção de `prepareAccountBranch` no mesmo estilo mantém o caminho de teste simples. Legacy `commands.create.test.js` tem casos `todo` para o git — agora podem virar testes reais via `deps.prepareAccountBranch` injetado.
- O5: Paralelismo seguro: 1 engenheiro para impl (T1-T3 são sequenciais/acoplados), depois 1 test-engineer. Evitar paralelismo (arquivos compartilhados cli/registry/README).

### Ajustes incorporados ao plano
- RF03/passo 5 verificam `refs/remotes/origin/main` após fetch (U1).
- Wrapper de existência de ref não-lançante (U2/U4).
- Testes de integração hermeticamente isolados (HOME/GIT_CONFIG_*) (U7).
- Unit e integração em arquivos de teste separados (U8).
