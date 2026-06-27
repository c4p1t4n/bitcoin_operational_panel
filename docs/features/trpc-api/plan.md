# trpc-api — Plano

**Branch:** `feature/trpc-api`
**Data:** 2026-06-27
**Status:** Planejamento

---

## O que faz

Expõe a camada de domínio (CommandBus, EventBus, RuleEngine) via API tRPC — mutations
para criar regras de alerta e confirmar alertas, subscription para stream de eventos de
domínio em tempo real — e fornece o composition root (`bootstrap.ts` + `server.ts`) que
liga EventStore, CommandBus, handlers e RuleEngine num processo real, carregando regras
ativas de `rule_definitions` no boot.

## Por que

Fases 2-4 entregaram domínio, event sourcing e rule engine isolados, mas nada os conecta
a um processo executável nem expõe a um cliente. Sem isso, `RuleEngine.addRule()` nunca é
chamado com dados reais e não há forma de criar uma regra de alerta de fora de um teste
unitário. Esta feature fecha esse ciclo: HTTP/WS de entrada → CommandBus → EventStore →
EventBus → RuleEngine → CommandBus (TriggerAlert) → EventStore → EventBus → tRPC subscription
de volta ao cliente.

## Escopo

### Inclui
- Corrigir `CreateAlertRuleHandler` (hoje retorna `[]`, é só placeholder) para gerar um
  evento `AlertRuleCreated` real.
- Novo evento de domínio `AlertRuleCreated` (`app/backend/src/domain/events/AlertRuleCreated.ts`).
- `RuleDefinitionRepository` — leitura/escrita da tabela `rule_definitions` via Drizzle.
- `RuleDefinitionProjector` — subscriber do EventBus em `ALERT_RULE_CREATED` que persiste a
  row em `rule_definitions` (a tabela é um read-model, não o aggregate `events`).
- `RuleDefinitionCompiler` — converte uma row de `rule_definitions` (JSONB `configuration`)
  numa `Rule` compilada via `AlertRuleBuilder`, para alimentar `RuleEngine.addRule()`.
- `bootstrap.ts` — composition root: instancia `db`, `EventBus`, `EventStore`, `CommandBus`,
  registra os 4 handlers existentes, registra os 3 matchers no `RuleEngine`, carrega regras
  ativas de `rule_definitions` via repository+compiler, chama `RuleEngine.bootstrap()`.
- tRPC: `context.ts`, `alerts.router.ts` (`createAlertRule`, `acknowledgeAlert` mutations;
  `onBitcoinNetworkEvent` subscription), middlewares `auth`, `audit`, `rateLimit`.
- `server.ts` — entrypoint HTTP (`@trpc/server/adapters/standalone`) + WS
  (`@trpc/server/adapters/ws`) para subscriptions.
- Dependências novas: `@trpc/server`, `ws`, `@types/ws`.

### Não inclui (explicitamente fora do escopo)
- Frontend (store, componentes React) — feature separada, decidido com o dev.
- Sistema de autenticação real — `context.ts` usa um placeholder (`x-user-id` header →
  lookup em `users`), consistente com o placeholder já existente em `PermissionSpec`.
  Documentado como TODO explícito.
- Migração de `PeerCountMatcher` para Redis — já documentado como TODO da Phase 4.
- EventBus distribuído via Redis — mantém-se em memória (single-instance); `ioredis` já é
  dependência mas não é usado aqui. Risco aceito e documentado: subscriptions tRPC só veem
  eventos publicados na mesma instância de processo.
- Testes unitários — não solicitados pelo dev nesta rodada (mesma decisão da Phase 4).

---

## Módulos afetados

