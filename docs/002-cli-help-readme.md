# [002] - CLI help/version + README completo

## Contexto
O repositório `@millbody/millbody-cli` não possuía `README.md`, e o CLI não tratava os padrões `--help`/`-h`, `--version`/`-v`, `millbody help` nem `millbody <comando> --help`. Antes desta entrega, `node bin/millbody --help` imprimia `Unknown or unexpected option: --help` (erro do pacote `arg`), comando desconhecido era silenciosamente ignorado e não havia documentação de uso.

## Escopo
### Incluído
- Suporte a `--help`/`-h`, `--version`/`-v`, `millbody help` e `millbody help <cmd>` / `millbody <cmd> --help`.
- Registro único de metadados de comandos (SSOT) reutilizado por `--help` e pelo menu interativo.
- Mensagens claras e exit codes corretos para flag desconhecida e comando desconhecido.
- `README.md` completo em português com tutorial, referência de comandos e limitações conhecidas.

### Excluído (fora de escopo)
- Correção dos 3 bugs conhecidos (injeção de shell via `--account`/`themeName`; `kill -9 'lsof...'` com aspas simples; `executeCommand` não interrompe a sequência em falhas) — apenas DOCUMENTADOS honestamente no README.
- Mudança de comportamento de execução dos comandos.
- Alteração de dependências.

## Solução Implementada

### Arquitetura
- **SSOT (Registry pattern):** `src/commands/registry.js` descreve todos os comandos (name, aliases, summary, usage, description, flags, examples, prerequisites, external, sideEffects, interactive). É a única fonte de verdade para ajuda e menu.
- **Render puro:** `src/help.js` expõe `resolveInformational(parsed, registry)` (puro, retorna `{kind,text}|null`), `getVersion()` (lê `../package.json` via `import.meta.url`, propaga erro), `renderGeneralHelp`, `renderCommandHelp`, `findCommand` (via `array.find` sobre name+aliases — evita prototype pollution), `renderUnknownCommand`.
- **Short-circuit no `cli()`:** version > help (geral / por comando) resolvidos ANTES de qualquer prompt/fs/rede/exec. Roteamento de execução por `Object.hasOwn(handlers, template)`. Menu derivado de `registry.filter(c => c.interactive)` com `description: summary` (opção morta `new` removida).
- **Parse resiliente:** `parseArgumentsIntoOptions` captura todo erro do `arg`, preserva a mensagem original (mantém a substring `Unknown or unexpected option`) via `cause` e anexa a sugestão `Use "millbody --help"...`.
- `bin/millbody` NÃO foi alterado (já tratava `exitCode=1` e `ExitPromptError → 130`).

### Decisões de design
- **Remoção de `new` do menu:** não tinha handler (selecioná-la não fazia nada). Decisão delegada pelo usuário ao DESIGN; removida para alinhar o menu ao SSOT e aos comandos reais.
- **Precedência `-v`/`-h`:** version > help > execução (documentado no README).
- **`package.json files`:** sem mudança — o npm publica `README.md` automaticamente.

### Arquivos Modificados
| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/commands/registry.js` | Criado |
| `src/help.js` | Criado |
| `src/cli.js` | Modificado |
| `README.md` | Criado |
| `test/registry.test.js`, `test/help-render.test.js`, `test/help-consistency.test.js` | Criados |
| `test/cli.test.js`, `test/cli.integration.test.js`, `test/bin.test.js`, `test/smoke.test.js` | Modificados |
| `docs/002-cli-help-readme.md` | Criado |

## Testes
| Métrica | Valor |
|---------|-------|
| Total de testes | 222 |
| Pass | 213 |
| Fail | 0 |
| Todo (bugs conhecidos fora de escopo) | 9 |
| Cobertura linhas (all files) | 99.78% |
| Cobertura branches (all files) | 98.30% |
| Cobertura funções (all files) | 100% |
| Limiares exigidos | 90 / 85 / 90 |

Mitigações de teste aplicadas: lookup de protótipo (`constructor`/`__proto__`/`toString` → comando desconhecido); testes de processo filho de help/version em pasta vazia sem fixtures de projeto válido; paridade registry↔defaultHandlers; casos `foo --help`/`help help`/`help a b`; curto-circuito com TTY (select 0 chamadas); consistência README↔registry (headings + flags + verificação inversa).

## Verificação de Qualidade
| Critério | Status |
|----------|--------|
| Build (`node --check`) | ✅ |
| Testes (213 pass / 0 fail) | ✅ |
| Cobertura (90/85/90) | ✅ |
| Trivy (0 vulnerabilidades) | ✅ |
| Tamanho de arquivos (<300 linhas efetivas) | ✅ |
| Comando injection / bugs fora de escopo | ⛔ Fora de escopo (documentados no README) |

### Observação sobre higiene de commits
O gate automático de QA sinaliza os trailers `Co-Authored-By: Claude ...` como violação. Nesta entrega o trailer foi EXIGIDO explicitamente pelo usuário e a reescrita de histórico foi PROIBIDA pelo usuário. Portanto o conflito é resolvido a favor da instrução explícita do usuário — não é defeito.

---
**Verificado por:** Workflow Orchestrator
**Data:** 2026-10-23
**Status Final:** ✅ APROVADO (merge/push/publish pendentes de aprovação explícita do usuário)
