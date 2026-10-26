# [005] - Detecção de raiz de projeto (release 2.0.2)

## Contexto
A verificação de "estou na pasta de projeto certa" do `@millbody/millbody-cli` tinha defeitos que mascaravam erros e permitiam rodar scripts em diretórios errados: falhas saíam com código 0, não havia busca ascendente, `--arch` não validava marcadores, e havia um fallback silencioso para legacy. Esta entrega corrige a detecção e a validação do diretório de projeto.

## Escopo

### Incluído
- Busca ascendente da raiz do projeto (de cwd ou `--project`) com boundary em `$HOME`.
- Validação de `--arch` contra os marcadores mínimos da arquitetura.
- Remoção do fallback silencioso para legacy em `cli.js`.
- `checkFolderBySource` passa a lançar erro (exit 1) com mensagens ricas, reusando a detecção compartilhada.
- Remoção de `process.chdir("./")` morto em `create.js` e `updateApk.js`.
- Bump de versão para 2.0.2 e atualização do README.

### Excluído
- `../app-mobile` (referência read-only, não modificado).
- Trilha `setup --all`/postinstall (preservada; funciona fora de projeto).
- Dívidas conhecidas documentadas como `todo`: injeção de shell em `executeCommand`/`create`/`updateApk`, `kill -9 'lsof...'`, e a não propagação do exit code do comando externo (npm/gradle) nos handlers legados.

## Solução Implementada

### Arquitetura
- `src/arch/detect.js`: fonte única de marcadores (`hasExpoMarker`, `hasLegacyMarker`, `hasThemeMarkers`, `hasRootMarkers`); helper único `walkUp(startDir, predicate, { home })` (base de toda busca ascendente, com boundary em `$HOME` e `home` injetável para testes determinísticos); `findProjectRoot({ startDir, archFlag, home })`; `resolveArch` como wrapper fino que valida `--arch` por predicado direto. Correção de bug latente: `app.json` malformado não aborta mais a checagem de dependência expo.
- `src/cli.js`: `SELF_RESOLVING = { doctor, setup }` não passa pela pré-resolução de projeto (preserva `setup --all`/postinstall fora de projeto); comandos de execução resolvem via `resolveArch`, sem fallback silencioso; `chdir` compara caminhos com `realpathSync` e é protegido por try/catch; o diretório usado é informado quando difere do cwd.
- `src/functions.js`: `checkFolderBySource` mantém nome/assinatura e retorno `"theme"|"root"`, mas lança erro (prefixos "TEMA MILLBODY"/"framework MILLBODY APP") em vez de `process.exit()` sem código, com busca ascendente pelos marcadores da source.

### Decisão de design (D7 — theme vs root legacy)
A semântica de profundidade do par theme/root é ambígua. Para evitar regressão em deploys reais, a semântica de execução do `--source theme` foi mantida 100% compatível (`cd ../../../` literal). A melhoria desta release é na validação, exit code e mensagens; as strings de execução não mudaram.

### Arquivos Modificados
| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/arch/detect.js` | Modificado (walkUp, findProjectRoot, predicados, validação --arch) |
| `src/cli.js` | Modificado (SELF_RESOLVING, sem fallback silencioso, chdir realpath) |
| `src/functions.js` | Modificado (checkFolderBySource lança erro + busca ascendente) |
| `src/commands/create.js` | Modificado (remove chdir morto) |
| `src/commands/updateApk.js` | Modificado (remove chdir morto) |
| `package.json` | Modificado (versão 2.0.2) |
| `README.md` | Modificado (seção de detecção) |
| `test/arch.detect.test.js` | Modificado (resolveArch/detectArchitecture) |
| `test/arch.findRoot.test.js` | Criado (13 testes de findProjectRoot/walkUp) |
| `test/e2e.rootDetection.test.js` | Criado (9 testes e2e exit code) |
| `test/{bin,cli,cli.integration,commands.create,commands.setup,commands.simple,commands.updateApk,functions}.test.js` | Modificado (comportamento throw) |

## Testes
| Métrica | Valor |
|---------|-------|
| Total | 415 (407 pass / 0 fail / 8 todo) |
| Novos unit (findProjectRoot/walkUp) | 13 |
| Novos e2e (exit code via spawn real) | 9 |
| Cobertura linhas | 96.89% (limiar 90%) |
| Cobertura branches | 93.80% (limiar 85%) |
| Cobertura funções | 96.77% (limiar 90%) |

Os 8 `todo` são bugs pré-existentes fora de escopo (injeção de shell, lsof, executeCommand).

## Evidência (before → after, via `node bin/millbody` real)
| Defeito | Antes | Depois |
|---------|-------|--------|
| 1. Falha saía 0 | `start` em dir vazio imprimia erro e EXIT 0 | erro com marcadores + EXIT 1 |
| 2. Sem busca ascendente | `doctor` em `app-mobile/src` falhava | descobre `app-mobile` e roda |
| 3. `--arch` sem validação | `resolveArch({archFlag:'expo', projectDir:<vazio>})` retornava o dir | lança erro |
| 4. Fallback silencioso | legacy em cwd sem avisar | erro claro, sem fallback |
| 5. Mensagem pobre | sem marcadores/dirs | lista dirs buscados + marcadores esperados |
| 6. `process.chdir("./")` morto | presente em create/updateApk | removido |
| 7. `cd ../../../` legacy | sem validação | validação + mensagens; semântica preservada (D7) |

Critérios de aceitação CA01–CA08 verificados comportamentalmente com o binário real.

## Verificação de Qualidade
| Critério | Status |
|----------|--------|
| `npm test` | APROVADO (0 fail) |
| `npm run test:coverage` | APROVADO (96.89/93.80/96.77) |
| Tamanho de arquivo (≤300 linhas) | APROVADO (máx. detect.js 235) |
| Higiene de commits (sem IA) | APROVADO |
| Escopo | APROVADO |
| `app-mobile` intocado | APROVADO |
| Checkout principal intocado | APROVADO (só `yarn.lock` pré-existente) |

## Riscos em aberto
- Dívidas conhecidas (fora de escopo, documentadas como `todo`): injeção de shell via `--account`/`themeName`, `kill -9 'lsof...'` com aspas simples, não propagação do exit code do comando externo nos handlers legados.
- O boundary de busca depende de `$HOME`; em ambientes com `$HOME` simbólico/atípico a busca cai para a raiz do filesystem (tratado como seguro, sem travar).

---
**Verificado por:** Workflow Orchestrator
**Data:** 2026-10-25
**Status Final:** APROVADO (aguardando aprovação do usuário para merge; sem push/PR/tag/publish)
