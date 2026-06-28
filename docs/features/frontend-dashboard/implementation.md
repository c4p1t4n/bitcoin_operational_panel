# frontend-dashboard — Implementação

**Branch:** `feature/frontend-dashboard` (a partir de `feature/trpc-api`)
**Data:** 2026-06-28
**Status:** Implementado

---

## Arquivos criados

### Scaffold (`app/frontend/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `vite-env.d.ts`)

Vite + React 18 + TypeScript estrito, sem `@trpc/react-query` (ver Decisão 1 do plan.md).
Workspace adicionado a `package.json` (raiz).

### `src/auth/currentUser.ts`

**Responsabilidade:** placeholder de "usuário atual" — `localStorage` + notificação de
mudança (`onCurrentUserIdChange`), espelhando o placeholder `x-user-id`/`connectionParams`
do backend.

### `src/domain/events.ts`

**Responsabilidade:** vocabulário de eventos do lado do frontend — `DomainEventWire`
(formato JSON serializado, `occurredAt: string`), `DomainEventView` (normalizado,
`occurredAt: Date`), `normalizeDomainEvent`, e as constantes de `eventType` usadas para
filtrar (`ALERT_TRIGGERED`, `MEMPOOL_FEE_SPIKE`, etc.).
**Por que não importar do backend:** ver Desvios do plano.

### `src/trpc/client.ts`

**Responsabilidade:** `createWSClient` (com `connectionParams`) + `createTRPCClient`
(`splitLink`: subscriptions → `wsLink`, mutations → `httpBatchLink` com header `x-user-id`).

### `src/store/WebSocketFeed.ts`

**Responsabilidade:** external store — buffer circular de `DomainEventView` (máx. 500,
descarta o mais antigo), status de conexão (via `wsClient.connectionState`), reconexão ao
trocar de usuário. Implementa o contrato `useSyncExternalStore` (`subscribe`/`getSnapshot`).
**Pattern aplicado:** Observer + External Store.

### `src/hooks/useDomainEvents.ts`

**Responsabilidade:** `useSyncExternalStore(webSocketFeed.subscribe, webSocketFeed.getSnapshot)`.

### `src/components/OperationsTable/{OperationsTable,OperationsView}.tsx`

**Responsabilidade:** `OperationsTable` é genérica (render props: `renderRow`, `columns`,
`getRowKey`); `OperationsView` a especializa para a lista de `DomainEventView` do
`WebSocketFeed`.
**Pattern aplicado:** Render Props.

### `src/components/AlertPanel/AlertPanel.tsx`

**Responsabilidade:** reconstrói a lista de alertas (`ALERT_TRIGGERED` cria, `ALERT_ACKNOWLEDGED`
com mesmo `aggregateId` marca confirmado) a partir do buffer; `AlertPanel.Header/List/Item`
compartilham estado via Context; `Item` chama `acknowledgeAlert` mutation.
**Pattern aplicado:** Compound Component.

### `src/components/EventTimeline/EventTimeline.tsx`

**Responsabilidade:** lista cronológica (mais recente primeiro) de todo o buffer.

### `src/components/MempoolWidget/MempoolWidget.tsx`

**Responsabilidade:** último `MEMPOOL_FEE_SPIKE` do buffer, ou estado vazio.

### `src/components/UserSwitcher/UserSwitcher.tsx`, `src/components/CreateAlertRuleForm/CreateAlertRuleForm.tsx`

**Responsabilidade:** UI mínima para os dois placeholders que faltavam — trocar o usuário
atual, e criar uma regra `FEE_SPIKE` → `TRIGGER_ALERT` (único par condição/ação com UI;
outras combinações existem na API mas não têm formulário nesta versão).

### `src/App.tsx`, `src/main.tsx`, `src/styles.css`

**Responsabilidade:** monta a árvore (`MempoolWidget`, `AlertPanel`, `CreateAlertRuleForm`,
`OperationsView`, `EventTimeline`), chama `webSocketFeed.connect()` uma vez no boot.

---

## Arquivos modificados

### `app/backend/src/trpc/context.ts`

**O que mudou:** `resolveUserId` agora lê `info.connectionParams.userId` (WS) com fallback
para o header `x-user-id` (HTTP), em vez de só header.
**Por que:** navegadores não permitem headers customizados no handshake de `WebSocket` —
sem isso, toda conexão WS chegaria ao backend sem usuário, e a subscription nunca
autenticaria (ela é pública hoje, então não quebrou nada visivelmente, mas as mutations via
WS — se algum dia existirem — falhariam silenciosamente; e a simetria HTTP/WS do
placeholder de auth ficaria quebrada).

### `package.json` (raiz)

**O que mudou:** adiciona `app/frontend` aos workspaces, scripts `dev:frontend`/`typecheck:frontend`.

---

## Wiring — como conectar ao sistema

```bash
npm run dev:trpc      # backend, a partir da raiz
npm run dev:frontend  # frontend (Vite, porta 5173), a partir da raiz
```

```typescript
// src/main.tsx
webSocketFeed.connect(); // abre a subscription uma única vez
createRoot(root).render(<App />);
```

---

## Testes escritos

Nenhum — decisão explícita (ver `plan.md`).

---

## Desvios do plano

- **`src/domain/events.ts` duplica tipos/constantes do backend em vez de importar** —
  não estava explícito no `plan.md`, mas se mostrou necessário ao implementar: os módulos
  de `app/backend/src/domain/events/*` importam `node:crypto` via `DomainEvent` (classe
  base). Um import de *valor* (não apenas de tipo) desses módulos arrastaria esse código
  para o bundle do Vite e quebraria no navegador. A solução foi definir o contrato do lado
  do frontend (o JSON que realmente atravessa o WebSocket), só usando `import type` para
  o `AppRouter` (erased em build, seguro).
- **Bug real encontrado e corrigido durante a verificação manual:** `WebSocketFeed.getSnapshot()`
  originalmente retornava um objeto novo a cada chamada — violava o contrato de
  `useSyncExternalStore` (que chama `getSnapshot` em todo render para detectar mudança) e
  causava loop infinito de render (confirmado via Playwright headless: "Maximum update depth
  exceeded"). Corrigido cacheando o snapshot e só recriando-o em `notify()`.
- Verificação manual feita com Vite dev server + Chromium headless (Playwright) em vez de
  apenas typecheck — pego o bug acima, que o `tsc --noEmit` não detectaria.
