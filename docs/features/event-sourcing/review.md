# event-sourcing — Revisão

**Branch:** `feature/event-sourcing`
**Data:** 2026-06-27
**Status:** Pronto para PR

---

## Resumo

Implementação completa da infraestrutura central de event sourcing (EventStore, CommandBus, EventBus)
necessária para toda mudança de estado no sistema. Estabelece fluxo de escrita robusto:
Command → CommandBus (permissões) → Handler → EventStore.append (locking) → EventBus.publish (fan-out).

Todos os módulos SOLID-verificados, testados com mocks, TypeScript strict mode.
Pronto para Phase 4 (RuleEngine) que assina EventBus e produz comandos automaticamente.

---

## Checklist SOLID

### Single Responsibility

- ✅ EventStore: apenas persistência com locking, não valida dados
- ✅ CommandBus: apenas dispatch e permissões, não persiste
- ✅ EventBus: apenas pub/sub, não filtra ou transforma eventos
- ✅ Handlers: cada um produz eventos de um tipo específico de comando

**Violação evitada:** EventStore não tenta validar payload (CommandBus/handlers fazem)

---

### Open/Closed

- ✅ Novo CommandHandler entra sem modificar CommandBus
  - Basta: `commandBus.register(new MyHandler())`
  - EventStore, CommandBus, EventBus não mudam

- ✅ Novo EventBus subscriber entra sem modificar EventBus
  - Basta: `eventBus.subscribe(eventType, handler)`
  - EventBus não conhece RuleEngine, frontend subscriptions, audit trail

- ✅ Novo PermissionSpec acesso entra sem modificar CommandBus
  - Basta: adicionar rule em PermissionSpec (Phase 5)
  - CommandBus reutiliza PermissionSpec.canX()

**Violação evitada:** não há if/switch por comando ou event type em EventBus

---

### Liskov Substitution

- ✅ Todos CommandHandler implementam `handle(command): Promise<DomainEvent[]>`
  - MockHandler retorna [] ou eventos — ambos válidos
  - Teste substitui real handler, behavior é igual

- ✅ Todos EventBusSubscriber têm assinatura `(event: DomainEvent) => Promise<void>`
  - MockSubscriber ou RuleEngine — interface é contrato

- ✅ EventStore.append/getEventsFor podem ser mockados, teste não quebra

**Violação evitada:** handlers não retornam "undefined" em lugar de Promise

---

### Interface Segregation

- ✅ EventStore expõe apenas `append`, `getEventsFor` (2 métodos)
  - Caller não precisa de `delete`, `update`, `dump`
  - CommandBus só usa `append`, não conhece internals

- ✅ CommandBus.dispatch não expõe `register` publicamente
  - tRPC routers precisam apenas de `dispatch`
  - Bootstrap chama `register` (não é interface pública)

- ✅ EventBus.subscribe retorna unsubscribe (minimal)
  - Caller não precisa de `getSubscribers()`, `clear()`

**Violação evitada:** interfaces grandes que expõem "tudo" (ex: ICommandBusWithEverything)

---

### Dependency Inversion

- ✅ EventStore depende de `IEventBus`, não de RedisEventBus concreto
  - Teste injeta MockEventBus
  - Phase 5 injeta RedisEventBus — EventStore não muda

- ✅ CommandBus depende de `IEventStore`, `IEventBus`, `getCurrentUser` função
  - Não faz `new EventStore()` internamente
  - tRPC context injeta `getCurrentUser` de auth provider

- ✅ Handlers dependem de abstrações (Command, DomainEvent), não de concretos
  - `CreateAlertRuleHandler(command: CreateAlertRule)` recebe tipo concreto
  - Handler produz tipos concretos (AlertTriggered)
  - Mas não depende de EventStore, db, Redis — apenas input/output

**Violação evitada:** não há `new PostgresClient()` dentro de EventStore

---

## Checklist de Documentação

- ✅ `@module` em todos os arquivos — padrão, responsabilidade, dependências
- ✅ JSDoc em todos os métodos públicos — `@param`, `@returns`, `@throws`
- ✅ `@throws` documentado — OptimisticConcurrencyError, CommandNotFoundError, PermissionError
- ✅ Interfaces documentadas — assinatura e semântica
- ✅ Decisões de design em plan.md — por que Redis vs. in-memória, síncrono vs. assíncrono
- ✅ Nomes descritivos — EventBusSubscriber vs. Func, OptimisticConcurrencyError vs. Error

---

## Checklist de Testes

- ✅ Happy path: command → persist → publish
- ✅ Edge cases: vazio eventos, múltiplos eventos, múltiplos handlers
- ✅ Erros esperados: OptimisticConcurrencyError, CommandNotFoundError, PermissionError
- ✅ Mocks isolam: db, EventBus, getCurrentUser (sem I/O real)
- ✅ Nomes descrevem comportamento: "publishes event to multiple subscribers", não "test_pub_1"
- ✅ Teste de erro isolação: um subscriber falha, outro é chamado

---

## Trade-offs Conhecidos

### EventBus é em-memória, não Redis

