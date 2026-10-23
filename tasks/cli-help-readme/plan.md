# Plano — CLI help/version + README completo (`cli-help-readme`)

> Worktree dedicada: `.worktrees/node23-upgrade` (branch `node23-upgrade`). Node v23.11.1.
> NÃO fazer merge/push/publish. Commits incrementais em português, sem mencionar IA.

## 🎯 SCOPE

### Objetivo
(A) Criar `README.md` completo em português (o repo não tem README) com tutorial, uso do CLI e todos os recursos.
(B) Fazer o CLI suportar `--help`/`-h`, `--version`/`-v`, `millbody help`, `millbody help <cmd>` e `millbody <cmd> --help`, com mensagens claras para flag/comando desconhecidos e exit codes corretos.
(C) Fonte única da verdade (SSOT) para os textos de ajuda, reutilizada pelo `--help` e pelo menu interativo.

### Arquivos Afetados
- [x] `src/commands/registry.js` — NOVO. Registro de metadados dos comandos (SSOT).
- [x] `src/help.js` — NOVO. Renderização de ajuda (geral/comando/desconhecido) + leitura de versão.
- [x] `src/cli.js` — MODIFICADO. Parse de `--help/--version/help`, roteamento de ajuda antes do prompt/handlers, menu interativo derivado do registry, tratamento de flag/comando desconhecidos.
- [x] `README.md` — NOVO (raiz do projeto).
- [ ] `docs/002-cli-help-readme.md` — NOVO. Documento de entrega.
- [ ] `test/cli.test.js`, `test/cli.integration.test.js`, `test/bin.test.js` — MODIFICADOS/ACRESCIDOS (test-engineer).
- [ ] `test/help.test.js` ou `test/registry.test.js` — NOVO (test-engineer): render de ajuda, SSOT, consistência README↔registry.

### Fora do Escopo (NÃO TOCAR)
- Corrigir os bugs conhecidos (injeção de comando via `--account`/`themeName`; `kill -9 'lsof...'` com aspas simples que não encerra a 8081; `executeCommand` não interrompe a sequência em falhas). Serão apenas DOCUMENTADOS honestamente no README.
- Mudar comportamento dos comandos (`start`, `create`, `update-apk`, etc.) ou dos comandos externos que eles disparam.
- Mexer em dependências (`package.json` dependencies/overrides). Permitido apenas acrescentar `README.md` em `files` se necessário (ver DESIGN — provavelmente desnecessário).
- Os testes `todo` ligados aos bugs fora de escopo (injeção, kill, sequência de executeCommand) permanecem intocados.

### Riscos de Impacto
- R1: Adicionar `--help/--version` ao spec do `arg` não pode quebrar o parse atual (`--source/-s`, `--account/-a`, `--track/-t`).
- R2: Alguns testes de integração afirmam o "comportamento atual" (comando desconhecido silencioso; menu com opção `new`). Esses precisam ser atualizados para o novo comportamento. Distinguir dos `todo` de bugs fora de escopo (que permanecem).
- R3: Ajuda/version NÃO pode disparar prompt, fs, rede ou exec. Deve curto-circuitar antes de `promptForMissingOptions` e dos handlers.
- R4: Testes via processo filho de help/version devem rodar em diretório temporário vazio e nunca chegar a caminhos que executam comandos reais (evitar incidente do `npx react-native start`).

## 📋 REQUIREMENTS

### Requisitos Funcionais
- [ ] RF01: `millbody --help` e `millbody -h` e `millbody help` → ajuda geral em stdout, exit 0, sem prompt/fs/rede/exec.
- [ ] RF02: `millbody <cmd> --help`, `millbody <cmd> -h` e `millbody help <cmd>` → ajuda específica do comando (descrição, uso, flags, exemplos, pré-requisitos, efeitos colaterais, comandos externos), exit 0.
- [ ] RF03: `millbody --version` e `millbody -v` → versão lida de `package.json`, exit 0.
- [ ] RF04: Flag desconhecida → mensagem clara contendo o texto original de erro + sugestão `millbody --help`, exit ≠ 0.
- [ ] RF05: Comando desconhecido → mensagem + ajuda resumida (lista de comandos) + sugestão `--help`, exit ≠ 0 (hoje é silencioso/undefined).
- [ ] RF06: Textos de ajuda vêm de um ÚNICO registro (`registry.js`) usado também pelo menu interativo (sem duplicação).
- [ ] RF07: Menu interativo derivado do registry; opção `new` (sem handler) removida (ver DESIGN/decisão).
- [ ] RF08: `README.md` completo (ver estrutura em DESIGN), consistente com o registry (todo comando do registry aparece no README).

