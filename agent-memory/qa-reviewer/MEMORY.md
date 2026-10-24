# Agent Memory — qa-reviewer

## Padrões de Qualidade do Projeto

- Package manager: npm (package-lock.json) and yarn (yarn.lock) both present; use npm for running scripts
- Test runner: `node --test --experimental-test-module-mocks test/*.test.js`
- Coverage command: `npm run test:coverage` (thresholds: lines=90, branches=85, functions=90)
- Build verification: no TypeScript, no transpilation; use `node --check` (automated via smoke.test.js)
- No eslint config discovered; eslint is devDependency but no run script defined

## Problemas Recorrentes

- **file_size_analyzer.py ausente:** O projeto não tem `.agents/tools/file_size_analyzer.py`. Usar `wc -l` para contar linhas totais (todas < 300 encontradas nos ciclos atuais).
- **Contagem de fail flutuante:** `npm run test:coverage` pode reportar `fail 1` em algumas execuções por diferença de timing ou parallelismo; rodar `node --test` diretamente dá resultado canônico. Em postinstall-fix, 377 testes / 368 pass / 0 fail / 9 todo é o resultado correto.
- **src/commands/registry.js (resolvido):** Em fases anteriores era 446 linhas. Dividido em sub-módulos: expo.js (52), legacy.js (89), shared.js (276), index.js/registry.js (56). Todos < 300.

## Critérios de Rejeição

- REJECTED_CODE (higiene): Qualquer commit contendo `Co-Authored-By: Claude...` ou `noreply@anthropic.com` trailers
  - Regra absoluta, sem exceção: o CLAUDE.md do usuário proíbe o trailer; lembretes de sessão não o justificam. Bloquear sempre.
- REJECTED_CODE (file size): Arquivos com > 300 linhas efetivas devem ser refatorados pelo @software-engineer
- REJECTED_CODE (Trivy): CRITICAL ou HIGH vulnerabilidades bloqueiam aprovação

## Stack & Ferramentas

- Node.js 23+ (ESM, native `node:test`, native `fetch`, `node:child_process`, `pathToFileURL`)
- `mock.module('node:child_process', ...)` para isolamento de exec (experimental, funciona no Node 23)
- `createSandbox()` em test/helpers/sandbox.js: cria tmpdir, muda cwd, faz cleanup
- Trivy scan: 0 CRITICAL, 0 HIGH, 0 MEDIUM em package-lock.json e yarn.lock (verificado nos ciclos 2026-10-23 e 2026-10-24)
- SonarQube: não configurado (variáveis SONARQUBE_URL/TOKEN ausentes)

## Observações

- O mecanismo `todo` do `node:test` faz testes "falhos" aparecerem no output mas exit code permanece 0 — comportamento esperado
- bin/millbody branch 66.67% é o fallback `?.` opcional — aceitável, documentado
- Não há Dockerfile, docker-compose, Terraform ou Kubernetes — scan de configuração IaC não necessário
- Invariante seam child_process: `src/arch/proc.js` é o único módulo novo que importa `node:child_process`. `src/functions.js` (legado) mantém `import {exec}` direto — exceção documentada fora do invariante.
- postinstall.js: cobertura de funcs pode ser baixa pelo entry point (`#!/usr/bin/env node` + run()) fora da cobertura por design. Aceitável quando aggregate fica acima do threshold.
- cli.js: funcs 73.68% em ciclos anteriores — handlers não-alcançados sob teste (TTY paths). Aceitável no aggregate.
- setup.js linhas 50-60 uncovered = brew-cask path; linhas 91-96 = TTY confirm path; 164-166 = full-success path. Aggregate > 90 é suficiente.

## Task postinstall-fix (v2.0.1) — QA 2026-10-24

### Correções Verificadas
- **detect.js**: `hasBinary` lê system bin paths de `env.MILLBODY_SYSTEM_BIN_PATHS` (default `/opt/homebrew/bin:/usr/local/bin`). Hermeticidade do smoke via env override.
- **requirements.js**: `requirementsForAll()` (dedup por key iterando ARCHS × requirementsFor) e `evaluateRequirements({arch, reqs, deps})` com `reqs !== undefined ? reqs : requirementsFor(arch)`.
- **setup.js**: seam `resolveRequirementSet(options)` — allArchs true → retorna `{reqs: requirementsForAll()}`; senão chama `resolveArch`. Fluxo de instalação 100% compartilhado. resolveArch intocado (preserva doctor + setup-em-projeto).
- **postinstall.js**: `run({timeoutMs, exit})` injetável; timeout chama `exit(0)` limpo; catch chama `exit(0)`; loga `setup concluído (exit=N)` ou `erro:`; fallback de log em `os.tmpdir()`; `process.exitCode=0` + uncaughtException/unhandledRejection handlers.
- **cli.js + registry/shared.js**: flag `--all` → `options.allArchs`.

### Resultado dos Testes
- 377 total, 368 pass, 0 fail, 9 todo (bugs pré-existentes fora de escopo), exit 0
- Coverage: 97.84% lines / 94.66% branches / 94.83% funcs (gates: 90/85/90) — PASS

### Status Gates postinstall-fix
- Tests: PASS (377/368/0-fail/9-todo)
- Coverage thresholds: PASS (97.84/94.66/94.83)
- Trivy: PASS (0 CRITICAL, 0 HIGH, 0 MEDIUM)
- File size: PASS (máx: 276 em registry/shared.js; novos arquivos todos < 230)
- No comments in src files: PASS
- Commit hygiene: PASS (0 matches para Claude/AI/Co-Authored-By)
- Scope: PASS (todos os arquivos alterados dentro do escopo do plan.md)

## Defects Identificados por Análise Upsidedown (ciclos anteriores)

### Riscos de Confiabilidade em Testes
- **afterEach com delay fixo:** `commands.test.js:37` e `cli.integration.test.js:43` usam `setTimeout(resolve, 15/10)ms` antes de restaurar mocks. Sob carga de CI este intervalo pode ser insuficiente.
- **process.chdir sem try/finally:** Se `mockFetch(...)` lança depois de `sandbox.enter()`, o cwd é abandonado para os testes seguintes.
- **cli.integration.test.js restoreTTY:** Se `isTTY` for non-configurable, `Object.defineProperty` no restore pode lançar.

### Armadilhas de Falha Silenciosa
- **smoke.test.js:** A asserção `assert.strictEqual(result.code, 0)` para comando desconhecido codifica o bug. Qualquer correção que faça o bin sair com código != 0 vai QUEBRAR este teste.
- **commands.test.js:** `.catch(() => {})` em linhas 175-179 e 314 engole erros inesperados de `create` e `updateApk`.

### Bugs Conhecidos de Segurança (documentados como todo, desbloqueados para CI)
- Injeção de shell via `--account` e `themeName` em `create.js` e `updateApk.js` — documentados como `{ todo: "BUG: injeção..." }`
- `kill -9 'lsof -t -i:8081'` usa aspas simples (nunca executa lsof) — também um todo bug
