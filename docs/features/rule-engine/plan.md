# rule-engine — Plano

**Branch:** `feature/rule-engine`  
**Data:** 2026-06-27  
**Status:** Planejamento

---

## O que faz

Rule Engine evaluates domain events from the EventBus against configured alert rules and dispatches commands through the CommandBus when conditions match, enabling autonomous alert triggering and peer status updates based on Bitcoin network events.

## Por que

Fase 3 (Event Sourcing) laid the foundation with EventBus and CommandBus, but there's no autonomous logic connecting them. Alert rules created through CreateAlertRuleCommand sit dormant until Phase 4 evaluates events against them. This bridges the event sourcing infrastructure and automation — enabling real-time rule evaluation without manual intervention.

## Escopo

### Inclui
- `RuleEngine.ts` — subscribes to EventBus, evaluates events against rules, dispatches commands
- `AlertRuleBuilder.ts` — fluent DSL for building rules (condition + action pairs)
- Condition strategy handlers: `FeeSpike`, `TransactionSize`, `PeerCount` (extensible pattern)
- Full unit test coverage (happy path, edge cases, error isolation)
- SOLID compliance and JSDoc documentation

### Não inclui (explicitamente fora do escopo)
- Rule persistence (Phase 4.5 — rules are stored in Phase 2 schema but loaded in Phase 5)
- Redis integration for RuleEngine state (Phase 5 adds distributed rule evaluation)
- UI for rule management (Phase 5)
- Audit trail of evaluated rules (deferred to Phase 5 analytics)

---

## Módulos afetados

| Arquivo | Tipo de mudança | Responsabilidade |
|---------|----------------|-----------------|
| `app/backend/src/infra/RuleEngine.ts` | Criação | Chain of Responsibility: subscribe, evaluate, dispatch |
| `app/backend/src/infra/AlertRuleBuilder.ts` | Criação | Fluent builder for rule construction |
| `app/backend/src/infra/handlers/conditions/FeeSpikeMatcher.ts` | Criação | Strategy: detects MemPoolFeeSpike events |
| `app/backend/src/infra/handlers/conditions/TransactionSizeMatcher.ts` | Criação | Strategy: detects large transactions |
| `app/backend/src/infra/handlers/conditions/PeerCountMatcher.ts` | Criação | Strategy: detects peer churn |
| `app/backend/src/infra/__tests__/RuleEngine.test.ts` | Criação | Unit tests for RuleEngine |
| `app/backend/src/infra/__tests__/AlertRuleBuilder.test.ts` | Criação | Unit tests for builder |
| `docs/features/rule-engine/plan.md` | Criação | This document |

---

## Interfaces planejadas

### RuleEngine

```typescript
/**
 * @module RuleEngine
 * Chain of Responsibility pattern: subscribes to EventBus,
 * evaluates each event against all active rules, dispatches matching commands.
 */
interface RuleEngine {
  /**
   * Subscribe to all domain events and set up rule evaluation
   * @throws Error if EventBus or CommandBus unavailable
   */
  bootstrap(): Promise<void>

  /**
   * Synchronously evaluate an event against all rules
   * Called by event handler (EventBus.on)
   * @param event - Domain event to evaluate
   * @returns Promise that resolves when all matching rules are evaluated (fire-and-forget)
   */
  evaluateEvent(event: DomainEvent): Promise<void>

  /**
   * Register a condition matcher (for extensibility in tests/future features)
   * @param matcher - Condition strategy implementation
   */
  registerMatcher(matcher: ConditionMatcher): void
}
```

