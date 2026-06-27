# SOLID constraints — referência com exemplos do projeto

Exemplos concretos usando o codebase do Bitcoin Operations Panel.
Para cada princípio: o que é, como detectar violação, como corrigir.

---

## S — Single Responsibility

**Uma classe/módulo tem uma única razão para mudar.**

### Violação

```typescript
// ❌ MempoolPoller faz polling E persiste alertas E notifica via WebSocket
class MempoolPoller {
  async poll() {
    const data = await this.adapter.getMempoolInfo()
    await this.db.insert(events).values(...)      // ← persistência não é responsabilidade do poller
    this.wsServer.emit('mempool:updated', data)   // ← notificação não é responsabilidade do poller
  }
}
```

### Correto

```typescript
// ✅ MempoolPoller só emite eventos de domínio — quem escuta decide o que fazer
class MempoolPoller extends EventEmitter {
  async poll() {
    const data = await this.adapter.getMempoolInfo()
    this.emit('event', { type: 'MEMPOOL_UPDATED', payload: data })
    // EventStore escuta e persiste. EventBus escuta e notifica. Cada um na sua classe.
  }
}
```

**Sinal de violação:** o módulo tem mais de uma razão para ser modificado.
Se você disser "vou mudar X porque mudou a regra de Y", e X e Y são coisas diferentes,
a classe tem mais de uma responsabilidade.

---

## O — Open/Closed

**Aberto para extensão, fechado para modificação.**

### Violação

```typescript
// ❌ Adicionar novo tipo de condição exige modificar RuleEngine
class RuleEngine {
  evaluate(event: BitcoinNetworkEvent, condition: AlertCondition): boolean {
    if (condition.type === 'FEE_RATE') {
      return event.payload.feeRate > condition.value
    }
    if (condition.type === 'TX_SIZE') {      // ← nova condição = modificar esta classe
      return event.payload.txSize > condition.value
    }
    // nova condição = mais um if aqui
  }
}
```

### Correto

```typescript
// ✅ Nova condição = nova classe. RuleEngine não muda.
interface ConditionEvaluator {
  conditionType: AlertCondition['type']
  evaluate(condition: AlertCondition, event: BitcoinNetworkEvent): boolean
}

class FeeRateEvaluator implements ConditionEvaluator {
  conditionType = 'FEE_RATE' as const
  evaluate(condition, event) { return event.payload.feeRate > condition.value }
}

class TxSizeEvaluator implements ConditionEvaluator {  // nova classe, sem tocar nas existentes
  conditionType = 'TX_SIZE' as const
  evaluate(condition, event) { return event.payload.txSize > condition.value }
}

class RuleEngine {
  private evaluators = new Map<string, ConditionEvaluator>()

  register(evaluator: ConditionEvaluator) {
    this.evaluators.set(evaluator.conditionType, evaluator)
  }

  evaluate(event, condition) {
    return this.evaluators.get(condition.type)?.evaluate(condition, event) ?? false
  }
}
```

**Sinal de violação:** adicionar comportamento novo exige modificar código existente.

---

## L — Liskov Substitution

**Implementações de uma interface devem ser substituíveis sem quebrar o chamador.**

### Violação

```typescript
// ❌ MockBitcoinAdapter lança erros que a interface não declara
interface BitcoinAdapter {
  getMempoolInfo(): Promise<MempoolInfo>
}

class MockBitcoinAdapter implements BitcoinAdapter {
  getMempoolInfo(): Promise<MempoolInfo> {
    throw new Error('Not implemented')  // ← chamador não espera isso
  }
}

// Callers que fazem:
try {
  const info = await adapter.getMempoolInfo()
} catch (e) {
  if (e instanceof BitcoinRPCError) { ... }  // MockBitcoinAdapter nunca lança BitcoinRPCError
}
```

### Correto

```typescript
// ✅ MockBitcoinAdapter se comporta como BitcoinRPCAdapter — mesmo contrato de erros
class MockBitcoinAdapter implements BitcoinAdapter {
  private data: MempoolInfo = { size: 0, bytes: 0, mempoolminfee: 0.00001, ... }

  getMempoolInfo(): Promise<MempoolInfo> {
    return Promise.resolve(this.data)
  }

  // Para simular erro, usa o mesmo tipo de erro que o real
  simulateError() {
    this.getMempoolInfo = () => Promise.reject(new BitcoinRPCError('mock error', -1))
  }
}
```

