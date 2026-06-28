# frontend-dashboard — Plano

**Branch:** `feature/frontend-dashboard` (a partir de `feature/trpc-api`, ainda não mergeada em `main` — decisão tomada com o dev)
**Data:** 2026-06-27
**Status:** Planejamento

---

## O que faz

Cria o frontend React+Vite do painel: um external store (`WebSocketFeed`) que mantém o
stream de `DomainEvent` recebido via tRPC subscription (`onBitcoinNetworkEvent`), e quatro
componentes que o consomem via `useSyncExternalStore` — `OperationsTable`, `AlertPanel`,
`EventTimeline`, `MempoolWidget` — mais o fluxo de `createAlertRule`/`acknowledgeAlert`.

## Por que

Phase 5a deixou a API tRPC pronta mas sem nenhum cliente. Sem frontend, não há forma de
visualizar os eventos de domínio em tempo real nem de criar/confirmar alertas fora de
`curl`/testes manuais.

## Escopo

### Inclui
- Scaffold Vite + React + TypeScript em `app/frontend/` (novo workspace npm).
- `src/trpc/client.ts` — client tRPC vanilla (`@trpc/client`, **não** `@trpc/react-query** —
  o doc de arquitetura pede explicitamente "external store, not React state").
- `src/store/WebSocketFeed.ts` — external store (Observer/EventEmitter manual, sem libs
  novas), buffer circular de eventos, integrado a `useSyncExternalStore`.
- `src/hooks/useDomainEvents.ts` — hook fino sobre `useSyncExternalStore` + `WebSocketFeed`.
- Componentes: `OperationsTable` (render props), `AlertPanel` (compound component),
  `EventTimeline` (replay do log recebido), `MempoolWidget` (métrica ao vivo).
- Placeholder de "usuário atual" no frontend (input simples + `localStorage`), análogo ao
  placeholder `x-user-id` já existente no backend.
- Fix pontual no backend (`trpc/context.ts`): autenticação via `connectionParams` para WS,
  já que navegadores não permitem headers customizados no handshake de WebSocket — sem
  isso, a subscription nunca teria `currentUser` no contexto.

### Não inclui (explicitamente fora do escopo)
- **Dados históricos via query tRPC** — não existe nenhum procedure de leitura
  (`alerts.list`, `operations.list`, etc.) na API atual; `alerts.router.ts` só tem
  `createAlertRule`/`acknowledgeAlert` (mutations) e `onBitcoinNetworkEvent` (subscription).
  Os 4 componentes ficam, portanto, alimentados **apenas** pelo stream ao vivo recebido
  desde que a página foi carregada — sem histórico persistido. Recarregar a página zera o
  buffer. Documentado como limitação conhecida (ver Trade-offs em `review.md`); adicionar
  queries de leitura é um próximo passo natural, não desta feature.
- `PresenceAvatars` (mencionado em `docs/index.md`) — não existe nenhum evento de domínio
  de presença de usuário (só `PeerConnected`/`PeerDisconnected`, que são peers do node
  Bitcoin, não usuários do painel). Sem dado de backend, não há o que renderizar — fora de
  escopo até existir um evento de presença real.
- Autenticação real — mantém o mesmo placeholder do backend (`x-user-id`/`connectionParams`).
- Testes — não solicitados nesta rodada (mesma decisão das fases anteriores).
- Estilização elaborada/design system — CSS mínimo, foco em estrutura e comportamento.

---

## Módulos afetados

| Arquivo | Tipo de mudança | Responsabilidade |
|---------|----------------|-------------------|
| `app/frontend/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html` | Criação | Scaffold do projeto |
| `app/frontend/src/main.tsx`, `App.tsx` | Criação | Bootstrap React, layout, seletor de usuário |
| `app/frontend/src/trpc/client.ts` | Criação | Client tRPC (`splitLink`: `wsLink` para subscriptions, `httpBatchLink` para mutations) |
| `app/frontend/src/store/WebSocketFeed.ts` | Criação | External store — buffer de `DomainEvent`, status de conexão |
| `app/frontend/src/hooks/useDomainEvents.ts` | Criação | `useSyncExternalStore` sobre o `WebSocketFeed` |
| `app/frontend/src/components/OperationsTable/` | Criação | Tabela genérica, render props |
| `app/frontend/src/components/AlertPanel/` | Criação | Compound component — lista de alertas + ação de confirmar |
| `app/frontend/src/components/EventTimeline/` | Criação | Lista cronológica de todos os eventos recebidos |
| `app/frontend/src/components/MempoolWidget/` | Criação | Card com o último `MemPoolFeeSpike` recebido |
| `app/backend/src/trpc/context.ts` | Modificação | Resolve usuário via `connectionParams` (WS) além de header (HTTP) |
| `package.json` (raiz) | Modificação | Adiciona `app/frontend` aos workspaces, script `dev:frontend` |

---

## Interfaces planejadas

### `WebSocketFeed`

```typescript
export interface WebSocketFeedSnapshot {
  events: readonly DomainEvent[]; // buffer circular, mais recente no fim
  status: "connecting" | "open" | "closed";
}

export class WebSocketFeed {
  subscribe(listener: () => void): () => void; // contrato useSyncExternalStore
  getSnapshot(): WebSocketFeedSnapshot;
  connect(getUserId: () => string | null): void;
  disconnect(): void;
}
```

**Dependências injetadas:** `trpcClient` (do `src/trpc/client.ts`), `maxBufferSize` (default 500).

### `useDomainEvents`

```typescript
function useDomainEvents(): WebSocketFeedSnapshot;
```

### `OperationsTable` (render props)

```typescript
interface OperationsTableProps<T> {
  rows: T[];
  renderRow: (row: T, index: number) => React.ReactNode;
  columns: string[];
}
function OperationsTable<T>(props: OperationsTableProps<T>): JSX.Element;
```

### `AlertPanel` (compound component)

```typescript
const AlertPanel: {
  (props: { children: React.ReactNode }): JSX.Element; // Root — provê contexto
  Header: (props: { children: React.ReactNode }) => JSX.Element;
  List: (props: { children: React.ReactNode }) => JSX.Element;
  Item: (props: { alert: AlertTriggeredPayload & { eventId: string } }) => JSX.Element;
};
```

Contexto interno expõe `acknowledge(alertId: string, note?: string)`, que chama a mutation
`trpcClient.alerts.acknowledgeAlert`.

---

## Decisões de design

### Decisão 1: client tRPC vanilla, não `@trpc/react-query`

**Contexto:** `docs/index.md`/`docs/next_steps.md` pedem explicitamente "external store
(not React state)" com `useSyncExternalStore` + padrão EventEmitter.
**Opções consideradas:**
- A) `@trpc/react-query` — hooks `useSubscription`/`useMutation`, idiomático React, mas é
  exatamente "React state" gerenciado por React Query — contradiz o requisito explícito.
- B) Client vanilla (`@trpc/client`) + `WebSocketFeed` próprio.
**Decisão:** B. O store vive fora do ciclo de vida de componentes React, sobrevive a
remounts, e é a peça que o roadmap pede nomeadamente.

### Decisão 2: autenticação WS via `connectionParams`, não headers

**Contexto:** o placeholder de auth do backend (`x-user-id` header) funciona para HTTP,
mas a API `WebSocket` do navegador não permite headers customizados no handshake.
**Decisão:** `createWSClient({ connectionParams: () => ({ userId }) })` no frontend;
`context.ts` no backend passa a ler `info.connectionParams.userId` para WS, com fallback
para o header em HTTP. Mudança mínima, aditiva, mesma postura de placeholder.

### Decisão 3: buffer circular em memória, sem persistência

**Contexto:** sem query procedures no backend (ver Escopo), o frontend não tem de onde
buscar histórico.
**Decisão:** `WebSocketFeed` mantém só os últimos N eventos (default 500) recebidos desde
que a página carregou. Aceito como limitação conhecida do MVP; documentado em `review.md`.

---

## Testes planejados

*Não solicitados nesta rodada.*

| Caso | Tipo | Descrição |
|------|------|-----------|
| Happy path | Unit | `WebSocketFeed` adiciona evento ao buffer e notifica listeners |
| Edge case | Unit | Buffer descarta o mais antigo ao exceder `maxBufferSize` |
| Edge case | Unit | `AlertPanel.Item` desabilita o botão de confirmar enquanto a mutation está em voo |
| Erro esperado | Unit | `WebSocketFeed` marca `status: "closed"` e não lança ao perder conexão |
| Integração | Integration | `createAlertRule` end-to-end contra um backend local real |

---

## Definition of done

- [ ] Todos os módulos implementados
- [ ] SOLID verificado em cada arquivo
- [ ] JSDoc em todos os métodos públicos
- [ ] Testes unitários não escritos (decisão explícita)
- [ ] `npm run typecheck` passa (backend e frontend)
- [ ] `npm run dev:frontend` sobe o Vite dev server sem erros
- [ ] plan.md, implementation.md e review.md criados
- [ ] `docs/index.md` e `docs/next_steps.md` atualizados
- [ ] PR description gerada
