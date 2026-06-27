# trpc-api — Implementação

**Branch:** `feature/trpc-api`
**Data:** 2026-06-27
**Status:** Implementado

---

## Arquivos criados

### `src/domain/events/AlertRuleCreated.ts`

**Responsabilidade:** DomainEvent emitido quando uma nova regra de alerta é solicitada.
**Pattern aplicado:** Domain Event (mesmo padrão das subclasses existentes).
**Dependências injetadas:** nenhuma.

### `src/infra/rules/RuleDefinitionRepository.ts`

**Responsabilidade:** ler regras ativas e inserir novas regras em `rule_definitions`.
**Pattern aplicado:** Repository.
**Dependências injetadas:** `Database` (Drizzle client tipado com schema).

### `src/infra/rules/RuleDefinitionProjector.ts`

**Responsabilidade:** subscreve `ALERT_RULE_CREATED` no EventBus e projeta para `rule_definitions`.
**Pattern aplicado:** Observer (EventBus subscriber) como projeção de read-model.
**Dependências injetadas:** `IEventBus`, `RuleDefinitionRepository`.

### `src/infra/rules/RuleDefinitionCompiler.ts`

**Responsabilidade:** traduz `configuration` (JSONB) de uma row em `Rule` via `AlertRuleBuilder`.
**Pattern aplicado:** Adapter.
**Dependências injetadas:** nenhuma (função pura sobre `AlertRuleBuilder`).

### `src/bootstrap.ts`

**Responsabilidade:** composition root — instancia EventBus, EventStore, CommandBus
(com os 4 handlers registrados), RuleEngine (com os 3 matchers), RuleDefinitionProjector,
carrega regras ativas de `rule_definitions` via repository+compiler, chama `RuleEngine.bootstrap()`.
**Pattern aplicado:** Composition Root / Dependency Injection.
**Dependências injetadas:** `Database`.

### `src/trpc/context.ts`, `src/trpc/trpc.ts`

**Responsabilidade:** `context.ts` resolve o usuário atual via header `x-user-id` e monta
o `TrpcContext` (`db`, `commandBus`, `eventBus`, `currentUser`); `trpc.ts` expõe a instância
raiz `initTRPC.context<TrpcContext>()`.

### `src/trpc/middleware/{auth,audit,rateLimit}.ts`

**Responsabilidade:**
- `auth.ts` — `protectedProcedure`: rejeita `UNAUTHORIZED` sem `currentUser`, estreita o
  tipo do contexto downstream.
- `audit.ts` — `auditedProcedure`: após mutation resolver, insere row em `operations_log`
  referenciando o primeiro `DomainEvent` retornado.
- `rateLimit.ts` — `rateLimitedProcedure`: limita 30 requisições/60s por `currentUser.id`,
  em memória.

**Pattern aplicado:** Decorator (tRPC middleware chain) — `rateLimitedProcedure` compõe
`auditedProcedure` compõe `protectedProcedure` compõe `publicProcedure`.

### `src/trpc/routers/alerts.router.ts`, `src/trpc/routers/index.ts`

**Responsabilidade:** `createAlertRule` e `acknowledgeAlert` (mutations, `rateLimitedProcedure`,
validação zod, dispatch via `ctx.commandBus.dispatch(command, ctx.currentUser)`);
`onBitcoinNetworkEvent` (subscription pública, `observable` emitindo todo `DomainEvent`
publicado no EventBus, para qualquer um dos `ALL_DOMAIN_EVENT_TYPES`).

### `src/server.ts`

**Responsabilidade:** entrypoint — `checkDatabaseConnection`, `bootstrap(db)`,
`createHTTPServer` (mutations/queries) + `applyWSSHandler` sobre o mesmo HTTP server
(subscriptions), shutdown gracioso em `SIGTERM`/`SIGINT`.

---

## Arquivos modificados

### `src/infra/handlers/CreateAlertRuleHandler.ts`