**Trade-off:** simpleza MVP vs. distribuição multiinstância

**Escolha:** em-memória para Phase 3

**Mitigação:** interface `IEventBus`, Phase 5 substitui com RedisEventBus sem mudança em EventStore

---

### Handlers retornam [] (vazio) em MVP

**Trade-off:** implementação mínima vs. comportamento end-to-end

**Escolha:** MVP testa infraestrutura (persist, dispatch, pub/sub), não lógica

**Mitigação:** Phase 4 (RuleEngine) testa lógica; handlers preenchem aqui

---

### Validação de payload via try/catch, não Zod

**Trade-off:** simplicidade vs. mensagens de erro claras

**Escolha:** try/catch para MVP, handlers são código nosso (confiável)

**Mitigação:** Phase 4 RuleEngine pode adicionar Zod se precisar validar regras compiladas

---

### CommandBus dispatch é síncrono (await EventStore.append)

**Trade-off:** latência vs. garantias de sucesso/falha ao caller

**Escolha:** síncrono, caller conhece immediately se falhou (pode retry)

**Mitigação:** tRPC/HTTP pode timeout se append for lento; cache/índices mitiga (Phase 5+)

---

## Fora do Escopo

### Redis pub/sub para distribuição
- **Por quê:** MVP rodaria single-instance, EventBus em-memória suficiente
- **Phase 5:** integra Redis quando tRPC subscriptions precisam de múltiplas instâncias

### Validação de payload com Zod
- **Por quê:** handlers são código nosso, confiáveis; Zod fica para entrada externa (RuleEngine compila)
- **Phase 4:** RuleEngine pode adicionar schema validation

### Compensating transactions / Sagas
- **Por quê:** Phase 3 é single-aggregate commands; não há transações cross-aggregate
- **Phase 5+:** se precisa de multi-aggregate, adiciona coordenação

### Persistent queues / Dead-letter handling
- **Por quê:** EventBus.publish é fire-and-forget, suficiente para MVP
- **Phase 5:** adiciona retry se subscribers falharem

### Event versioning / migration
- **Por quê:** payload é JSONB, handlers são defensivos; mudança de schema vira novo command/event type
- **Phase 4+:** se schema mudar muito, criar migração handler

---

## Próximos Passos Sugeridos

### Phase 4: RuleEngine
1. Implementar `RuleEngine.ts` que assina EventBus
2. Implementar `AlertRuleBuilder` fluent API
3. Handlers geram eventos reais (AlertTriggered, etc.) baseado em condições
4. RuleEngine.evaluate(event) chama CommandBus.dispatch() se condição met
5. Adicionar strategy handlers para cada tipo de condição (fee, tx size, RBF, peer count)
6. Testes: rule evaluation, múltiplas regras, error isolation

### Phase 5: Backend API
1. Wiring de tRPC context com CommandBus.dispatch
2. Implementar alerts.router.ts com mutations + subscriptions
3. Integrar Redis pub/sub em EventBus para frontend subscriptions
4. Adicionar middleware (auth, audit, rate-limit) ao tRPC

### Post-MVP
1. Add Zod validation para RuleEngine compiled rules
2. Add persistent queue (Bull/pg-boss) se need retry
3. Add event versioning handler se schema mudar
4. Add Redis Streams ou Kafka se precisar retention/rewind

---

## Descrição do PR

```markdown
## O que faz

Implementa infraestrutura central de event sourcing: EventStore (append-only log com
optimistic locking), CommandBus (dispatch com validação de permissões), EventBus (pub/sub).

## Por que

Phase 2 criou o vocabulário (DomainEvent, Command, PermissionSpec) e storage (events table).
Phase 3 constrói os orquestradores. Sem isso, não há nada que receba Commands e produza
DomainEvents persistidos.

## Como

- EventStore: append com UNIQUE(aggregate_id, version) constraint, publishes to EventBus
- CommandBus: dispatch com PermissionSpec check, handler registry (DI), error propagation
- EventBus: in-memory pub/sub (MVP; Phase 5 adds Redis)
- Three handlers: CreateAlertRule, AcknowledgeAlert, UpdatePeerStatus (MVP: return [])
- Full test coverage: happy path, optimistic locking, error isolation

## Testes

Unittests para EventStore, CommandBus, EventBus com mocks. Edge cases:
- Concurrent appends (OptimisticConcurrencyError)
- Permissionless dispatch (PermissionError)
- Subscriber error isolation (continue publishing)

## Documentação

- docs/features/event-sourcing/plan.md — design decisions, interfaces, test plan
- docs/features/event-sourcing/implementation.md — what was built, patterns, wiring
- docs/features/event-sourcing/review.md — SOLID checklist, trade-offs, next steps
- @module headers + JSDoc on all public methods
- docs/index.md, docs/next_steps.md updated with Phase 3 completion

## Checklist

- [x] SOLID verificado em todos os arquivos
- [x] JSDoc em todos os métodos públicos
- [x] Testes unitários escritos
- [x] TypeScript strict mode passes
- [x] Documentação completa (plan, implementation, review)
- [x] Pronto para Phase 4 (RuleEngine)
```