| Arquivo | Tipo de mudança | Responsabilidade |
|---------|----------------|-------------------|
| `src/domain/events/AlertRuleCreated.ts` | Criação | Novo DomainEvent para criação de regra |
| `src/domain/events/index.ts` | Modificação | Exportar novo evento |
| `src/infra/handlers/CreateAlertRuleHandler.ts` | Modificação | Sair do stub, gerar `AlertRuleCreated` |
| `src/infra/RuleEngine.ts` | Modificação | Subscrever também a `ALERT_RULE_CREATED` (para invalidar/reload futuro — fora de escopo agora, apenas lista) |
| `src/infra/rules/RuleDefinitionRepository.ts` | Criação | CRUD mínimo sobre `rule_definitions` |
| `src/infra/rules/RuleDefinitionProjector.ts` | Criação | Subscriber EventBus → persiste em `rule_definitions` |
| `src/infra/rules/RuleDefinitionCompiler.ts` | Criação | JSONB `configuration` → `Rule` via `AlertRuleBuilder` |
| `src/bootstrap.ts` | Criação | Composition root — instancia e liga todo o domínio |
| `src/trpc/context.ts` | Criação | Contexto tRPC: `getCurrentUser`, `commandBus`, `eventBus` |
| `src/trpc/trpc.ts` | Criação | `initTRPC`, exporta `router`/`procedure` base |
| `src/trpc/middleware/auth.ts` | Criação | Decorator — exige usuário autenticado |
| `src/trpc/middleware/audit.ts` | Criação | Decorator — loga toda mutation em `operations_log` |
| `src/trpc/middleware/rateLimit.ts` | Criação | Decorator — limite simples em memória por usuário |
| `src/trpc/routers/alerts.router.ts` | Criação | `createAlertRule`, `acknowledgeAlert`, `onBitcoinNetworkEvent` |
| `src/trpc/routers/index.ts` | Criação | `appRouter` raiz |
| `src/server.ts` | Criação | Entrypoint HTTP+WS |
| `package.json` (backend) | Modificação | `@trpc/server`, `ws`, `@types/ws`, script `dev` |

---

## Interfaces planejadas

### `AlertRuleCreated` (DomainEvent)

```typescript
export const ALERT_RULE_CREATED = "ALERT_RULE_CREATED" as const;

export interface AlertRuleCreatedPayload {
  name: string;
  description?: string;
  ruleType: string;
  configuration: Record<string, unknown>;
  requestedByUserId: string;
}

export class AlertRuleCreated extends DomainEvent<AlertRuleCreatedPayload> {
  constructor(aggregateId: string, version: number, payload: AlertRuleCreatedPayload);
}
```

### `RuleDefinitionRepository`

```typescript
export interface RuleDefinitionRow {
  id: string;
  name: string;
  description: string | null;
  ruleType: string;
  configuration: Record<string, unknown>;
  isActive: boolean;
}

export interface RuleDefinitionRepository {
  loadActive(): Promise<RuleDefinitionRow[]>;
  insert(row: Omit<RuleDefinitionRow, "id"> & { id: string }): Promise<void>;
}
```

**Dependências injetadas:** `db` (Drizzle client).

### `RuleDefinitionProjector`

```typescript
export interface RuleDefinitionProjector {
  start(): void; // subscreve EventBus em ALERT_RULE_CREATED
  stop(): Promise<void>;
}
```

**Dependências injetadas:** `eventBus`, `repository: RuleDefinitionRepository`.

### `RuleDefinitionCompiler`

```typescript
export interface RuleDefinitionCompiler {
  compile(row: RuleDefinitionRow): Rule; // usa AlertRuleBuilder internamente
}
```

`configuration` (JSONB) tem o formato:

```json
{
  "conditions": [{ "type": "FEE_SPIKE", "threshold": 20 }],
  "action": { "kind": "TRIGGER_ALERT", "title": "Fee spike", "severity": "HIGH" }
}
```

ou `{ "kind": "UPDATE_PEER_STATUS", "aggregateId": "...", "connected": true }`.

**Dependências injetadas:** nenhuma — função pura sobre `AlertRuleBuilder`.

### tRPC context

```typescript
export interface TrpcContext {
  commandBus: ICommandDispatcher;
  eventBus: IEventBus;
  currentUser: User | null;
}
```

### `alerts.router.ts`

```typescript
createAlertRule: protectedProcedure
  .input(CreateAlertRuleInput) // zod
  .mutation(...) // dispatch CreateAlertRule via commandBus

acknowledgeAlert: protectedProcedure
  .input(AcknowledgeAlertInput)
  .mutation(...) // dispatch AcknowledgeAlert via commandBus

onBitcoinNetworkEvent: publicProcedure
  .subscription(...) // observable que emite eventBus.subscribe(eventType, ...) para todos os ALL_EVENT_TYPES
```

**Dependências injetadas:** `commandBus`, `eventBus` (via context, não instanciados no router).

---

## Decisões de design

### Decisão 1: `rule_definitions` é um read-model, não um aggregate do `events`

