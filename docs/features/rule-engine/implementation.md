# rule-engine — Implementação

**Branch:** `feature/rule-engine`
**Data:** 2026-06-27
**Status:** Implementado (sem testes — escopo reduzido a pedido do dev)

---

## Arquivos criados

### `app/backend/src/domain/commands/TriggerAlert.ts`

**Responsabilidade:** Command que representa a intenção de criar um alerta a partir de uma regra que casou.
**Pattern aplicado:** Command (mesma base de CreateAlertRule, AcknowledgeAlert, UpdatePeerStatus)
**Dependências injetadas:** nenhuma — é um DTO imutável

```typescript
export class TriggerAlert extends Command<TriggerAlertPayload> {
  constructor(aggregateId: string, payload: TriggerAlertPayload)
}
```

### `app/backend/src/infra/handlers/TriggerAlertHandler.ts`

**Responsabilidade:** Converte TriggerAlert command em um AlertTriggered DomainEvent.
**Pattern aplicado:** Strategy (mesmo padrão dos demais handlers de Phase 3)
**Dependências injetadas:** nenhuma

```typescript
export class TriggerAlertHandler implements CommandHandler {
  readonly commandType = "TRIGGER_ALERT";
  async handle(command: TriggerAlert): Promise<DomainEvent[]>
}
```

### `app/backend/src/infra/rules/ConditionMatcher.ts`

**Responsabilidade:** Interface Strategy para avaliação de uma condição contra um evento.
**Pattern aplicado:** Strategy
**Dependências injetadas:** N/A (interface)

### `app/backend/src/infra/rules/Rule.ts`

**Responsabilidade:** Tipos `RuleCondition`, `RuleAction`, `Rule` — vocabulário mínimo de uma regra compilada.
**Pattern aplicado:** N/A (tipos puros)

### `app/backend/src/infra/rules/matchers/FeeSpikeMatcher.ts`

**Responsabilidade:** Avalia `MemPoolFeeSpike.payload.deltaPct >= threshold`.
**Pattern aplicado:** Strategy

### `app/backend/src/infra/rules/matchers/TransactionSizeMatcher.ts`

**Responsabilidade:** Avalia `TransactionDetected.payload.vsize >= threshold`.
**Pattern aplicado:** Strategy

### `app/backend/src/infra/rules/matchers/PeerCountMatcher.ts`

**Responsabilidade:** Mantém contador interno de peers conectados (incrementa em PeerConnected,
decrementa em PeerDisconnected) e avalia `connectedPeers < threshold`.
**Pattern aplicado:** Strategy com estado interno
**Desvio do plano:** PeerConnected/PeerDisconnected não carregam uma contagem agregada no payload
— apenas o peer individual afetado. Foi necessário manter estado dentro do matcher. Documentado
como trade-off conhecido (ver review.md) — Phase 5 pode mover esse estado para Redis/Postgres
para sobreviver a restarts e múltiplas instâncias.

### `app/backend/src/infra/rules/AlertRuleBuilder.ts`

**Responsabilidade:** Fluent builder para compilar `Rule` a partir de condições e uma ação
(`triggerAlert` ou `updatePeerStatus`).
**Pattern aplicado:** Builder
**Dependências injetadas:** nenhuma

```typescript
new AlertRuleBuilder("high-fee-alert")
  .whenFeeSpike(20)
  .triggerAlert("Mempool fee spike detected", "HIGH")
```

**Desvio do plano:** `triggerAlert()` recebe `(ruleName, severity)` como no plan.md, mas a Rule
resultante usa `action.buildCommand(event)` — uma factory que recebe o evento disparador — em vez
de um Command estático. Isso é necessário porque `sourceEventId` (campo obrigatório do
AlertTriggeredPayload) só existe no momento em que o evento real ocorre, não no momento em que a
regra é construída.

### `app/backend/src/infra/RuleEngine.ts`

**Responsabilidade:** Subscreve a todos os tipos de evento via EventBus, avalia regras ativas,
despacha o command de cada regra que casar via CommandBus.
**Pattern aplicado:** Chain of Responsibility (avaliação isolada por regra) + Strategy
(delegação ao ConditionMatcher)
**Dependências injetadas:**
- `eventBus` (IEventBus) — para subscrever a eventos
- `commandBus` (ICommandDispatcher) — para despachar o command da ação que casou

**Desvio do plano:** o plan.md descrevia `eventBus.subscribe("*", ...)` (wildcard). A
implementação real do `EventBus` (Phase 3) só suporta subscrição por `eventType` específico —
não há suporte a wildcard. RuleEngine.bootstrap() agora subscreve explicitamente a cada tipo de
evento de domínio conhecido (`ALL_EVENT_TYPES`). Isso significa que novos tipos de evento
precisam ser adicionados a essa lista — uma pequena violação de Open/Closed que fica documentada
aqui como trade-off aceito para o MVP (alternativa seria modificar EventBus para suportar
wildcard, fora do escopo desta feature).