### Requisitos Não-Funcionais
- [ ] RNF01: SSOT — zero duplicação de texto entre `--help` e menu.
- [ ] RNF02: Sem novas dependências; apenas `node:*` e libs já presentes.
- [ ] RNF03: `npm test` e `npm run test:coverage` (limiares 90/85/90) passam.
- [ ] RNF04: Código sem comentários, autoexplicativo; SOLID/DRY.
- [ ] RNF05: Nada inventado no README — tudo verificável contra o código.

### Critérios de Aceitação
- [ ] CA01: `node bin/millbody --help` lista todos os comandos + opções globais, exit 0.
- [ ] CA02: `node bin/millbody create --help` mostra a ajuda de `create`, exit 0.
- [ ] CA03: `node bin/millbody --version` imprime a versão de package.json, exit 0.
- [ ] CA04: `node bin/millbody --xyz; echo $?` imprime mensagem + sugestão e código ≠ 0.
- [ ] CA05: `node bin/millbody comando-inexistente` imprime mensagem + ajuda resumida, exit ≠ 0.
- [ ] CA06: README contém todas as seções exigidas e cita cada comando do registry.
- [ ] CA07: Todos os comandos atuais continuam roteando como antes (nenhuma regressão de comportamento de execução).

### Edge Cases
- EC01: `millbody help` sem subcomando → ajuda geral.
- EC02: `millbody help <desconhecido>` → mensagem de comando desconhecido, exit ≠ 0.
- EC03: `millbody --help start` (flag help + positional) → ajuda do `start` (help tem prioridade).
- EC04: `millbody updateapp --help` (alias) → ajuda de `update-apk`.
- EC05: `--help` combinado com `-s/-a/-t` → ainda ajuda, sem executar.
- EC06: version lida quando cwd é qualquer pasta (resolver package.json via `import.meta.url`, não via cwd).

## 🏗️ DESIGN

### Padrões Utilizados
- SSOT / Registry pattern: `src/commands/registry.js` exporta um array de descritores de comando. Única fonte de verdade para ajuda e menu.
- Pure render functions: `src/help.js` transforma descritores em strings (testável sem efeitos colaterais).
- Short-circuit no `cli()`: ajuda/version resolvidos antes de qualquer efeito colateral.

### Descritor de comando (registry.js)
```js
{
  name: "start",
  aliases: [],
  summary: "Sobe o Metro/React Native bundler",
  usage: "millbody start [--source theme|root]",
  description: "...",
  flags: [{ flags: "--source, -s <theme|root>", description: "..." }],
  examples: ["millbody start", "millbody start --source root"],
  prerequisites: ["Pasta de tema (./screens + ./millbodyApp.json) ou root (./mbCore + ./millbodyApp.json)"],
  external: ["npm start --reset-cache", "npx react-native start --reset-cache"],
  sideEffects: ["Copia millbodyApp.json para a raiz quando source=theme"],
  interactive: true
}
```
- Comandos no registry: `start`, `test`, `run-ios`, `run-android`, `build-android`, `codepush`, `create`, `update-apk` (aliases: `updateapp`).
- `interactive: true` apenas para os que hoje aparecem no menu real e têm handler: `start`, `run-ios`, `run-android`, `codepush`, `create`.
- Opções globais documentadas à parte: `--source/-s`, `--account/-a`, `--track/-t`, `--help/-h`, `--version/-v`, comando `help`.