**Sinal de violação:** você precisa checar `instanceof` da implementação concreta no chamador.
Se você faz `if (adapter instanceof MockAdapter)`, o Liskov está quebrado.

---

## I — Interface Segregation

**Interfaces menores e focadas — o chamador não deve depender do que não usa.**

### Violação

```typescript
// ❌ Interface grande — CommandBus precisa apenas de dispatch, não de register
interface ICommandBus {
  dispatch(command: AnyCommand): Promise<void>
  register(handler: CommandHandler): void
  unregister(type: string): void
  getHandlers(): Map<string, CommandHandler>
  clearAll(): void
}

// CommandBus é injetado em tRPC context, que só precisa de dispatch
// Mas agora o contexto depende de register, unregister, getHandlers, clearAll
```

### Correto

```typescript
// ✅ Interfaces separadas por papel
interface CommandDispatcher {
  dispatch(command: AnyCommand): Promise<void>
}

interface CommandRegistry {
  register(handler: CommandHandler): void
  unregister(type: string): void
}

// tRPC context injeta CommandDispatcher — não sabe que CommandBus também é um CommandRegistry
// Bootstrapping injeta CommandRegistry para registrar handlers na inicialização
class CommandBus implements CommandDispatcher, CommandRegistry {
  // implementa as duas
}
```

**Sinal de violação:** o chamador recebe uma interface e usa apenas 2 de 8 métodos.
Pergunta: "se eu remover os 6 não usados, o chamador quebra?" Se não quebra, a interface está grande.

---

## D — Dependency Inversion

**Módulos de alto nível dependem de abstrações. Abstrações não dependem de detalhes.**

### Violação

```typescript
// ❌ RuleEngine cria suas próprias dependências — impossível testar isolado
class RuleEngine {
  private db = new PostgresClient(process.env.DATABASE_URL)  // ← detalhe de infra
  private redis = new Redis(process.env.REDIS_URL)           // ← detalhe de infra

  async evaluate(event) {
    const rules = await this.db.select().from(alertRules)    // ← alto nível depende de detalhe
    ...
  }
}
```

### Correto

```typescript
// ✅ RuleEngine recebe abstrações — não sabe como as regras são carregadas
interface AlertRuleRepository {
  findActive(): Promise<AlertRule[]>
}

class RuleEngine {
  constructor(
    private readonly commandBus: CommandDispatcher,          // abstração
    private readonly loadActiveRules: () => Promise<AlertRule[]>  // função simples — mais flexível ainda
  ) {}

  async evaluate(event) {
    const rules = await this.loadActiveRules()  // pode ser banco, cache, memória — não importa
    ...
  }
}

// Na inicialização:
const ruleEngine = new RuleEngine(
  commandBus,
  () => db.select().from(alertRules).where(eq(alertRules.active, 1))
)

// No teste:
const ruleEngine = new RuleEngine(
  mockCommandBus,
  () => Promise.resolve([mockRule])  // sem banco
)
```

**Sinal de violação:** `new ConcreteClass()` dentro de um módulo de negócio.
Qualquer `new` que não seja de um value object (ex: `new Date()`, `new Map()`) é suspeito.

---

## Regras adicionais do projeto

### Erros tipados sempre

```typescript
// ❌
throw new Error('RPC failed')

// ✅
throw new BitcoinRPCError('connection refused', -1)
// Chamadores conseguem fazer catch tipado e reagir diferente por tipo de erro
```

### Sem magic numbers/strings

```typescript
// ❌
if (deltaPct >= 20) { ... }
await redis.expire(key, 30)

// ✅
private readonly FEE_SPIKE_THRESHOLD_PCT = 20
private readonly PRESENCE_TTL_SEC = 30
```

### Retorno de Map, não de objetos com keys variáveis

```typescript
// ❌ — TypeScript não consegue tipar bem
async getRawMempool(): Promise<Record<string, MempoolTransaction>>

// ✅ — API mais segura e intuitiva
async getRawMempool(): Promise<Map<string, MempoolTransaction>>
```

### Async/await consistente — sem mistura com .then()

```typescript
// ❌
adapter.getMempoolInfo().then(info => {
  this.process(info)
}).catch(err => console.error(err))

// ✅
try {
  const info = await adapter.getMempoolInfo()
  this.process(info)
} catch (err) {
  // handle
}
```