**O que mudou:** saiu do stub (`return []`) para gerar `AlertRuleCreated` com `aggregateId`
(gerado se ausente), validando que `configuration` não está vazio.
**Por que:** sem isso, nada persistia uma regra criada via `createAlertRule`; era o gap
que impedia "carregar `rule_definitions` no boot" (TODO da Phase 4).

### `src/infra/CommandBus.ts`

**O que mudou:** `dispatch(command, actingUser?)` — `actingUser` opcional sobrescreve o
`getCurrentUser` do construtor.
**Por que:** o `CommandBus` é uma instância única compartilhada por todas as requisições
tRPC e pelo RuleEngine; sem isso, todo dispatch usaria sempre o ator fixo passado no
construtor do bootstrap (`SYSTEM_USER`), e a validação de permissão por usuário real do
tRPC nunca aconteceria. `RuleEngine` continua chamando `dispatch(command)` sem o segundo
argumento — usa o `SYSTEM_USER` do construtor, como antes.

### `src/infra/RuleEngine.ts`

**O que mudou:** a lista local `ALL_EVENT_TYPES` foi substituída pela constante exportada
`ALL_DOMAIN_EVENT_TYPES` (`src/domain/events/index.ts`).
**Por que:** a subscription `onBitcoinNetworkEvent` precisava da mesma lista; manter duas
listas idênticas em arquivos diferentes seria duplicação (DRY). Note que `ALL_DOMAIN_EVENT_TYPES`
agora também inclui `ALERT_RULE_CREATED` — o `RuleEngine` se inscreve nele mas nenhuma regra
tem condição desse tipo, então é inofensivo (nenhum matcher avalia, nenhuma regra casa).

### `src/domain/events/index.ts`

**O que mudou:** adiciona export de `AlertRuleCreated`/`ALERT_RULE_CREATED` e a nova
constante `ALL_DOMAIN_EVENT_TYPES`.

### `src/db/index.ts`

**O que mudou:** exporta `export type Database = NodePgDatabase<typeof schema>`.
**Por que:** `EventStore`, `RuleDefinitionRepository`, `bootstrap`, `context` recebiam um
`NodePgDatabase` bare (genérico `Record<string, never>`), que não é estruturalmente
compatível com o client real (`drizzle(pool, { schema })`) quando o schema tem `relations()`
— erro de tipo só aparecia agora que `server.ts` faz a wiring real (testes usam mocks,
nunca exercitaram essa assinatura). `Database` é o tipo correto e único, usado em todos
os pontos que recebem o client real.

### `app/backend/package.json`, `package.json` (raiz)

**O que mudou:** dependências `@trpc/server`, `ws`, `@types/ws`; scripts `dev`/`start`
(backend) e `dev:trpc` (raiz).

---

## Wiring — como conectar ao sistema

```typescript
// src/server.ts
const app = await bootstrap(db);                          // EventStore, CommandBus, RuleEngine, projector
const createContext = createContextFactory(db, app);

const httpServer = createHTTPServer({ router: appRouter, createContext });
const wss = new WebSocketServer({ server: httpServer });
applyWSSHandler({ wss, router: appRouter, createContext });

httpServer.listen(PORT);
```

```bash
npm run dev:trpc   # tsx watch src/server.ts, a partir da raiz do repo
```

---

## Testes escritos

Nenhum — decisão explícita (ver `plan.md`, mesma decisão da Phase 4). Casos documentados
em `plan.md` § Testes planejados.

---

## Desvios do plano

- `CommandBus.dispatch` ganhou um segundo parâmetro opcional (`actingUser`) não previsto
  explicitamente no `plan.md`; foi necessário para que o CommandBus singleton sirva tanto
  o RuleEngine (ator de sistema) quanto requisições tRPC (usuário real por requisição).
  Mudança aditiva e retrocompatível — `dispatch(command)` continua funcionando como antes.
- `src/db/index.ts` ganhou o type export `Database`, não mencionado no plano — necessário
  para resolver um erro de tipo (`NodePgDatabase` bare vs. client real com schema/relations)
  que só se manifestou ao escrever a wiring real em `server.ts`.
