# Agent Memory — test-engineer

## Padrões de Teste
- Projeto ESM, `node:test` + `node:assert/strict`, zero libs externas. Arquivos em `test/*.test.js`; helpers em `test/helpers/` (fora do glob).
- Scripts: `npm test` e `npm run test:coverage` (flags `--experimental-test-module-mocks`, limiares 90/85/90, exclusões `test/**`, `**/millbody-api-test-*/**`, `**/millbody-sandbox-*/**`).
- Bugs de produção conhecidos ficam como `{ todo: '...' }` com o comportamento correto esperado.

## Estratégias de Mock
- Mocke só fronteiras externas: `mock.module('node:child_process', {namedExports:{exec}})` (vale para `import from "child_process"`), `globalThis.fetch`, `@inquirer/prompts`. NUNCA mocke módulos de produção (`functions.js`, `api.js`, `cli.js`): a cobertura mesclada entre processos fica errada (cli.js 23%, api.js 27%).
- Caminhos de `mock.module` são relativos ao arquivo que chama (helper em test/helpers precisa de `../../src`).
- Exec fake: EventEmitter com stdout/stderr, emite `exit` via setImmediate (executeCommand faz `await exec()` antes de ligar listeners).
- bin/millbody: testar via processo filho (cobertura do filho é mesclada); ExitPromptError via `--import` preload com `module.register` hook de resolve que troca `@inquirer/prompts`.
- process.exit mockado NÃO interrompe a execução: o código segue adiante (cuidado para não chegar em exec real).
- Fixtures com `fs.mkdtemp` + `realpathSync` + `process.chdir` e restauração (`test/helpers/sandbox.js`); aguardar `fs.writeFile` assíncrono (create.js) com `waitFor`/pequeno delay no afterEach.

## Erros Recorrentes & Soluções
- `mock.restoreAll()` também desfaz `mock.module` — restaure spies individualmente (`spy.mock.restore()`). Isso causou execução REAL de `npx react-native` uma vez; sempre bloquear exec real.
- Novo import com query string (`?run=`) não é mapeado na cobertura.
- Aviso ExperimentalWarning chega via console.error; filtre em asserts.

## Cobertura & Métricas
- Final: 99.55% linhas, 97.46% branches, 100% funções. Resíduo: cli.js 72-73 (artefato de mescla de cobertura: coberto isolado), branch do bin (ExitPromptError `?.`).

## Observações
- Executar `new Promise(async ...)` em executeCommand: se `exec` lançar, a promise nunca resolve (não testado).
