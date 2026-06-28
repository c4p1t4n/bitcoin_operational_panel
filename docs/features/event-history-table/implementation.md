# event-history-table — Implementação

**Branch:** `feature/event-history-table`
**Data:** 2026-06-28
**Status:** Implementado (rodada frontend; backend pendente)

---

## Arquivos criados

### `app/frontend/src/theme/theme.ts`

**Responsabilidade:** tema MUI dark compartilhado (paleta, tipografia, densidade).
**Pattern aplicado:** Provider/Theme (design tokens centralizados) — substitui o CSS solto.
**Dependências injetadas:** nenhuma.

### `app/frontend/src/hooks/useEventHistory.ts`

**Responsabilidade:** devolver os eventos para a tabela (mais recente primeiro) + status +
origem (`live`/`persisted`).
**Pattern aplicado:** Adapter / Dependency Inversion — isola a origem dos dados do componente.
**Dependências injetadas:** `useDomainEvents` (snapshot do `WebSocketFeed`).

```typescript
interface EventHistoryResult {
  rows: readonly DomainEventView[];
  status: ConnectionStatus;
  source: "live" | "persisted";
}
function useEventHistory(): EventHistoryResult
```

### `app/frontend/src/components/EventHistoryTable/EventHistoryTable.tsx`

**Responsabilidade:** mapear `DomainEventView` → colunas AG Grid e renderizar o grid
(sort/filter/paginação) dentro de um `Card` MUI.
**Pattern aplicado:** Adapter sobre AG Grid + DI na fonte de dados (`useEventHistory`).
**Dependências injetadas:** `useEventHistory`.

---

## Arquivos modificados

### `app/frontend/package.json`
**O que mudou:** adicionadas deps `@mui/material`, `@mui/icons-material`, `@emotion/react`,
`@emotion/styled`, `ag-grid-react`, `ag-grid-community`.
**Por que:** UI MUI + tabela AG Grid.

### `app/frontend/src/main.tsx`
**O que mudou:** envolve `App` em `ThemeProvider` + `CssBaseline`; importa os CSS do AG Grid
(`ag-grid.css` + `ag-theme-quartz.css`); remove `import "./styles.css"`.

### `app/frontend/src/App.tsx`
**O que mudou:** shell migrado para `AppBar`/`Toolbar`/`Container`/`Grid2`; status vira `Chip`;
adicionado `EventHistoryTable` em linha de largura total.

### Componentes migrados para MUI (comportamento inalterado)
- `UserSwitcher` → `TextField`/`Button`/`Tooltip`
- `MempoolWidget` → `Card`/`Typography`
- `EventTimeline` → `List`/`ListItem`/`Chip`
- `OperationsTable` → `Table` MUI (render props preservado; `renderRow` devolve `TableCell`)
- `OperationsView` → usa `TableCell` no `renderRow`
- `AlertPanel` → `Card`/`List`/`Chip`/`Button` (Compound Component preservado:
  `Header`/`List`/`Item` continuam via Context)
- `CreateAlertRuleForm` → `TextField`/`Select`(MenuItem)/`Button`/`Alert`

### `app/frontend/src/styles.css`
**O que mudou:** removido — substituído pelo tema MUI + CSS do AG Grid.

---

## Wiring — como conectado ao sistema

```tsx
// main.tsx — provider do tema
<ThemeProvider theme={appTheme}>
  <CssBaseline />
  <App />
</ThemeProvider>

// App.tsx — a nova tabela entra no grid
<Grid size={12}>
  <EventHistoryTable />
</Grid>
```

`EventHistoryTable` consome `useEventHistory()`, que hoje lê o buffer ao vivo do
`WebSocketFeed`. Nenhuma mudança de backend foi necessária nesta rodada.

---

## Pendente (rodada backend — a fazer pelo dev)

1. `EventLogReadRepository` (interface + impl Drizzle) lendo `events` (ver `app/infra/schema.ts`,
   índice `idx_events_type_occurred`).
2. `events.router.ts` com `events.list` (input: `eventType?`, `aggregateType?`, `limit`, `offset`)
   → retorna formato wire (`occurredAt` como ISO string).
3. Registrar em `app/backend/src/trpc/routers/index.ts` (`events: eventsRouter`).
4. Trocar a implementação de `useEventHistory` de buffer ao vivo para
   `trpcClient.events.list.query(...)` e marcar `source: "persisted"`.

---

## Desvios do plano

- **Branch off `main`** (exigido pela skill) não foi possível: `app/frontend` só existe em
  `feature/frontend-dashboard`. Branch criada a partir de `feature/frontend-dashboard`.
- **Backend adiado** a pedido do dev — `useEventHistory` foi desenhado para a troca posterior
  sem tocar no componente.
- Testes não escritos (não solicitados) — planejados em `plan.md`.
