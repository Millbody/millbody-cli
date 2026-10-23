# Agent Memory — test-engineer

## Padrões de Teste

- Framework: Node built-in `node:test` com `node:assert/strict`
- Runner: `node --test --experimental-test-module-mocks test/*.test.js`
- Coverage: `--experimental-test-coverage --test-coverage-lines=90 --test-coverage-branches=85 --test-coverage-functions=90`
- Convenção de arquivo: `*.test.js` em `test/`
- Projeto usa ESM (`"type": "module"`) — usar `import.meta.url` + `fileURLToPath` para `__dirname`
- Testes e2e de processo filho: usar `spawnSync` (mais simples que spawn+Promise para e2e)

## Estratégias de Mock

- `installExecMock()` em `test/helpers/world.js`: mock de `exec/execFile/spawn/spawnSync` via `mock.module("node:child_process")`
- `installProcMock(responses)` em `test/helpers/world.js`: deny-by-default, respostas por binário
- `mock.module` deve ser chamado ANTES do `import` do módulo que usa child_process
- Apenas `src/arch/proc.js` importa diretamente `node:child_process` (seam único)
- Testes e2e de processo filho: shims shell scripts reais em tmpdir, sem mock de child_process

## E2E: Shims de Processo Filho

- Criar shims como shell scripts executáveis que registram `argv=$* cwd=$(pwd)` em `$MILLBODY_SHIM_LOG`
- PATH restrito: `${shimDir}:${nodeDir}` onde `nodeDir = path.dirname(process.execPath)`
- Usar `fs.realpathSync(fs.mkdtempSync(...))` para resolver symlinks do macOS `/private/tmp`
- Passar `MILLBODY_SHIM_LOG` no env do spawnSync para cada teste
- Usar arquivo de log único por teste (contador sequencial) para isolar asserções
- Shim content: `#!/bin/sh\n[ -n "$MILLBODY_SHIM_LOG" ] && printf "argv=%s cwd=%s\\n" "$*" "$(pwd)" >> "$MILLBODY_SHIM_LOG"\n`

## Fixtures

- `expoProject`: `millbody.json` + `app.config.ts` + `package.json` (com `dependencies.expo`)
- `legacyThemeProject`: `screens/.keep` + `millbodyApp.json`
- Definidas em `test/helpers/world.js` para testes unitários
- Para e2e: criar em tmpdir real com `fs.mkdtempSync`

## Erros Recorrentes & Soluções

- mock.module call order: deve preceder o import do módulo alvo; em ESM com node:test, colocar antes do await import()
- macOS tmpdir: `/tmp` é symlink para `/private/tmp`; usar `fs.realpathSync` para comparações de cwd
- Testes e2e com spawnSync: usar `timeout: 15000` para evitar travamento
- Coverage com e2e tests: e2e tests em processo filho NÃO contribuem para cobertura do processo pai

## Cobertura & Métricas

- Thresholds: lines=90, branches=85, functions=90
- Cobertura atual (pós F6): lines=97.84%, branches=94.43%, functions=93.81%
- Arquivos mais difíceis: `scripts/postinstall.js` (funcs=50% — parte do timeout/process.exit não testável), `src/commands/setup.js`
- `bin/millbody`: branches=66.67% (caso ExitPromptError vs exitCode) — exclui da cobertura via exclude pattern

## Observações

- 9 todos pré-existentes são BUGs documentados (fora do escopo da tarefa)
- Baseline: 347 pass, 0 fail, 9 todo → após F6: 358 pass, 0 fail, 9 todo
- F6 adicionou 11 testes e2e em `test/e2e.arch.test.js`
- postinstall: "pkgDir dentro de node_modules" test já existe em `test/postinstall.test.js` (linha 58)
