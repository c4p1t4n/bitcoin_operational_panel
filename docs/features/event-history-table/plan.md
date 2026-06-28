# event-history-table — Plano

**Branch:** `feature/event-history-table`
**Data:** 2026-06-28
**Status:** Planejamento

---

## O que faz

Adiciona uma visão de **histórico de eventos** em tabela (AG Grid) com ordenação,
filtro e paginação, e migra **todos** os componentes do frontend para Material UI (MUI).

## Por que

A PR `frontend-dashboard` listou como melhoria nº 1: *"hoje os componentes só mostram o
que chegou ao vivo desde que a página carregou; recarregar zera o buffer"*. Não há query
de leitura. Uma tabela AG Grid sobre o histórico (com filtro/sort/paginação) resolve a
visualização; o MUI padroniza a UI, hoje feita com CSS solto em `styles.css`.

## Escopo

### Inclui (esta rodada — frontend primeiro, a pedido do dev)
- Dependências `@mui/material` + `@emotion/*` + `@mui/icons-material` e `ag-grid-react` +
  `ag-grid-community`.
- Tema MUI (`ThemeProvider` + `CssBaseline`) no shell da aplicação, substituindo
  `styles.css`.
- Componente `EventHistoryTable` (AG Grid) com colunas Time / Event type / Aggregate type /
  Aggregate id / Version / Summary, com sort + filtro de coluna + paginação.
- Hook `useEventHistory` — fonte de dados desacoplada do componente. **Nesta rodada** lê do
  buffer ao vivo (`WebSocketFeed` via `useDomainEvents`); foi desenhado para receber depois
  o fetch de `events.list` sem alterar `EventHistoryTable`.
- Migração para MUI de: `App`, `UserSwitcher`, `AlertPanel` (compound preservado),
  `MempoolWidget`, `EventTimeline`, `OperationsView`/`OperationsTable`,
  `CreateAlertRuleForm`.

### Backend (rodada posterior — o dev fará depois)
- `EventLogReadRepository` (interface + impl Drizzle) lendo a tabela `events`.
- Router `events.list` (query) com filtros (`eventType`, `aggregateType`), ordenação
  (`occurredAt` desc) e paginação (`limit`/`offset`), retornando o formato wire.
- Wiring em `appRouter` + `events.router.ts`.
- Troca da fonte do `useEventHistory` do buffer ao vivo para `trpcClient.events.list.query`.

### Não inclui (explicitamente fora do escopo)
- Testes unitários/integração — não solicitados nesta rodada (planejados abaixo, não escritos).
- Autenticação real — segue o placeholder `x-user-id`/`connectionParams` existente.
- Merge incremental ao vivo + histórico persistido no mesmo grid (live append sobre o
  fetch inicial) — fica para depois do backend existir.

---

## Módulos afetados

| Arquivo | Tipo de mudança | Responsabilidade |
|---------|----------------|-----------------|
| `app/frontend/package.json` | Modificação | Adiciona deps MUI + AG Grid |
| `app/frontend/src/theme/theme.ts` | Criação | Tema MUI compartilhado (dark) |
| `app/frontend/src/main.tsx` | Modificação | `ThemeProvider` + `CssBaseline`, remove `styles.css` |
| `app/frontend/src/App.tsx` | Modificação | Shell MUI (`AppBar`/`Container`/`Grid`) |
| `app/frontend/src/components/EventHistoryTable/EventHistoryTable.tsx` | Criação | Tabela AG Grid do histórico |
| `app/frontend/src/hooks/useEventHistory.ts` | Criação | Fonte de dados do histórico (live agora, `events.list` depois) |
| `app/frontend/src/components/UserSwitcher/UserSwitcher.tsx` | Modificação | MUI `TextField`/`Button`/`Chip` |
| `app/frontend/src/components/AlertPanel/AlertPanel.tsx` | Modificação | MUI `Card`/`List`/`Chip`/`Button` (compound preservado) |
| `app/frontend/src/components/MempoolWidget/MempoolWidget.tsx` | Modificação | MUI `Card`/`Typography` |
| `app/frontend/src/components/EventTimeline/EventTimeline.tsx` | Modificação | MUI `List`/`ListItem` |
| `app/frontend/src/components/OperationsTable/OperationsView.tsx` | Modificação | MUI `Table` (mantém render props) |
| `app/frontend/src/components/OperationsTable/OperationsTable.tsx` | Modificação | Render props sobre MUI `Table` |
| `app/frontend/src/components/CreateAlertRuleForm/CreateAlertRuleForm.tsx` | Modificação | MUI `TextField`/`Select`/`Button`/`Alert` |
| `app/frontend/src/styles.css` | Remoção | Substituído pelo tema MUI |