**Dependências injetadas:**
- `EventBus` — to subscribe to all domain events
- `CommandBus` — to dispatch AlertTriggered, PeerStatusUpdated commands
- `Logger` (optional) — to log rule evaluation (won't crash if missing)

### AlertRuleBuilder

```typescript
/**
 * @module AlertRuleBuilder
 * Fluent builder for constructing alert rules with condition chains and actions.
 */
interface AlertRuleBuilder {
  /**
   * Add a fee spike condition (triggers when mempool fee > threshold)
   * @param thresholdPercentage - Min fee increase % (1-100)
   */
  whenFeeSpike(thresholdPercentage: number): this

  /**
   * Add a transaction size condition (triggers when tx > threshold)
   * @param sizeBytes - Min transaction size in bytes
   */
  whenTransactionSize(sizeBytes: number): this

  /**
   * Add a peer count condition (triggers when connected peers < threshold)
   * @param minPeers - Minimum peer count
   */
  whenPeerCount(minPeers: number): this

  /**
   * Set the action: dispatch an AlertTriggered command
   * @param ruleName - Human-readable rule identifier
   * @param severity - 'LOW' | 'MEDIUM' | 'HIGH'
   */
  triggerAlert(ruleName: string, severity: 'LOW' | 'MEDIUM' | 'HIGH'): Rule

  /**
   * Set the action: dispatch a PeerStatusUpdated command
   * @param aggregateId - Peer aggregate ID to update
   * @param status - New peer status
   */
  updatePeerStatus(aggregateId: string, status: PeerStatus): Rule
}
```

**Dependências injetadas:** None (builder is a configuration object, not a service)

### ConditionMatcher (Strategy Pattern)

```typescript
/**
 * @module ConditionMatcher
 * Strategy interface for evaluating conditions against domain events.
 * Each matcher handles one condition type (FeeSpike, TransactionSize, etc).
 */
interface ConditionMatcher {
  /**
   * Condition type identifier (used for builder chaining)
   */
  conditionType: string

  /**
   * Check if event satisfies this condition
   * @param event - Domain event
   * @param threshold - Condition-specific threshold
   */
  matches(event: DomainEvent, threshold: number): boolean
}
```

---

## Decisões de design

### Decisão 1: Chain of Responsibility vs Service Locator

**Contexto:** RuleEngine needs to evaluate *all* rules against *each* event. Multiple approaches:
- Service Locator: RuleEngine queries a registry for all active rules
- Chain of Responsibility: RuleEngine calls each handler in sequence, handlers decide if they match

**Opções consideradas:**
- **Service Locator:** Simple, but couples RuleEngine to rule storage and requires passing a registry. Also harder to test (need mock registry).
- **Chain of Responsibility:** Handlers subscribe directly to events, each evaluates independently. Decouples rule storage from evaluation logic.

**Decisão:** Chain of Responsibility (handlers register at bootstrap). 
- **Why:** Aligns with Phase 3 CommandBus pattern (handlers registered at boot), allows error isolation (one rule failing doesn't crash others), and defers rule loading to Phase 5 when persistence is tackled.

### Decisão 2: Fluent Builder vs Rule Object Constructor

**Contexto:** AlertRuleBuilder needs to be ergonomic for developers building rules.

**Opções consideradas:**
- **Constructor:** `new Rule({ conditions: [...], action: {...} })` — verbose, error-prone
- **Fluent Builder:** `new AlertRuleBuilder().whenFeeSpike(20).triggerAlert('...')` — readable, chain-safe

**Decisão:** Fluent Builder.
- **Why:** Matches common patterns (like Drizzle schema builder), validates constraints during chaining (e.g., reject threshold > 100%), and failures surface early.

### Decisão 3: Conditions as Separate Matcher Classes vs Single ConditionEvaluator

**Contexto:** RuleEngine needs to evaluate multiple condition types (fee spike, tx size, peer count) without growing into a monolith.

**Opções consideradas:**
- **Single ConditionEvaluator:** `evaluateCondition(type, event, threshold)` — all logic in one function, hard to extend
- **Matcher Strategy Classes:** `FeeSpikeMatcher`, `TransactionSizeMatcher` — each handles one condition type

**Decisão:** Matcher Strategy Classes (Strategy pattern).
- **Why:** Follows SOLID (Single Responsibility), allows new matchers to be added without modifying RuleEngine, and each can have its own test file.

### Decisão 4: Fire-and-Forget vs Awaited Command Dispatch

**Contexto:** When a rule matches, RuleEngine calls `CommandBus.dispatch()`. Should it wait for the command to complete?

**Opções consideradas:**
- **Await:** `await commandBus.dispatch(cmd)` — ensures rules execute serially, slower, clearer error handling
- **Fire-and-Forget:** `commandBus.dispatch(cmd).catch(log)` — fast, errors logged but not propagated to caller

**Decisão:** Fire-and-Forget with error logging.
- **Why:** EventBus subscribers are fire-and-forget by design (Phase 3). Awaiting would block the event flow. Errors are logged; if a rule fails, the next rule still evaluates.

---

## Testes planejados

### RuleEngine.test.ts

| Caso | Tipo | Descrição |
|------|------|-----------|
| Happy path: fee spike matches | Unit | RuleEngine evaluates MemPoolFeeSpike, matches rule, dispatches AlertTriggered command |
| Happy path: no match | Unit | Event evaluated, no matching rules, no command dispatched |
| Multiple rules match same event | Unit | Event matches 2 rules, both commands dispatched |
| Error isolation | Unit | One rule throws, next rule still evaluates, no cascade failure |
| Inactive rules skipped | Unit | Deactivated rule ignored during evaluation |
| Bootstrap subscribes | Unit | After bootstrap(), RuleEngine subscribed to EventBus |

### AlertRuleBuilder.test.ts

| Caso | Tipo | Descrição |
|------|------|-----------|
| Happy path: chaining | Unit | Builder.whenFeeSpike(20).triggerAlert() returns valid Rule |
| Validation: invalid threshold | Unit | whenFeeSpike(150) rejects (% > 100) |
| Validation: invalid peer count | Unit | whenPeerCount(-1) rejects |
| Empty conditions | Unit | Builder with no conditions raises error |
| Build returns Rule | Unit | Rule object has condition + action fields |

### Matcher Strategy Tests

| File | Casos |
|------|-------|
| `FeeSpikeMatcher.test.ts` | MemPoolFeeSpike event detected, fee increase threshold (5%, 50%, 99%) |
| `TransactionSizeMatcher.test.ts` | TransactionDetected event with large tx body |
| `PeerCountMatcher.test.ts` | PeerConnected/PeerDisconnected events, threshold logic |

---

## Definition of done

- [ ] RuleEngine.ts implemented with Chain of Responsibility
- [ ] AlertRuleBuilder.ts with fluent API and validation
- [ ] 3 Matcher strategy classes created
- [ ] SOLID verified on each file
- [ ] JSDoc on all public methods
- [ ] Unit tests written (RuleEngine, Builder, Matchers) — not executed
- [ ] plan.md, implementation.md, review.md created
- [ ] PR description generated

---

## Referências

- Phase 3 complete (EventStore, CommandBus, EventBus in app/backend/src/infra/)
- Domain types: app/backend/src/domain/events/ and app/backend/src/domain/commands/
- Phase 5 will integrate this with tRPC endpoints and frontend subscriptions
