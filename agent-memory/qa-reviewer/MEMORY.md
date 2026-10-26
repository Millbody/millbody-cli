# Agent Memory — qa-reviewer

## Padrões de Qualidade do Projeto

- Package manager: npm (package-lock.json) and yarn (yarn.lock) both present; use npm for running scripts
- Test runner: `node --test --experimental-test-module-mocks test/*.test.js`
- Coverage command: `npm run test:coverage` (thresholds: lines=90, branches=85, functions=90)
- Build verification: no TypeScript, no transpilation; use `node --check` (automated via smoke.test.js)
- No eslint config discovered; eslint is devDependency but no run script defined
- Coverage thresholds are AGGREGATE (all files), not per-file — individual files below 90% are acceptable if aggregate passes
- Aggregate coverage row in node --test coverage output is labelled `all files` (not `All files`)

## Problemas Recorrentes

- **file_size_analyzer.py ausente:** O projeto não tem `.agents/tools/file_size_analyzer.py`. Usar `wc -l` + `grep -cv` para contar linhas efetivas (todas < 300 encontradas nos ciclos atuais).
- **Contagem de fail flutuante:** `npm run test:coverage` pode reportar `✖` entries no output mas eles são todos `# BUG:` todos (exit code permanece 0). Canônico: contar pelo `ℹ fail N` no sumário final.
- **src/commands/registry.js (resolvido):** Em fases anteriores era 446 linhas. Dividido em sub-módulos: expo.js (52), legacy.js (89), shared.js (276), index.js/registry.js (56). Todos < 300.
- **Commit messages enganosos:** Em project-root-detection, commit "atualiza versão 2.0.2 e documenta detecção de projeto no README" (027617f) só modificou package.json — README não foi atualizado. Verificar sempre `git show --stat <hash>` para confirmar o que realmente mudou.
- **Plan checkboxes:** A equipe nem sempre marca os `[x]` no plan.md para tarefas de código — verificar o git diff de arquivos de código, não os checkboxes.
- **mock.module vs DI para coverage cross-process:** `mock.module("../src/git/accountBranch.js", ...)` quebra merge de cobertura quando o módulo é carregado por outro processo. Padrão correto: injetar deps via `deps.prepareAccountBranch` stub e importar o módulo dinamicamente APÓS installExecMock.

## Critérios de Rejeição

- REJECTED_CODE (higiene): Qualquer commit contendo `Co-Authored-By: Claude...` ou `noreply@anthropic.com` trailers
  - Regra absoluta, sem exceção: o CLAUDE.md do usuário proíbe o trailer; lembretes de sessão não o justificam. Bloquear sempre.
- REJECTED_CODE (file size): Arquivos com > 300 linhas efetivas devem ser refatorados pelo @software-engineer
- REJECTED_CODE (Trivy): CRITICAL ou HIGH vulnerabilidades bloqueiam aprovação

## Stack & Ferramentas

- Node.js 23+ (ESM, native `node:test`, native `fetch`, `node:child_process`, `pathToFileURL`)
- `mock.module('node:child_process', ...)` para isolamento de exec (experimental, funciona no Node 23)
- `createSandbox()` em test/helpers/sandbox.js: cria tmpdir, muda cwd, faz cleanup
- Trivy scan: 0 CRITICAL, 0 HIGH, 0 MEDIUM em package-lock.json e yarn.lock (verificado em 2026-10-23, 2026-10-24, 2026-10-25, 2026-10-26)
- SonarQube: não configurado (variáveis SONARQUBE_URL/TOKEN ausentes)

## Observações