---

## Interfaces planejadas

### useEventHistory

```typescript
interface EventHistoryResult {
  rows: readonly DomainEventView[];   // mais recentes primeiro
  status: ConnectionStatus;           // reaproveita o status do feed ao vivo
  source: "live" | "persisted";       // "live" agora; "persisted" quando events.list existir
}

function useEventHistory(): EventHistoryResult
```

**Dependências injetadas:**
- `useDomainEvents` — snapshot do `WebSocketFeed` (fonte atual). Trocável por
  `trpcClient.events.list.query` sem mudar `EventHistoryTable`.

### EventHistoryTable

```typescript
// Sem props públicas — consome useEventHistory internamente.
function EventHistoryTable(): JSX.Element
```

---

## Decisões de design

### Decisão 1: AG Grid próprio vs. estender `OperationsTable`

**Contexto:** já existe `OperationsTable` (render props).
**Opções:**
- Estender `OperationsTable` para sort/filtro/paginação: reimplementaria o que AG Grid já faz.
- Componente AG Grid dedicado (`EventHistoryTable`): grid pronto, `OperationsTable` intocado.
**Decisão:** componente dedicado. `OperationsTable` continua sendo o "log ao vivo" simples;
`EventHistoryTable` é a visão rica de histórico. Open/Closed — nova capacidade por adição.

### Decisão 2: hook de dados separado do componente

**Contexto:** o backend `events.list` virá depois; o componente não pode depender da fonte.
**Decisão:** `useEventHistory` isola a origem dos dados. Hoje devolve o buffer ao vivo;
quando `events.list` existir, só o hook muda (Dependency Inversion: o componente depende da
abstração "lista de eventos", não de onde ela vem).

### Decisão 3: tema MUI dark único

**Contexto:** `styles.css` usava `color-scheme: light dark`.
**Decisão:** tema MUI dark explícito + `CssBaseline`, para visual consistente entre AG Grid
(`ag-theme-quartz-dark`) e os componentes MUI.

---

## Testes planejados (NÃO escritos nesta rodada)

### useEventHistory.test.ts

| Caso | Tipo | Descrição |
|------|------|-----------|
| Happy path | Unit | Devolve eventos do feed em ordem mais-recente-primeiro |
| Edge case | Unit | Buffer vazio → `rows` vazio, sem quebrar |
| Edge case | Unit | Referência de `rows` estável quando o snapshot não muda |

### EventHistoryTable.test.tsx

| Caso | Tipo | Descrição |
|------|------|-----------|
| Happy path | Unit | Renderiza uma linha por evento com as colunas esperadas |
| Edge case | Unit | Mostra overlay "no rows" quando vazio |

### (Backend, rodada posterior) EventLogReadRepository.test.ts

| Caso | Tipo | Descrição |
|------|------|-----------|
| Happy path | Unit | Lista eventos por `occurredAt` desc com `limit`/`offset` |
| Filtro | Unit | Filtra por `eventType` quando informado |
| Edge case | Unit | Lista vazia quando não há eventos |

---

## Definition of done (rodada frontend)

- [ ] Deps MUI + AG Grid adicionadas e instaladas
- [ ] `EventHistoryTable` + `useEventHistory` implementados
- [ ] Todos os componentes migrados para MUI; `styles.css` removido
- [ ] SOLID verificado em cada arquivo novo
- [ ] JSDoc/`@module` em todos os arquivos novos e métodos públicos
- [ ] `npm run typecheck:frontend` passa
- [ ] plan.md, implementation.md e review.md criados