### Decisão de DESIGN — opção `new` do menu
`new` não tem handler no `defaultHandlers` nem comando correspondente: selecioná-la hoje silenciosamente não faz nada (defeito de UX). Decisão: **REMOVER `new` do menu interativo**, derivando o menu do registry (`interactive: true`). Justificativa: alinha o menu aos comandos reais e ao SSOT; elimina opção morta/enganosa. (Alternativa descartada: mapear `new`→`create` mudaria comportamento sem pedido do usuário.) O teste que afirma a presença de `new` (comportamento atual) será atualizado; não é um `todo` de bug fora de escopo.

### Fluxo do cli()
```
parse (arg spec + --help/-h/--version/-v)        → pode lançar erro de flag desconhecida
  ├─ erro de flag → re-throw com msg original + sugestão "millbody --help"  (bin → exit 1)
  ├─ version       → console.log(getVersion()); return                       (exit 0)
  ├─ help geral    → console.log(renderGeneralHelp()); return                (exit 0)
  ├─ help <cmd>    → cmd existe? renderCommandHelp : throw desconhecido       (0 / 1)
  ├─ prompt (só se sem template e TTY; menu via registry)
  └─ resolve handler
        ├─ existe  → handler(options)
        └─ ausente → throw Error(msg comando desconhecido + ajuda resumida)   (bin → exit 1)
```
- `help` como comando: se `args._[0] === "help"`, trata como ajuda; subcomando = `args._[1]`.
- `--help`/`-h` como flag Boolean no spec do `arg`; `--version`/`-v` idem.
- Prioridade: version > help > execução.

### Leitura de versão
`src/help.js`: `getVersion()` lê `new URL("../package.json", import.meta.url)` via `fs.promises.readFile` + `JSON.parse` (consistente com o padrão do projeto; evita import attributes e independe do cwd).

### Erros e exit codes
- Flag desconhecida: preservar substring original do `arg` (`Unknown or unexpected option: ...`) + nova linha com sugestão. `bin/millbody` já imprime `err.message` e faz `exitCode = 1`.
- Comando desconhecido: `throw new Error("Comando desconhecido: X\n\n" + ajudaResumida + "\nUse \"millbody --help\"...")`. `bin` imprime e sai 1.
- Ajuda/version imprimem em stdout (console.log) e retornam normalmente → exit 0.

### Estrutura do README.md (seções)
1. Título + descrição do CLI.
2. Requisitos (Node >=23, `.nvmrc`, ferramentas externas por comando: git, fastlane, ttab, Xcode/xed, gradle, react-native, millbodyapp.config.js).
3. Instalação (global via npm/yarn; uso local/npx).
4. Início rápido.
5. Estrutura esperada do projeto (theme vs root; `millbodyApp.json`; `mbCore`; caminho `mbContent/themes/<themeName>`; `mbCore/Constants(.js|/index.js)`; `mbCore/fastlane/keys/millbody.json`).
6. Referência completa de cada comando (o que faz, comandos externos que executa, flags, exemplos, efeitos colaterais — ex.: create/update-apk fazem git commit/push, matam processo na 8081, fecham Xcode, rodam fastlane deploy quando `--track prod`).
7. Tutoriais passo a passo (nova conta com `create`; atualizar com `update-apk`; dia a dia `start`/`run-ios`/`run-android`; publicar via `codepush`; build android).
8. Opções globais (`--source`, `--account`, `--track`, `--help`, `--version`, `help`).
9. Modo interativo e não-interativo (CI: sem TTY cai em `start`).
10. Códigos de saída (0 ok; 1 erro/flag/comando desconhecido; 130 prompt cancelado).
11. Troubleshooting (pasta errada theme/root; token/Constants ausente; Node antigo; porta 8081 ocupada).
12. Desenvolvimento (`npm test`, `npm run test:coverage` com limiares 90/85/90; estrutura de pastas; testes nunca executam comandos reais).
13. Limitações conhecidas / segurança (listar honestamente os 3 bugs não corrigidos; orientar a usar apenas valores confiáveis em `--account`/`themeName`).

