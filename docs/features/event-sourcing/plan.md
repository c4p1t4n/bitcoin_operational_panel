# event-sourcing — Plano

**Branch:** `feature/event-sourcing`
**Data:** 2026-06-27
**Status:** Planejamento

---

## O que faz

Implementa a infraestrutura central de event sourcing (EventStore, CommandBus, EventBus)
necessária para toda mudança de estado no sistema. Estabelece o fluxo de escrita:
Command → CommandBus → (valida permissões) → Handler → (gera DomainEvents) → EventStore.append
→ (persiste com optimistic locking) → EventBus.publish → (notifica subscribers).

---

## Por que

Phase 2 criou o vocabulário (DomainEvent, Command, PermissionSpec) e o storage (events table).
Phase 3 constrói os orquestradores que usam esse vocabulário:

- **EventStore:** orquestrador da persistência com locking otimista
- **CommandBus:** orquestrador do dispatch, validação de permissões e coleta de eventos
- **EventBus:** pub/sub distribuído via Redis para RuleEngine (P4) e frontend subscriptions (P5)

Sem isso, não há nada que receba Commands e produza DomainEvents.

---

## Escopo

### Inclui

- EventStore.ts
  - `append(command: Command, events: DomainEvent[]): Promise<void>`
  - `getEventsFor(aggregateId: string): Promise<DomainEvent[]>`
  - OptimisticConcurrencyError (thrown when version conflict detected)
  - Dependency: db (Drizzle), EventBus
  - Tests: happy path, optimistic locking, publishing

- CommandBus.ts
  - `dispatch(command: AnyCommand): Promise<DomainEvent[]>`
  - `register(handler: CommandHandler): void` (private, used at boot)
  - Validates PermissionSpec before dispatch
  - Calls handler, collects events, calls EventStore.append
  - Dependency injection: EventStore, EventBus, CommandHandlers
  - Tests: permission check, happy path, payload validation, error handling

- Command handlers (3 initially)
  - CreateAlertRuleHandler
  - AcknowledgeAlertHandler
  - UpdatePeerStatusHandler
  - Each returns DomainEvent[]

- EventBus.ts
  - `publish(events: DomainEvent[]): Promise<void>`
  - `subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): () => void`
  - Built on Redis (pub/sub), not in-memory
  - Supports multiple subscribers per event type
  - Tests: publish/subscribe, multiple subscribers, error isolation

- docs/features/event-sourcing/plan.md (this file)
- docs/features/event-sourcing/implementation.md
- docs/features/event-sourcing/review.md

### Não inclui (explicitamente fora do escopo)

- RuleEngine — é Phase 4, assina EventBus em Phase 5 wiring
- tRPC wiring — é Phase 5, usa CommandBus e EventBus
- Frontend integration — é Phase 5, usa EventBus subscriptions
- Zod payload validation runtime schema — CommandBus valida via TypeScript + try/catch, não schema builder
- Persistent queues or dead-letter — Redis pub/sub é fire-and-forget; P5 pode adicionar retry layer
- Saga patterns ou compensating transactions — fora do escopo (single-aggregate commands only)
- Event versioning/migration — Payload é JSONB; handlers devem ser defensivos

---

## Módulos afetados

| Arquivo | Tipo de mudança | Responsabilidade |
|---------|----------------|-----------------|
| `app/backend/src/infra/EventStore.ts` | Criação | Append-only log com optimistic locking + EventBus publish |
| `app/backend/src/infra/CommandBus.ts` | Criação | Dispatch, permissões, handlers, EventStore coordination |
| `app/backend/src/infra/EventBus.ts` | Criação | Redis pub/sub, fan-out para subscribers |
| `app/backend/src/infra/handlers/CreateAlertRuleHandler.ts` | Criação | Cria AlertRule, emite AlertTriggered |
| `app/backend/src/infra/handlers/AcknowledgeAlertHandler.ts` | Criação | Marca Alert como tratado |
| `app/backend/src/infra/handlers/UpdatePeerStatusHandler.ts` | Criação | Atualiza status de conectividade |
| `app/backend/package.json` | Modificação | Adiciona zod, ioredis |
| `app/backend/__tests__/infra/EventStore.test.ts` | Criação | Unit tests |
| `app/backend/__tests__/infra/CommandBus.test.ts` | Criação | Unit tests |
| `app/backend/__tests__/infra/EventBus.test.ts` | Criação | Unit tests |