---

## Arquivos modificados

### `app/backend/src/domain/commands/index.ts`

**O que mudou:** adicionado export de `TriggerAlert` e `TRIGGER_ALERT`.
**Por que:** novo command necessário para o RuleEngine despachar criação de alertas.

### `app/backend/src/infra/CommandBus.ts`

**O que mudou:** adicionado case `"TRIGGER_ALERT"` em `validatePermissions`, usando
`PermissionSpec.canCreateAlert` (mesma regra de CREATE_ALERT_RULE — ADMIN/OPERATOR).
**Por que:** TRIGGER_ALERT precisa de validação de permissão como qualquer outro command.

```diff
+      case "TRIGGER_ALERT":
+        // Originado pelo RuleEngine (ator de sistema) ou por um ADMIN/OPERATOR manual.
+        if (!PermissionSpec.canCreateAlert(user)) {
+          throw new PermissionError(
+            "User does not have permission to trigger alerts"
+          );
+        }
+        break;
```

### `app/backend/src/infra/index.ts`

**O que mudou:** exporta `RuleEngine`, `AlertRuleBuilder`, os três matchers, `TriggerAlertHandler`
e os tipos `Rule`/`RuleCondition`/`RuleAction`/`ConditionMatcher`.
**Por que:** torna os novos módulos consumíveis fora de `infra/` (ex: bootstrap futuro em Phase 5).

---

## Wiring — como conectar ao sistema

Nenhum arquivo de bootstrap existe ainda no projeto (Phase 5 cria o entrypoint real com tRPC).
O snippet abaixo documenta a forma esperada de inicialização quando esse entrypoint existir:

```typescript
import {
  EventStore, EventBus, CommandBus, RuleEngine, AlertRuleBuilder,
  CreateAlertRuleHandler, AcknowledgeAlertHandler, UpdatePeerStatusHandler,
  TriggerAlertHandler, FeeSpikeMatcher, TransactionSizeMatcher, PeerCountMatcher,
} from "./infra";

const eventBus = new EventBus();
const eventStore = new EventStore(eventRepository, eventBus);

// RuleEngine atua como um ator de sistema — não há usuário autenticado por trás dele.
const systemUser = { id: "system", role: "ADMIN" as const };
const commandBus = new CommandBus(eventStore, eventBus, () => systemUser);

commandBus.register(new CreateAlertRuleHandler());
commandBus.register(new AcknowledgeAlertHandler());
commandBus.register(new UpdatePeerStatusHandler());
commandBus.register(new TriggerAlertHandler());

const ruleEngine = new RuleEngine(eventBus, commandBus);
ruleEngine.registerMatcher(new FeeSpikeMatcher());
ruleEngine.registerMatcher(new TransactionSizeMatcher());
ruleEngine.registerMatcher(new PeerCountMatcher());

ruleEngine.addRule(
  new AlertRuleBuilder("high-fee-alert")
    .whenFeeSpike(20)
    .triggerAlert("Mempool fee spike detected", "HIGH")
);

await ruleEngine.bootstrap();
```

---

## Testes escritos

Nenhum — a pedido explícito do dev, testes unitários foram pulados nesta rodada de
implementação. `plan.md` mantém os casos planejados (RuleEngine, AlertRuleBuilder, Matchers)
para quando forem retomados.

---

## Desvios do plano

1. **AlertTriggered não é um command em Phase 3** — apenas um DomainEvent. Foi necessário criar
   `TriggerAlert` (Command) + `TriggerAlertHandler` para que o RuleEngine pudesse despachar via
   CommandBus, consistente com o fluxo arquitetural existente (Command → Handler → DomainEvent →
   EventStore.append → EventBus.publish).
2. **EventBus não suporta wildcard subscribe** — RuleEngine.bootstrap() subscreve a uma lista
   explícita de tipos de evento (`ALL_EVENT_TYPES`) em vez de um único `"*"`.
3. **PeerCountMatcher mantém estado interno** — não estava especificado no plan.md que matchers
   teriam estado; foi necessário para resolver a contagem de peers a partir de eventos individuais
   de conexão/desconexão.
4. **`action.buildCommand(event)` é uma factory, não um Command estático** — necessário para
   popular `sourceEventId` com o id do evento real que disparou a regra.
5. **Testes unitários não escritos** — a pedido do dev durante a sessão de implementação.