**Contexto:** `CreateAlertRuleHandler` produzia `[]` porque não havia destino claro para o
evento gerado — `rule_definitions` não é a tabela `events`.
**Opções consideradas:**
- A) Tratar `AlertRule` como aggregate normal, persistido só em `events`, e reconstruir via
  replay a cada boot. Prós: consistente com o resto do domínio. Contras: `rule_definitions`
  já existe no schema com índices (`idx_rules_active`, `idx_rules_type`) pensados para leitura
  direta — replay a cada boot seria desperdício e mais lento.
- B) Handler escreve direto em `rule_definitions` E em `events`. Contras: viola responsabilidade
  única do handler (handlers só retornam eventos, nunca persistem).
- C) Handler retorna `AlertRuleCreated` (persistido em `events` como sempre); um
  `RuleDefinitionProjector` dedicado, subscrito ao EventBus, projeta para `rule_definitions`.
**Decisão:** C. Mantém o handler puro (Single Responsibility), reusa o pipeline EventStore→
EventBus já existente, e trata `rule_definitions` explicitamente como projeção/read-model —
mesmo padrão que `PeerCountMatcher` já usa (estado derivado de eventos, fora do event log).

### Decisão 2: EventBus permanece em memória (não migra para Redis nesta feature)

**Contexto:** `docs/next_steps.md` menciona Redis para o EventBus desde a Phase 3, mas a
implementação atual (`EventBus.ts`) é só Pub/Sub em memória.
**Opções consideradas:**
- A) Migrar para Redis agora, já que tRPC subscriptions seriam o primeiro consumidor real
  cross-processo.
- B) Manter em memória, documentar como limitação conhecida.
**Decisão:** B. Migrar EventBus é uma mudança ortogonal e maior (afeta `RuleEngine`, todos os
testes existentes, `EventStore`); fazê-la misturada com a wiring de tRPC tornaria o PR difícil
de revisar. Fica registrado como TODO explícito — sem Redis, múltiplas instâncias do processo
não compartilham subscriptions.

### Decisão 3: Auth placeholder via header `x-user-id`

**Contexto:** não há sistema de autenticação (`docs/next_steps.md`: "No auth system yet").
**Decisão:** `context.ts` lê `x-user-id` do request, busca o `User` em `users` via Drizzle.
Se ausente ou não encontrado, `currentUser: null` — middleware `auth` rejeita com
`TRPCError({ code: "UNAUTHORIZED" })`. Mesma postura de placeholder que `PermissionSpec` já
assume; documentado como TODO para substituição por sessão/JWT real.

---

## Testes planejados

*Não solicitados nesta rodada — mesma decisão tomada na Phase 4. Casos abaixo documentados
para quando o dev pedir explicitamente.*

| Caso | Tipo | Descrição |
|------|------|-----------|
| Happy path | Unit | `CreateAlertRuleHandler` gera `AlertRuleCreated` com payload correto |
| Happy path | Unit | `RuleDefinitionProjector` persiste row em `rule_definitions` ao receber `ALERT_RULE_CREATED` |
| Happy path | Unit | `RuleDefinitionCompiler` compila configuration válida em `Rule` com conditions+action corretos |
| Edge case | Unit | `RuleDefinitionCompiler` lança erro descritivo se `action.kind` desconhecido |
| Edge case | Unit | `bootstrap()` não falha se `rule_definitions` está vazia |
| Erro esperado | Unit | `auth` middleware rejeita `UNAUTHORIZED` sem `x-user-id` |
| Erro esperado | Unit | `rateLimit` middleware rejeita `TOO_MANY_REQUESTS` acima do limite |
| Integração | Integration | `createAlertRule` mutation → row em `rule_definitions` → `RuleEngine.addRule()` após reboot |
| Integração | Integration | `onBitcoinNetworkEvent` subscription recebe `AlertTriggered` publicado pelo RuleEngine |

---

## Definition of done

- [ ] Todos os módulos implementados
- [ ] SOLID verificado em cada arquivo
- [ ] JSDoc em todos os métodos públicos
- [ ] Testes unitários não escritos (decisão explícita, ver acima)
- [ ] `npm run typecheck -w app/backend` passa
- [ ] plan.md, implementation.md e review.md criados
- [ ] `docs/index.md` e `docs/next_steps.md` atualizados
- [ ] PR description gerada