---

## Interfaces planejadas

### EventStore

```typescript
interface EventStore {
  append(command: Command, events: DomainEvent[]): Promise<void>
  getEventsFor(aggregateId: string): Promise<DomainEvent[]>
}

export class OptimisticConcurrencyError extends Error {
  constructor(aggregateId: string, expectedVersion: number)
}
```

**Dependências injetadas:**
- `db: NodePgDatabase` (Drizzle client) — para persistir/ler events table
- `eventBus: EventBus` — para publicar após append

---

### CommandBus

```typescript
interface CommandDispatcher {
  dispatch(command: AnyCommand): Promise<DomainEvent[]>
}

interface CommandRegistry {
  register(handler: CommandHandler): void
}

interface CommandHandler {
  commandType: string
  handle(command: Command): Promise<DomainEvent[]>
}

type AnyCommand = CreateAlertRule | AcknowledgeAlert | UpdatePeerStatus
```

**Dependências injetadas:**
- `eventStore: EventStore` — para persistir eventos
- `eventBus: EventBus` — para publicar após EventStore.append
- `getCurrentUser: () => User` — para validar PermissionSpec

---

### EventBus

```typescript
interface EventBus {
  publish(events: DomainEvent[]): Promise<void>
  subscribe(
    eventType: string,
    handler: (event: DomainEvent) => Promise<void>
  ): () => void  // retorna unsubscribe function
}

interface EventBusSubscriber {
  (event: DomainEvent): Promise<void>
}
```

**Dependências injetadas:**
- `redis: Redis` (ioredis client) — para pub/sub

---

## Decisões de design

### Decisão 1: Redis, não in-memory pub/sub

**Contexto:** EventBus precisa ser distribuído (multiple app instances) e resistente.

**Opções consideradas:**
- In-memory EventEmitter (Node.js nativo)
  - ✗ Não sobrevive crash
  - ✗ Não funciona com múltiplas instâncias
  - ✓ Simples, nenhuma dependência
- Redis pub/sub
  - ✓ Distribuído, múltiplas instâncias compartilham
  - ✓ Persiste durante crash (se RDB/AOF ativo)
  - ✓ Fácil de integrar com tRPC subscriptions (P5)
  - ✗ Dependência extra
- Kafka
  - ✓ Altamente disponível, retention
  - ✗ Overkill para MVP (operação mais complexa)
  - ✗ Adiciona latência

**Decisão:** Redis pub/sub.
**Por quê:** suporta escala horizontal simples, custa pouco, integra bem com tRPC.

---

### Decisão 2: CommandBus é síncrono, não assíncrono

**Contexto:** Commands vêm de tRPC/HTTP. Caller quer saber se funcionou ou falhou.

**Opções consideradas:**
- Síncrono: dispatch retorna Promise<DomainEvent[]>, caller aguarda
  - ✓ Simples, sem fila
  - ✓ Caller sabe imediatamente se falhou (OptimisticConcurrencyError)
  - ✗ Lento se EventBus.publish for lento
- Assíncrono: dispatch enfileira, retorna imediatamente
  - ✓ Rápido para caller
  - ✗ Caller não sabe se vai falhar (retry logic complexo)
  - ✗ Precisa de fila persistente

**Decisão:** Síncrono.
**Por quê:** Phase 3 é MVP, transaction-safety é mais importante que latência agora.

---

### Decisão 3: Handlers registrados em boot, não service locator

**Contexto:** CommandBus precisa mapear command type → handler.

**Opções consideradas:**
- Registro em boot (dependency injection)
  ```typescript
  const commandBus = new CommandBus(eventStore, eventBus, getCurrentUser)
  commandBus.register(new CreateAlertRuleHandler(...))
  commandBus.register(new AcknowledgeAlertHandler(...))
  ```
  - ✓ Testável (pode mockar handlers)
  - ✓ Transparente (bootstrap.ts deixa claro o grafo)
  - ✗ Mais verboso
