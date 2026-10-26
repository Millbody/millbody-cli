# [006] - Branch por conta no `create` (release 2.0.3)

## Contexto
`millbody create --account <code>` precisava criar/trocar para a branch git `accounts/<code>`, SEMPRE baseada em `main`, antes de configurar a conta. No modo expo o `create` não fazia trabalho git nenhum; no legacy usava uma string de shell interpolada (`cd <tema> && git checkout master && git checkout -b ${account}`), sujeita a injeção e baseada em `master`.

## Escopo
### Incluído
- Módulo compartilhado `src/git/accountBranch.js` com a lógica de branch (DI de `execFile`).
- Integração no handler `create` do modo expo (`src/arch/expoCommands.js`) e no legacy (`src/commands/create.js`).
- Validação de `--account` por `ACCOUNT_REGEX` antes de qualquer operação git nos dois fluxos.
- README, descritor do registry (help derivado) e bump de versão 2.0.3.
- Testes unitários, de integração (repos git reais) e e2e.

### Excluído
- Reescrita do restante do fluxo legacy (fastlane, gradle, xed, ttab, `kill -9 lsof`).
- Qualquer alteração em `../app-mobile` (referência read-only).
- Push/PR/tag/publish.

## Solução Implementada

### Arquitetura
`prepareAccountBranch({ projectDir, account, baseBranch="main", execFile=proc.execFile, log })` → `{ branch, mode }`:
1. Valida `account` (guard) e que `projectDir` é a raiz de um repo git (`is-inside-work-tree === "true"` e `show-toplevel` == realpath do projectDir).
2. Bloqueia se há mudanças rastreadas/staged (`git status --porcelain --untracked-files=no`); untracked NÃO bloqueiam.
3. `git fetch origin +refs/heads/<base>:refs/remotes/origin/<base>` (refspec explícito — funciona em clones single-branch); falha clara se offline/sem remoto/sem `main`.
4. Resolve a branch com `git switch`: local existente → reaproveita (sem reset, loga divergência vs origin/base); senão `origin/accounts/<code>` → cria rastreando; senão → cria de `origin/<base>` com `--no-track`.

Runner git interno encapsula `execFile` em Promise via callback (compatível com mock injetado), normaliza `{ ok, code, stdout, stderr }`, nunca rejeita por exit!=0, classifica `code 1` como "ref ausente" e `ENOENT`/outros como erro com a 1ª linha do stderr. Sempre passa `GIT_TERMINAL_PROMPT=0`, `GIT_SSH_COMMAND="ssh -o BatchMode=yes"`, `timeout` e `maxBuffer`. Apenas `src/arch/proc.js` importa `node:child_process`.

### Mudanças de comportamento (atenção)
- Legacy: a branch agora é `accounts/<code>` baseada em `main` (antes `<code>` a partir de `master`). O `git push` passou a referenciar `accounts/<account>`.
- Legacy: repositórios de tema sem `main` (apenas `master`) agora FALHAM com erro claro, em vez de adivinhar.
- `--account` é validado nos dois fluxos antes de qualquer git (bloqueia injeção como `a;rm`, `../x`, espaços).

### Arquivos Modificados
| Arquivo | Tipo |
|---------|------|
| `src/git/accountBranch.js` | Criado |
| `src/arch/expoCommands.js` | Modificado |
| `src/commands/create.js` | Modificado |
| `src/commands/registry/shared.js` | Modificado |
| `README.md` | Modificado |
| `package.json` | Modificado (2.0.3) |
| `test/helpers/gitRepo.js` | Criado |
| `test/git.accountBranch.test.js` | Criado |
| `test/git.accountBranch.int.test.js` | Criado |
| `test/e2e.accountBranch.test.js` | Criado |
| `test/{arch.expoCommands,commands.create,cli.integration,regression.legacy,e2e.arch}.test.js` | Modificados |

## Testes
| Métrica | Valor |
|---------|-------|
| Testes | 460 pass / 0 fail / 8 todo |
| Cobertura (linhas) | 97.14% (gate 90%) |
| Cobertura (branches) | 94.02% (gate 85%) |
| Cobertura (funções) | 96.95% (gate 90%) |
| `accountBranch.js` | 100% linhas |

Unit com `execFile` injetado; integração com bare origin+clone hermético (`GIT_CONFIG_GLOBAL=/dev/null`, `HOME` temporário); e2e com `node bin/millbody` real + `yarn` falso.

## Verificação de Qualidade
| Critério | Status |
|----------|--------|
| `npm test` | OK (fail 0) |
| `npm run test:coverage` | OK (97.14/94.02/96.95) |
| Demo real (clone temporário + yarn falso) | OK (accounts/demo de origin/main; 2ª execução reaproveita; dirty bloqueia exit 1) |
| Worktree limpo / main intocado / sem `.claude` | OK |

---
**Verificado por:** Workflow Orchestrator
**Data:** 2026-10-26
**Status Final:** Pronto para revisão do usuário (branch `account-branch` NÃO mergeada; sem push/publish)
