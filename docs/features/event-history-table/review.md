# event-history-table — Revisão

**Branch:** `feature/event-history-table`
**Data:** 2026-06-28
**Status:** Pronto para PR (rodada frontend)

---

## Resumo

Adicionada a tabela de histórico de eventos com AG Grid (`EventHistoryTable` +
`useEventHistory`) e migrados todos os componentes do frontend para Material UI, com tema
dark centralizado. A fonte de dados da tabela está desacoplada via hook, pronta para passar
do buffer ao vivo para a query persistida `events.list` quando o backend for implementado.
`npm run typecheck:frontend` e `vite build` passam.

---

## Checklist SOLID

| Arquivo | S | O | L | I | D | Observações |
|---------|---|---|---|---|---|-------------|
| `theme/theme.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | Só tokens de tema |
| `hooks/useEventHistory.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | DI da fonte de dados; troca para `events.list` sem afetar o componente |
| `EventHistoryTable.tsx` | ✅ | ✅ | ✅ | ✅ | ✅ | Só mapeia evento→coluna; dados via hook (D) |
| `OperationsTable.tsx` | ✅ | ✅ | ✅ | ✅ | ✅ | Render props preservado sobre `Table` MUI (O) |
| `AlertPanel.tsx` | ✅ | ✅ | ✅ | ✅ | ✅ | Compound Component preservado (I/L por parte) |
| `MempoolWidget` / `EventTimeline` / `UserSwitcher` / `CreateAlertRuleForm` | ✅ | ✅ | ✅ | ✅ | ✅ | Migração visual; contrato inalterado |

---

## Checklist de documentação

- [x] `@module` em todos os arquivos novos
- [x] JSDoc nos métodos/funções públicas novas
- [x] Decisões de design registradas em `plan.md`
- [x] `plan.md` + `implementation.md` + `review.md` criados

## Checklist de testes

- [ ] Não escritos nesta rodada (não solicitados) — planejados em `plan.md`

---

## Trade-offs conhecidos

- **Bundle grande** (~1.3 MB JS): MUI + AG Grid são pesados; o `vite build` avisa >500 kB.
  Aceitável para um painel operacional interno; code-splitting fica como próximo passo.
- **Dados ainda do buffer ao vivo:** o grid mostra só o que chegou desde o load — o ganho de
  histórico persistido só se concretiza com a rodada backend. O hook já está pronto para isso.

## Fora do escopo

- Backend `events.list` (rodada posterior, a pedido do dev).
- Merge incremental ao vivo + histórico no mesmo grid.
- Testes automatizados.
- Autenticação real.

## Próximos passos sugeridos

1. Implementar `EventLogReadRepository` + `events.list` e plugar no `useEventHistory`.
2. Escrever os testes planejados em `plan.md`.
3. Code-splitting (lazy import do AG Grid) para reduzir o bundle inicial.

---

## Descrição do PR

```markdown
## O que faz
Adiciona a tabela de histórico de eventos (AG Grid) e migra todo o frontend para Material UI.

## Por que
A PR frontend-dashboard apontou como melhoria nº 1 que os componentes só mostram o que
chega ao vivo (reload zera o buffer) e não havia visão de histórico nem padrão de UI. AG Grid
dá sort/filtro/paginação; MUI padroniza a interface, antes feita com CSS solto.

## Como
- `useEventHistory` isola a fonte dos dados (DI) — hoje buffer ao vivo, depois `events.list`.
- `EventHistoryTable` mapeia `DomainEventView` → colunas AG Grid dentro de um `Card` MUI.
- Tema MUI dark central (`theme/theme.ts`) + `ThemeProvider`/`CssBaseline`; `styles.css` removido.
- Todos os componentes migrados para MUI preservando padrões (render props em `OperationsTable`,
  Compound Component em `AlertPanel`).

## Testes
typecheck + vite build passam. Testes unitários planejados (não escritos — fora de escopo).

## Documentação
- docs/features/event-history-table/plan.md
- docs/features/event-history-table/implementation.md
- docs/features/event-history-table/review.md

## Pendente (rodada backend)
- EventLogReadRepository + events.list; trocar a fonte do useEventHistory para a query.

## Checklist
- [x] SOLID verificado em todos os arquivos
- [x] JSDoc em todos os métodos públicos
- [ ] Testes unitários (planejados, não escritos)
- [x] Documentação atualizada
```
