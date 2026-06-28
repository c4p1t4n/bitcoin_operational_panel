# frontend-dashboard — Revisão

**Branch:** `feature/frontend-dashboard`
**Data:** 2026-06-28
**Status:** Pronto para PR

---

## Resumo

Cria o frontend React+Vite do painel: um external store (`WebSocketFeed`, compatível com
`useSyncExternalStore`) que mantém o stream `onBitcoinNetworkEvent` via tRPC, e os quatro
componentes pedidos no roadmap (`OperationsTable`, `AlertPanel`, `EventTimeline`,
`MempoolWidget`), mais UI mínima para os dois placeholders necessários (usuário atual,
criação de regra). Verificado manualmente com o Vite dev server e Chromium headless — um
bug real de loop infinito foi encontrado e corrigido no processo (ver implementation.md).

---

## Checklist SOLID

| Arquivo | S | O | L | I | D | Observações |
|---------|---|---|---|---|---|-------------|
| `WebSocketFeed.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `domain/events.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `trpc/client.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `OperationsTable.tsx` | ✅ | ✅ | ✅ | ✅ | ✅ | genérico — `OperationsView` é quem conhece o domínio |
| `AlertPanel.tsx` | ✅ | ✅ | ✅ | ✅ | ✅ | compound — `Header`/`List`/`Item` poderiam ser arquivos próprios se crescerem |
| `EventTimeline.tsx`, `MempoolWidget.tsx` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `context.ts` (backend, modificado) | ✅ | ✅ | ✅ | ✅ | ✅ | fallback aditivo, não quebra o caminho HTTP existente |

---

## Checklist de documentação

- [x] `@module` em todos os arquivos
- [x] JSDoc em todos os métodos públicos
- [x] Decisões de design registradas em `plan.md`

## Checklist de testes

- [ ] Não solicitados nesta rodada (ver plan.md)

---

## Trade-offs conhecidos

- **Sem histórico persistido:** os 4 componentes só mostram o que chegou via WebSocket
  desde que a página carregou — recarregar zera o buffer. Não há query procedure no
  backend para isso ainda (ver plan.md, Escopo).
- **Auth placeholder duplicado (frontend + backend):** `UserSwitcher` grava um id de
  usuário em `localStorage` sem validação — qualquer string é aceita pelo client; a
  validação real acontece no backend (`context.ts` rejeita se o id não existir/estiver
  inativo em `users`).
- **`CreateAlertRuleForm` só cobre `FEE_SPIKE` → `TRIGGER_ALERT`:** a API aceita
  `TRANSACTION_SIZE`/`PEER_COUNT` e `UPDATE_PEER_STATUS`, mas não há UI para essas
  combinações — escopo reduzido deliberadamente a um caminho ponta-a-ponta funcional.
- **Reconexão ao trocar de usuário fecha e reabre a conexão WS inteira** (`wsClient.close()`
  + resubscribe) em vez de um método de "reconectar com novos params" — a API do
  `@trpc/client` v11 não expõe isso publicamente; é o caminho suportado mais simples.

## Fora do escopo

- Dados históricos (queries de leitura no backend).
- `PresenceAvatars` — sem evento de domínio de presença de usuário para alimentar.
- Autenticação real, testes, estilização elaborada.

## Próximos passos sugeridos

1. Adicionar queries de leitura no backend (`alerts.list`, `operations.list`) para que
   `OperationsTable`/`EventTimeline` sobrevivam a um reload de página.
2. Formulário de regra mais genérico (qualquer condição × qualquer ação) se a UI atual
   se mostrar curta demais para uso real.
3. Decidir e implementar autenticação real, substituindo `UserSwitcher`/`x-user-id`/`connectionParams`.
4. Considerar abrir o PR de `feature/trpc-api` antes ou junto com este, já que esta branch
   depende dele (decisão tomada com o dev no início desta sessão).