- Service locator (registry global)
  ```typescript
  CommandHandlerRegistry.register(CreateAlertRule, handler)
  ```
  - ✓ Menos boilerplate
  - ✗ Difícil testar (estado global)
  - ✗ Menos visível

**Decisão:** Registro em boot.
**Por quê:** testing + SOLID (Dependency Inversion).

---

### Decisão 4: EventStore.append valida payload de DomainEvent via try/catch, não Zod

**Contexto:** DomainEvent subclasses têm `payload: unknown`. Ao persistir, precisa validar.

**Opções consideradas:**
- Zod schema por tipo de evento
  ```typescript
  const memPoolFeeSpikeSchema = z.object({ feeRateSatPerVb: z.number(), ... })
  ```
  - ✓ Runtime validation, mensagens claras
  - ✗ Duplicação (já temos TypeScript types)
- Try/catch ao serializar
  ```typescript
  const json = JSON.stringify(event.payload)
  const restored = JSON.parse(json) // detecta estrutura ruim
  ```
  - ✓ Simples, nenhuma lib nova
  - ✗ Erros genéricos
- TypeScript only (confiar no handler)
  - ✓ Nenhuma verificação, handlers são internos
  - ✗ JSONB no banco fica sujo

**Decisão:** Try/catch + TypeScript.
**Por quê:** handlers são código nosso (confiável), Zod pode entrar em P4 (RuleEngine precisa validar input externo).

---

## Testes planejados

### EventStore.test.ts

| Caso | Tipo | Descrição |
|------|------|-----------|
| append happy path | Unit | Persiste events, próxima versão incremented, retorna sucesso |
| append optimistic lock | Unit | Dois appends concorrentes p/ mesmo aggregateId: segundo lança OptimisticConcurrencyError |
| append publishes | Unit | Após append sucesso, EventBus.publish chamado |
| getEventsFor | Unit | Retorna todos events de um aggregateId em ordem (sort by version ASC) |
| getEventsFor vazio | Unit | Retorna [] para aggregateId inexistente |
| version start | Unit | Primeiro event de um agregado tem version=1 |

### CommandBus.test.ts

| Caso | Tipo | Descrição |
|------|------|-----------|
| permission denied | Unit | User com role VIEWER tenta CreateAlertRule, dispatch lança PermissionError |
| permission allowed | Unit | User com role ADMIN tenta CreateAlertRule, handler chamado |
| handler returns events | Unit | Handler retorna DomainEvent[], dispatch chama EventStore.append com eles |
| optimistic lock retry | Unit | Handler throws OptimisticConcurrencyError, dispatch re-lança para caller |
| unregistered command | Unit | dispatch com command type inexistente lança CommandNotFoundError |

### EventBus.test.ts

| Caso | Tipo | Descrição |
|------|------|-----------|
| publish to subscribers | Unit | publish(events) chama todos subscribers registrados p/ evento type |
| multiple subscribers | Unit | Dois subscribers p/ mesmo eventType, ambos recebem |
| unsubscribe | Unit | Subscriber retorna unsubscribe(), próximo publish não chama |
| error isolation | Unit | Um subscriber throws, outro ainda é chamado (catch + log) |

### Integration (if time)

| Caso | Tipo | Descrição |
|------|------|-----------|
| CreateAlertRule end-to-end | Integration | CommandBus.dispatch(CreateAlertRule) → handler → EventStore.append → EventBus.publish |

---

## Definition of done

- [ ] EventStore.ts criado + testes unitários
- [ ] CommandBus.ts criado + testes unitários
- [ ] 3 CommandHandlers criados (CreateAlertRule, AcknowledgeAlert, UpdatePeerStatus)
- [ ] EventBus.ts criado + testes unitários
- [ ] ioredis + zod adicionados a package.json
- [ ] SOLID verificado em todos arquivos
- [ ] JSDoc em todos métodos públicos
- [ ] plan.md, implementation.md, review.md criados
- [ ] TypeScript strict mode passa
- [ ] PR description gerada
