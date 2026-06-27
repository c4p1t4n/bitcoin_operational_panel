# event-sourcing — Implementação

**Branch:** `feature/event-sourcing`
**Data:** 2026-06-27
**Status:** Implementado

---

## Arquivos criados

### `app/backend/src/infra/EventStore.ts`

**Responsabilidade:** append-only log com optimistic locking e publicação para EventBus.

**Pattern aplicado:** Event Sourcing
- Por que: fonte única da verdade é o log, não o estado atual
- Recuperação é replay, auditoria é integrada, concorrência é detectada

**Dependências injetadas:**
- `db: NodePgDatabase` — cliente Drizzle para acesso à `events` table
- `eventBus: IEventBus` — para publicar após append bem-sucedido

**Interface pública:**

```typescript
interface IEventStore {
  append(command: Command, events: DomainEvent[]): Promise<void>
  getEventsFor(aggregateId: string): Promise<DomainEvent[]>
}

export class OptimisticConcurrencyError extends Error {
  constructor(aggregateId: string, expectedVersion: number)
}
```

**Decisões de implementação:**
- `append()` lança `OptimisticConcurrencyError` se `UNIQUE(aggregate_id, version)` constraint violado
- Publica para EventBus **após** persistência bem-sucedida (não antes)
- `getEventsFor()` ordena por version ASC (reconstituição de estado)
- Sem retry automático — caller (CommandBus) decide

---

### `app/backend/src/infra/CommandBus.ts`

**Responsabilidade:** orquestração central de commands — dispatch, validação, handlers, persistência.

**Pattern aplicado:** Command Bus + Strategy
- Por que: single entry point para todas as mudanças de estado
- Separa validação (permissões, payload) de execução (handlers)
- Permite auditoria centralizada e error handling

**Dependências injetadas:**
- `eventStore: IEventStore` — para persistir eventos do handler
- `eventBus: IEventBus` — passado aos handlers se precisarem
- `getCurrentUser: () => User | null` — para validar PermissionSpec

**Interface pública:**

```typescript
interface ICommandDispatcher {
  dispatch(command: Command): Promise<DomainEvent[]>
}

interface CommandHandler {
  readonly commandType: string
  handle(command: Command): Promise<DomainEvent[]>
}
```

**Decisões de implementação:**
- `dispatch()` é síncrono (await até EventStore.append)
- Valida `PermissionSpec` antes de encontrar handler
- Lança `CommandNotFoundError` se handler não registrado
- Lança `PermissionError` se usuário não autenticado ou sem permissão
- Propaga `OptimisticConcurrencyError` para caller (retry logic no tRPC)
- `register()` é chamado durante bootstrap (não service locator)

---

### `app/backend/src/infra/EventBus.ts`

**Responsabilidade:** pub/sub para eventos de domínio, fan-out para subscribers.

**Pattern aplicado:** Observer (Pub/Sub)
- Por que: desacoplamento entre produtores (EventStore) e consumidores (RuleEngine, frontend)
- Em-memória MVP; Phase 5+ integra Redis para distribuição

**Dependências injetadas:**
- Nenhuma no MVP (em-memória)

**Interface pública:**

```typescript
interface IEventBus {
  publish(events: DomainEvent[]): Promise<void>
  subscribe(eventType: string, handler: EventBusSubscriber): () => Promise<void>
}

type EventBusSubscriber = (event: DomainEvent) => Promise<void>
```

**Decisões de implementação:**
- `publish()` executa subscribers em paralelo com `Promise.allSettled()`
- Erro de um subscriber é capturado/logado, não afeta outros
- `subscribe()` retorna função unsubscribe
- Sem persistência — fire-and-forget (queue de DLQ é Phase 5)
- Sem Redis MVP — em-memória Map<eventType, Set<handlers>>

---

### `app/backend/src/infra/handlers/`

#### CreateAlertRuleHandler

**Responsabilidade:** processa `CreateAlertRule` command.

**Pattern aplicado:** Strategy
- Por que: cada command type tem uma estratégia diferentes
- Novos handlers entram sem modificar CommandBus (Open/Closed)

**Implementação:**
- MVP: retorna `[]` (sem eventos)
- TODO Phase 4: valida configuration, verifica syntax, gera `AlertCreated` event
- TODO Phase 4: registra regra no RuleEngine

#### AcknowledgeAlertHandler

**Responsabilidade:** processa `AcknowledgeAlert` command.

**Implementação:**
- Gera `AlertAcknowledged` event com versão 1
- TODO Phase 4: carregar versão atual via `EventStore.getEventsFor()`
- TODO Phase 4: validar que alert está em status "OPEN"

#### UpdatePeerStatusHandler

**Responsabilidade:** processa `UpdatePeerStatus` command.

**Implementação:**
- Se `connected: true` → gera `PeerConnected` event
- Se `connected: false` → gera `PeerDisconnected` event
- TODO Phase 4: carregar peer status anterior, apenas gera event se mudança real

---

## Arquivos modificados

### `app/backend/package.json`

```diff
  "dependencies": {
    "dotenv": "^16.4.7",
    "drizzle-orm": "^0.45.2",
+   "ioredis": "^5.3.2",
    "pg": "^8.22.0",
+   "zod": "^3.22.4"
  }
```

**Por que:** ioredis para fase Redis (Phase 5+), zod para validação de runtime (Phase 4+)

---

## Testes escritos

### `app/backend/src/infra/__tests__/EventStore.test.ts`

