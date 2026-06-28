# PR — frontend-dashboard

**Branch:** `feature/frontend-dashboard` → `feature/trpc-api`

---

## O que foi implementado

- Novo workspace `app/frontend` (Vite + React 18 + TypeScript estrito), sem `@trpc/react-query` — o roadmap pedia explicitamente um external store, não data-fetching gerenciado pelo React.
- `WebSocketFeed` — external store compatível com `useSyncExternalStore`, com buffer circular de eventos (backpressure: descarta o mais antigo ao exceder 500) e tracking de status de conexão.
- Client tRPC (`src/trpc/client.ts`) com `splitLink`: `wsLink` para a subscription `onBitcoinNetworkEvent`, `httpBatchLink` para as mutations `createAlertRule`/`acknowledgeAlert`.
- Os quatro componentes do roadmap:
  - `OperationsTable` (render props) + `OperationsView` (adapta o buffer de eventos)
  - `AlertPanel` (compound component: `Header`/`List`/`Item`, com ação de confirmar alerta)
  - `EventTimeline` (replay cronológico do buffer)
  - `MempoolWidget` (última métrica de fee spike)
- UI mínima para os dois placeholders necessários: `UserSwitcher` (troca o usuário atual) e `CreateAlertRuleForm` (cria regra `FEE_SPIKE` → `TRIGGER_ALERT`).
- `src/domain/events.ts` — vocabulário de eventos próprio do frontend (tipos + constantes), em vez de importar do backend.
- Fix pontual no backend (`trpc/context.ts`): resolve o usuário atual via `connectionParams` em conexões WS, além do header `x-user-id` em HTTP.

## Designs aplicados

- **External Store + Observer** (`WebSocketFeed`) — vive fora do ciclo de vida de componentes React; múltiplos componentes leem o mesmo snapshot sem duplicar a subscription de rede.
- **Render Props** (`OperationsTable`) — a tabela não conhece o formato das linhas; quem a usa decide via `renderRow`.
- **Compound Component** (`AlertPanel`) — `Header`/`List`/`Item` compartilham estado via Context, sem precisar repassar tudo por props.
- **Adapter** (`OperationsView`) — separa o componente genérico (`OperationsTable`) do conhecimento específico de domínio (eventos do `WebSocketFeed`).
- **Boundary de tipos explícito entre frontend e backend** (`domain/events.ts`) — o frontend define seu próprio contrato sobre o JSON que atravessa o WebSocket, em vez de importar os tipos do backend.

## Aprendizados

- Importar **valores** (não apenas tipos) de um workspace de backend para o frontend pode arrastar dependências Node-only para o bundle do navegador — neste caso, `node:crypto` via `DomainEvent`. `import type` é seguro (apagado em build); imports de valor não são.
- JSON não tem tipo `Date` — campos como `occurredAt` chegam como string via WebSocket e precisam de normalização explícita antes de qualquer `.getTime()`/comparação.
- `useSyncExternalStore` exige que `getSnapshot()` retorne uma referência estável quando nada mudou; retornar um objeto novo a cada chamada causa loop infinito de render. Esse bug foi encontrado só na verificação manual (Vite dev server + Chromium headless via Playwright) — `tsc --noEmit` não o detecta, pois é um erro de contrato em runtime, não de tipo.
- Navegadores não permitem headers customizados no handshake de `WebSocket`; autenticação nesse canal precisa de um mecanismo diferente (`connectionParams`, no caso do tRPC).
- Quando não há `chromium-cli` disponível no ambiente, `playwright-core` (instalado num diretório temporário) cobre a mesma necessidade de driver headless para verificação manual.

## Melhorias

- Adicionar queries de leitura no backend (`alerts.list`, `operations.list`) — hoje os componentes só mostram o que chegou ao vivo desde que a página carregou; recarregar zera o buffer.
- `CreateAlertRuleForm` cobre só `FEE_SPIKE` → `TRIGGER_ALERT`; generalizar para qualquer condição × ação se o uso real exigir.
- Substituir o placeholder de autenticação (`UserSwitcher` + `x-user-id`/`connectionParams`) por um sistema de auth real.
- Reconexão ao trocar de usuário hoje fecha e reabre a conexão WS inteira (`wsClient.close()` + resubscribe), pois a API do `@trpc/client` v11 não expõe um "reconectar com novos params" — vale revisitar se a troca de usuário se tornar frequente.
- Escrever os testes planejados em `docs/features/frontend-dashboard/plan.md` (não solicitados nesta rodada).