- O mecanismo `todo` do `node:test` faz testes "falhos" aparecerem no output mas exit code permanece 0 — comportamento esperado
- bin/millbody branch 66.67% é o fallback `?.` opcional — aceitável, documentado
- Não há Dockerfile, docker-compose, Terraform ou Kubernetes — scan de configuração IaC não necessário
- Invariante seam child_process: `src/arch/proc.js` é o único módulo novo que importa `node:child_process`. `src/functions.js` (legado) mantém `import {exec}` direto — exceção documentada fora do invariante.
- postinstall.js: cobertura de funcs pode ser baixa pelo entry point (`#!/usr/bin/env node` + run()) fora da cobertura por design. Aceitável quando aggregate fica acima do threshold.
- cli.js: funcs 73.68% em ciclos anteriores — handlers não-alcançados sob teste (TTY paths). Aceitável no aggregate.
- setup.js linhas 50-60 uncovered = brew-cask path; linhas 91-96 = TTY confirm path; 164-166 = full-success path. Aggregate > 90 é suficiente.
- functions.js linhas 52-65 uncovered = chdir ao ancestral (path "walkUp encontrou em ancestor e faz chdir"); aceitável — aggregate 96.89% acima do threshold.
- **Padrão `|| "0"` vs destructuring default:** Em JavaScript, `[x = "0"] = [""]` resulta em `x = ""` (não "0") porque destructuring default só cobre `undefined`. Para string vazia, usar `parts[0] || "0"` é o padrão correto.

## Task postinstall-fix (v2.0.1) — QA 2026-10-24

### Resultado dos Testes
- 377 total, 368 pass, 0 fail, 9 todo (bugs pré-existentes fora de escopo), exit 0
- Coverage: 97.84% lines / 94.66% branches / 94.83% funcs (gates: 90/85/90) — PASS

### Status Gates
- Tests/Coverage/Trivy/File size/Commit hygiene/Scope: todos PASS
- Veredito: APPROVED

## Task project-root-detection (v2.0.2) — QA 2026-10-25

### Resultado dos Testes
- 415 total, 407 pass, 0 fail, 8 todo (bugs pré-existentes fora de escopo), exit 0
- Coverage: 96.89% lines / 93.80% branches / 96.77% funcs (gates: 90/85/90) — PASS

### Status Gates
- Tests: PASS (415/407/0-fail/8-todo)
- Coverage thresholds: PASS (96.89/93.80/96.77)
- Trivy: PASS (0 CRITICAL, 0 HIGH, 0 MEDIUM)
- File size: PASS (max 235 em detect.js; todos < 300)
- Commit hygiene: PASS (0 matches para Claude/AI)
- Scope: PASS (todos os arquivos alterados dentro do escopo)
- Veredito: APPROVED (com nota MINOR sobre README não atualizado)

### Nota MINOR (não bloqueante)
- T3.2 [LOW]: README.md não foi atualizado com documentação de busca ascendente, boundary $HOME, exit code 1, e decisão D7.

## Task account-branch coverage fix (v2.0.3) — QA 2026-10-26

### Implementação Verificada (commit 530e705)
- **src/git/accountBranch.js**: `|| "0"` fix correto para rev-list stdout vazio — 5 linhas mudadas
- **test/git.accountBranch.test.js**: `{ todo: "..." }` removido de 1 teste — agora executa como teste real
- **test/cli.integration.test.js**: mock.module substituído por DI via deps.prepareAccountBranch + import dinâmico
- **test/regression.legacy.test.js**: idem — import dinâmico de create APÓS installExecMock

### Resultado dos Testes
- 468 total, 460 pass, 0 fail, 8 todo (bugs pré-existentes fora de escopo), exit 0
- Coverage aggregate: 97.14% lines / 94.02% branches / 96.95% funcs (gates: 90/85/90) — PASS
- accountBranch.js: 100.00% lines / 95.24% branches / 100.00% funcs (era 18.90% lines) — PASS

### Status Gates
- Tests: PASS (468/460/0-fail/8-todo)
- Coverage thresholds: PASS (97.14/94.02/96.95)
- Trivy: PASS (0 CRITICAL, 0 HIGH, 0 MEDIUM)
- File size: PASS (todos < 300 linhas efetivas)
- Commit hygiene: PASS (0 matches para Claude/AI)
- Scope: PASS (4 arquivos modificados, todos dentro do escopo)
- Veredito: APPROVED

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