| Caso | Descrição |
|------|-----------|
| append happy path | Persiste eventos, chama EventBus.publish |
| append optimistic lock | Dois appends concorrentes → segundo lança OptimisticConcurrencyError |
| append publishes | EventBus.publish é chamado após sucesso |
| append múltiplos eventos | Handler retorna 2+ eventos, todos persistem |
| append array vazio | Sem insert, sem publish |
| getEventsFor | Retorna eventos em ordem de version |
| getEventsFor vazio | Retorna [] para agregado inexistente |

**Mocks:** db (insert/select), EventBus.publish

### `app/backend/src/infra/__tests__/CommandBus.test.ts`

| Caso | Descrição |
|------|-----------|
| register handler | Handler registrado, dispatch o encontra |
| register duplicate | Lança erro se re-registra |
| dispatch no user | Lança PermissionError |
| dispatch sem permissão | VIEWER tenta CREATE_ALERT_RULE → PermissionError |
| dispatch handler não registrado | CommandNotFoundError |
| dispatch happy path | Handler chamado, eventos persistem, retornam |
| dispatch sem eventos | Sem EventStore.append |

**Mocks:** EventStore, EventBus, getCurrentUser

### `app/backend/src/infra/__tests__/EventBus.test.ts`

| Caso | Descrição |
|------|-----------|
| publish single subscriber | Handler recebe evento |
| publish múltiplos subscribers | Todos recebem |
| publish tipo não registrado | Nenhum handler chamado |
| publish múltiplos eventos | Todos publicados |
| unsubscribe | Handler removido, próximo publish não chama |
| error isolation | Um handler falha, outro ainda é chamado |

**Mocks:** nenhum (in-memória)

---

## Wiring — como conectar ao sistema

### Em app/backend/src/index.ts (ou bootstrap.ts):

```typescript
import { db } from "./db"
import { EventBus } from "./infra/EventBus"
import { EventStore } from "./infra/EventStore"
import { CommandBus } from "./infra/CommandBus"
import {
  CreateAlertRuleHandler,
  AcknowledgeAlertHandler,
  UpdatePeerStatusHandler,
} from "./infra/handlers"

// 1. Create infrastructure singletons
const eventBus = new EventBus()
const eventStore = new EventStore(db, eventBus)

// 2. Create CommandBus with auth function
const commandBus = new CommandBus(
  eventStore,
  eventBus,
  () => getCurrentUserFromContext() // from tRPC context (Phase 5)
)

// 3. Register handlers at boot
commandBus.register(new CreateAlertRuleHandler())
commandBus.register(new AcknowledgeAlertHandler())
commandBus.register(new UpdatePeerStatusHandler())

// 4. Expose commandBus to tRPC routers (Phase 5)
export { commandBus }

// 5. Later: subscribe RuleEngine (Phase 4)
// const ruleEngine = new RuleEngine(commandBus, eventBus)
// ruleEngine.subscribe()
```

---

## Desvios do plano

### EventBus é em-memória, não Redis (MVP)

**Plano dizia:** "Built on Redis (not in-memory): distributed"

**Implementado:** em-memória Map<eventType, Set<handlers>>

**Razão:** MVP mais simples, testável sem Redis. Phase 5 integra Redis para
frontend subscriptions e distribuição entre instâncias. Arquitetura suporta:
```typescript
// Phase 5: Inject Redis client
class RedisEventBus implements IEventBus {
  constructor(private redis: Redis) {}
  async publish(events) {
    await this.redis.publish(...) // PUBLISH eventos para subscribers
  }
  async subscribe(eventType, handler) {
    await this.redis.subscribe(...) // SUBSCRIBE ao channel
  }
}
```

### Handlers retornam `[]` (eventos vazios)

**Plano dizia:** "Handler chamado, retorna DomainEvent[]"

**Implementado:** handlers retornam `[]` para MVP, TODO Phase 4

**Razão:** Phase 3 testa infraestrutura (persist, dispatch, pub/sub).
Phase 4 (RuleEngine) testa lógica de negócio (quando criar alert vs. ignorar evento).

---

## Checklist SOLID

| Arquivo | S | O | L | I | D | Notas |
|---------|---|---|---|---|---|-------|
| EventStore.ts | ✅ | ✅ | ✅ | ✅ | ✅ | Append-only, publica, não processa regras |
| CommandBus.ts | ✅ | ✅ | ✅ | ✅ | ✅ | Dispatch, DI de handlers, PermissionSpec desacoplado |
| EventBus.ts | ✅ | ✅ | ✅ | ✅ | ✅ | Pub/sub, observer, sem lógica de negócio |
| CreateAlertRuleHandler.ts | ✅ | ✅ | ✅ | ✅ | ✅ | Strategy única, retorna eventos |
| AcknowledgeAlertHandler.ts | ✅ | ✅ | ✅ | ✅ | ✅ | Strategy única, evento de confirmação |
| UpdatePeerStatusHandler.ts | ✅ | ✅ | ✅ | ✅ | ✅ | Strategy única, emit Based on bool |

**Notas por princípio:**
- **S:** Cada classe tem uma responsabilidade: persist (EventStore), dispatch (CommandBus), pub/sub (EventBus), handle (handlers)
- **O:** Novos handlers entram sem modificar CommandBus. Novos subscribers entram sem modificar EventBus
- **L:** Todos os handlers implementam `CommandHandler` contrato; substituíveis
- **I:** EventBus.publish não expõe write/delete, apenas read.subscribe
- **D:** DI via constructor, não `new` dentro dos módulos

---

## Documentação de código

✅ Todos os arquivos têm `@module`, `@description`, `PATTERN`, `Responsabilidade`
✅ Todos os métodos públicos têm JSDoc com `@param`, `@returns`, `@throws`
✅ Sem comentários internos (métodos falam por si)
✅ Nomes descritivos (OptimisticConcurrencyError, CommandNotFoundError, EventBusSubscriber)
