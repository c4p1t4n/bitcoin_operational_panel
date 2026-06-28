# trpc-api — Revisão

**Branch:** `feature/trpc-api`
**Data:** 2026-06-27
**Status:** Pronto para PR

---

## Resumo

Liga toda a camada de domínio das Phases 2-4 a um processo executável: `bootstrap.ts`
instancia EventStore/CommandBus/RuleEngine e carrega regras ativas de `rule_definitions`
no boot; `alerts.router.ts` expõe `createAlertRule`/`acknowledgeAlert` (mutations) e
`onBitcoinNetworkEvent` (subscription) via tRPC sobre HTTP+WS. No caminho, corrigiu um
gap real: `CreateAlertRuleHandler` era um stub que nunca persistia nada — agora gera
`AlertRuleCreated`, projetado para `rule_definitions` por um subscriber dedicado.

---

## Checklist SOLID

| Arquivo | S | O | L | I | D | Observações |
|---------|---|---|---|---|---|-------------|
| `AlertRuleCreated.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `CreateAlertRuleHandler.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | continua puro — não persiste, só gera evento |
| `RuleDefinitionRepository.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | interface separada da implementação Drizzle |
| `RuleDefinitionProjector.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `RuleDefinitionCompiler.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | novo `action.kind` = nova branch, sem tocar nas existentes |
| `bootstrap.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | único lugar que faz `new` dos concretos (composition root) |
| `context.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `middleware/auth.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `middleware/audit.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | assume convenção "mutation retorna `DomainEvent[]`" — ver Trade-offs |
| `middleware/rateLimit.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | estado em memória — ver Trade-offs |
| `alerts.router.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `server.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `CommandBus.ts` (modificado) | ✅ | ✅ | ✅ | ✅ | ✅ | `actingUser` opcional, retrocompatível |

---

## Checklist de documentação

- [x] `@module` em todos os arquivos
- [x] JSDoc em todos os métodos públicos
- [x] `@throws` documentado onde aplicável
- [x] Decisões de design registradas em `plan.md`

---

## Checklist de testes

- [ ] Happy path — não solicitado nesta rodada (ver plan.md)
- [ ] Edge cases — idem
- [ ] Erros esperados — idem
- [ ] Mocks isolam I/O externo — idem
- [ ] Nomes descrevem comportamento — idem

---

## Trade-offs conhecidos

- **EventBus em memória, não Redis:** `onBitcoinNetworkEvent` só recebe eventos publicados
  na mesma instância de processo. Múltiplas instâncias do backend não compartilham
  subscriptions. Documentado desde a Phase 4 (PeerCountMatcher) e mantido aqui — migrar é
  um esforço maior, fora do escopo desta feature.
- **Rate limit em memória:** mesma limitação — por instância, não distribuído.
- **Auth placeholder (`x-user-id` header):** qualquer requisição que conheça um id de
  usuário válido se autentica como ele, sem senha/sessão. Aceitável enquanto não há
  sistema de auth real (mesma postura do `PermissionSpec` desde a Phase 2).
- **`audit.ts` assume que toda mutation auditada retorna `DomainEvent[]`:** é uma convenção
  implícita entre o router e o middleware, não imposta pelo tipo do tRPC. Se um futuro
  router retornar outra coisa, o audit simplesmente não loga (não falha, mas loga silenciosamente
  nada) — fica safe por padrão, mas não auto-evidente.
- **`RuleEngine` agora se inscreve em `ALERT_RULE_CREATED`** (consequência de reusar
  `ALL_DOMAIN_EVENT_TYPES`): inofensivo hoje (nenhuma regra tem condição desse tipo), mas
  se alguém um dia registrar um `ConditionMatcher` para esse tipo sem querer, regras podem
  reagir à própria criação de outras regras. Vale revisitar se isso causar confusão.

## Fora do escopo

- Frontend (store, componentes React) — feature separada, decidida com o dev no início desta sessão.
- Migração do EventBus para Redis.
- Migração do `PeerCountMatcher` para estado distribuído (Redis) — TODO da Phase 4, ainda aberto.
- Testes unitários/integração — não solicitados.
- Sistema de autenticação real (sessão/JWT) substituindo o header `x-user-id`.

## Próximos passos sugeridos

1. Frontend: `WebSocketFeed.ts` consumindo `onBitcoinNetworkEvent` via `@trpc/client`'s
   `wsLink`, mais os componentes (`OperationsTable`, `AlertPanel`, `EventTimeline`, `MempoolWidget`).
2. Decidir e implementar autenticação real — o header placeholder deve ser substituído
   antes de qualquer exposição fora de localhost.
3. Avaliar migração do EventBus para Redis se/quando o backend precisar rodar em múltiplas
   instâncias (necessário para rate limit e subscriptions distribuídos consistentes).
4. Corrigir o teste pré-existente e já quebrado em `CommandBus.test.ts` ("calls handler and
   persists events" — duplicate handler registration); falha não relacionada a esta feature,
   confirmada via `git stash` antes de qualquer mudança desta branch.
