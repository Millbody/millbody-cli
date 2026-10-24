# [004] - Correção do postinstall (release 2.0.1)

## Contexto
No `@millbody/millbody-cli` v2.0.0 publicado no npm, `npm i -g @millbody/millbody-cli` dispara
`scripts/postinstall.js`, que chamava `setup()` com `projectDir = process.cwd()` — o diretório do
pacote dentro de `.../lib/node_modules/@millbody/millbody-cli`. `setup()` chamava `resolveArch()`,
que lançava `"Não foi possível detectar a arquitetura do projeto em: ..."`. O erro era engolido para
`.millbody-postinstall.log` e a auto-instalação das ferramentas externas (brew, corepack, watchman,
cocoapods, JDK 17, fastlane, etc.) NUNCA acontecia. O requisito do usuário: o CLI deve instalar
sozinho todas as suas dependências ao ser instalado, suportando ambas as arquiteturas (legacy e expo).

## Escopo
### Incluído
- Trilha `allArchs` em `setup.js` que ignora `resolveArch` e avalia a UNIÃO dedup dos requisitos de
  ambas as arquiteturas (sem detecção de arch no install).
- Robustez do postinstall: timeout com saída limpa (sem SIGKILL), log do código de retorno, fallback
  de log em tmp; nunca falha o `npm install`.
- Flag opcional `millbody setup --all` (caminho de reparo manual).
- Seam de hermeticidade `MILLBODY_SYSTEM_BIN_PATHS` em `detect.js`.
- Smoke test de instalação REAL hermético, `.qa-gate.json`, `.worktrees/` no `.gitignore`.
- Bump de versão para 2.0.1; README e `millbody --help` atualizados.

### Excluído
- `../app-mobile` e o checkout principal (não tocados).
- Refatoração do `exec`+shell legado, injections, consolidação de lockfile, gating por `npm_config_global`.
- Publicação (push/PR/tag/npm publish).

## Solução Implementada

### Arquitetura
- Entrada ÚNICA `options.allArchs` (sem alias `arch:"all"`). CLI `--all` → `options.allArchs`. Quando
  `allArchs` é verdadeiro, `--arch`/`--project` são ignorados.
- Seam `resolveRequirementSet(options)` em `setup.js`: `allArchs` → `{ reqs: requirementsForAll() }`;
  senão `resolveArch(...)` + `requirementsFor(arch)`. O loop de instalação permanece compartilhado, e
  `resolveArch` fica intocado (preserva `doctor` e `setup` dentro de um projeto).
- `requirementsForAll()` deriva a união dedup por `key` do SSOT `ARCHS` (ordem determinística).
- `evaluateRequirements({ arch, reqs, deps })` usa `reqs ?? requirementsFor(arch)`.
- `postinstall.js` passa apenas `{ allArchs: true, yes: true, dryRun: false, env: childEnv }`; o timeout
  (180s default, injetável) faz `exit(0)` limpo em vez de SIGKILL — assim um install lento nunca aborta
  o `npm install`. Loga `setup concluído (exit=N)` no sucesso/parcial e `erro: <msg>` em exceção, com
  fallback de log em `os.tmpdir()` quando o diretório do pacote não é gravável.
- `hasBinary` lê os diretórios de sistema de `env.MILLBODY_SYSTEM_BIN_PATHS` (default
  `/opt/homebrew/bin:/usr/local/bin`), permitindo um smoke test hermético.

### Arquivos Modificados
| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/commands/setup.js` | Modificado (seam + trilha allArchs) |
| `src/requirements/requirements.js` | Modificado (`requirementsForAll`, `evaluateRequirements`, detect brew) |
| `src/requirements/detect.js` | Modificado (seam `MILLBODY_SYSTEM_BIN_PATHS`) |
| `scripts/postinstall.js` | Modificado (allArchs, timeout limpo injetável, log exit=N, fallback) |
| `src/cli.js` | Modificado (flag `--all`) |
| `src/commands/registry/shared.js` | Modificado (descritor `--all`) |
| `README.md` | Modificado (instalação, `--all`, log, opt-out) |
| `package.json` | Modificado (versão 2.0.1) |
| `.qa-gate.json` | Criado (3 checks do gate) |
| `test/smoke/smoke-install.sh` | Criado (smoke de instalação real hermético) |
| `test/smoke/shims/{brew,corepack,gem}` | Criado (shims que registram invocações) |
| `.gitignore` | Modificado (`.worktrees/`) |
| `test/commands.setup.test.js`, `test/postinstall.test.js`, `test/requirements.test.js`, `test/requirements.detect.test.js` | Modificado (testes Fase 4) |

## Testes
| Métrica | Valor |
|---------|-------|
| Total de testes | 377 (368 pass, 0 fail, 9 todo pré-existentes) |
| Cobertura de linhas | 97.84% (limiar 90%) |
| Cobertura de branches | 94.66% (limiar 85%) |
| Cobertura de funções | 94.83% (limiar 90%) |

### Smoke test (instalação real, hermético)
- PRÉ-FIX (código v2.0.0): FALHA (exit 1) — log contém `Não foi possível detectar a arquitetura` e não
  contém `setup concluído`.
- PÓS-FIX: PASSA (exit 0) — brew chamado para `watchman` e `cocoapods` (expo) E `fastlane` (legacy)
  provando a união; corepack `enable` (expo); `setup concluído`, sem `erro:`. Repo permanece limpo.

## Verificação de Qualidade
| Critério | Status |
|----------|--------|
| `npm test` | ✅ 368 pass / 0 fail |
| `npm run test:coverage` (90/85/90) | ✅ 97.84 / 94.66 / 94.83 |
| Smoke pré-fix falha / pós-fix passa | ✅ |
| Gate global (`qa_gate.py check`) | ✅ RESULTADO: APROVADO |
| Commits sem menção a IA/Co-Authored-By | ✅ |
| Sem comentários no código / arquivos ≤300 linhas | ✅ |

---
**Verificado por:** Workflow Orchestrator
**Data:** 2026-10-24
**Status Final:** ✅ APROVADO (aguardando aprovação do usuário para merge; sem push/publish)