### Componentes Reutilizáveis
- `parseArgumentsIntoOptions`, `promptForMissingOptions`, `cli` continuam exportados (tests dependem).
- Helpers de teste existentes: `sandbox.js`, `world.js`, `installExecMock`, `mockFetch`, `runBin` (bin.test).

## 📝 TASKS

### Fase 1: SSOT e ajuda (software-engineer)
- [x] T1.1: [MEDIUM] Criar `src/commands/registry.js` com descritores de todos os comandos + metadados de opções globais, 100% verificável contra os `src/commands/*.js`.
- [x] T1.2: [MEDIUM] Criar `src/help.js`: `getVersion()`, `renderGeneralHelp()`, `renderCommandHelp(name)`, `findCommand(name)` (resolve alias), `renderUnknownCommand(name)`.

### Fase 2: Integração no CLI (software-engineer)
- [x] T2.1: [MEDIUM] Atualizar `parseArgumentsIntoOptions` para `--help/-h` e `--version/-v` (Boolean) e detectar comando `help`/subcomando.
- [x] T2.2: [MEDIUM] Atualizar `cli()`: short-circuit version/help (geral e por comando) antes de prompt/handlers; tratar flag desconhecida (re-throw com sugestão) e comando desconhecido (throw com ajuda resumida).
- [x] T2.3: [LOW] Derivar o menu interativo do registry (`interactive: true`), removendo `new`.

### Fase 3: README e doc (software-engineer)
- [x] T3.1: [MEDIUM] Escrever `README.md` conforme estrutura do DESIGN, consistente com o registry; nada inventado.
- [x] T3.2: [LOW] Avaliar `package.json` (`files`): só alterar se necessário (npm já publica README). Documentar decisão.
  - Decisão: `package.json` tem `"files": ["bin", "src"]`. O npm inclui `README.md` automaticamente em todos os pacotes, independente do campo `files`. Nenhuma alteração necessária.

### Fase 4: Testes (test-engineer)
- [ ] T4.1: [MEDIUM] Testes unitários de `help.js`/`registry.js`: render geral/por comando, resolução de alias, versão, comando desconhecido.
- [ ] T4.2: [MEDIUM] Teste de consistência: todo `name` do registry aparece no `README.md`.
- [ ] T4.3: [MEDIUM] Atualizar `cli.test.js`/`cli.integration.test.js` para novo comportamento (help/version sem prompt; comando desconhecido com mensagem; menu sem `new`). Manter intactos os `todo` dos bugs fora de escopo.
- [ ] T4.4: [MEDIUM] Novos testes de `bin.test.js` (processo filho, pasta vazia): `--help` exit 0; `create --help` exit 0; `--version` exit 0; `--xyz` exit 1; comando inexistente exit 1. Nunca chegar a exec real.
- [ ] T4.5: [LOW] Garantir `npm test` e `test:coverage` (90/85/90) verdes.

### Fase 5: QA (qa-reviewer) → veredito ao orchestrator

## Análise Dual

### 🟢 Oportunidades (downsideup) — incorporadas
- O1: `cli()` é curto; inserir ramo informacional entre parse e prompt é limpo. → Extrair `resolveInformational(parsed)` PURO retornando `{ kind, text }` ou `null`; `cli()` só imprime e retorna.
- O2: `bin/millbody` já faz `console.error` + `exitCode=1` + `exit(130)`. Nenhuma mudança no bin.
- O3: registry elimina 3 duplicações (handlers, menu, README/help). Menu = `registry.filter(c=>c.interactive)`.
- O4: render puro testável sem mock; passar `registry` como parâmetro default.
- O5: reuso total de `runBin`, `createSandbox`, `installExecMock`, `mockFetch`, `exitPromptPreload`.
- O6: testes data-driven (`for (const cmd of registry)`) cobrindo `<cmd> --help`, `-h`, `help <cmd>` e alias.
- O7: menu ganha `description: summary` nas choices do @inquirer.

### 🔴 Riscos (upsidedown) — mitigações adotadas (OBRIGATÓRIAS)
- **C1 (CRÍTICO) Prototype pollution no lookup:** `handlers["constructor"]`/`toString`/`__proto__` são truthy. → Usar `Object.hasOwn(handlers, template)` para decidir handler ausente; `findCommand` usa `array.find` sobre `name`+`aliases` (NUNCA lookup em objeto). Testar `constructor`, `__proto__`, `toString` → comando desconhecido.
- **C2 (CRÍTICO) Testes de processo filho podem executar comandos reais:** → Em `runBin`, injetar `env` com `PATH` apontando para um diretório de SHIMS sentinela (`git`, `npx`, `npm`, `gradle`, `fastlane`, `ttab`, `xed`, `kill`, `killall`, `xcodebuild`) que gravam um arquivo sentinela e saem com código 99. Todo teste de help/version afirma que o sentinela NÃO foi criado. Testes de help/version NUNCA usam fixtures de projeto válido e rodam em dir temporário vazio. Spawnar `detached` e matar o process group no timeout.
- **C3 (CRÍTICO) Erro de flag — substring frágil:** → Capturar TODO erro do `arg` no parse (não só `ARG_UNKNOWN_OPTION`), preservar a `message` original (manter substring `Unknown or unexpected option`) e anexar sugestão `Use "millbody --help"...` sem perder `err.code` (usar `cause`). Cobrir também "Option requires argument".
- **A1 Testes que mudam (lista exata em T4.3):** (1) "deve oferecer a opção new..." → agora erro; (2) `deepEqual` das choices sem `new`; (3) "não deve executar nada para template desconhecido" → agora rejeita; (4) `todo` "deve informar erro para template desconhecido" → remover `todo` (passa a passar). NÃO tocar nos `todo` dos bugs fora de escopo (injeção, kill 8081, sequência de executeCommand).
- **A2 SSOT de roteamento:** execução decidida por `Object.hasOwn(handlers, ...)`; ajuda/menu pelo registry. Teste de paridade: `{names} ∪ {aliases}` do registry === `Object.keys(defaultHandlers)`. Exportar `defaultHandlers` para o teste.
- **A3 Help com positional:** `millbody foo --help` → ERRO de comando desconhecido (exit 1); `millbody help help` → ajuda geral; `millbody help a b` → usa só `a`. Cada caso vira teste.
- **A4 Curto-circuito antes do prompt (TTY):** teste com `exitPromptPreload` (TTY=true, select que lança) provando exit 0 com `--help`/`-h`/`--version`/`help` e `select` 0 chamadas.
- **A5 Consistência README↔registry endurecida:** heading `### millbody <name>` por comando; cada flag do registry aparece na seção; verificação INVERSA (todo heading existe no registry); resolver README via `import.meta.url` (testes fazem chdir).
- **M1 Cobertura por arquivo:** `getVersion` via `node:fs/promises` (ou `fs.promises`) importado normalmente; cobrir ramo de package.json ilegível/ inválido (definir: `getVersion` propaga erro → exit 1). Rodar `test:coverage` e inspecionar relatório por arquivo. Lembrar: processos filhos não contam para cobertura → cobrir `help.js`/`cli.js` com testes in-process.
- **M2 Precedência `-v`/`-h`:** documentada no README (version > help > execução; `start -v` imprime versão). Testar `-hv`.
- **M5 Remoção de `new`:** decisão delegada ao orchestrator pelo usuário ("decida no DESIGN"). Mantida a remoção, justificada. Registrar como breaking mínimo (opção morta de menu TTY) no doc de entrega.

### Decisões finais de design (derivadas da síntese)
1. `src/help.js` exporta `resolveInformational(parsed, registry = commands)` puro, além de `getVersion`, `renderGeneralHelp`, `renderCommandHelp`, `findCommand`, `renderUnknownCommand`.
2. Roteamento de execução por `Object.hasOwn`; `findCommand` por `array.find`.
3. `parseArgumentsIntoOptions` captura erro do `arg` e re-lança preservando mensagem+`cause`+sugestão.
4. Menu derivado do registry com `description: summary`.
5. `getVersion` resolve `../package.json` por `import.meta.url` e PROPAGA erro de leitura (exit 1).
6. README resolvido por `import.meta.url` nos testes.
