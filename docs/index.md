# Bitcoin Operations Panel — Implementation Index

## Completed (✅)

### Adapter Layer
- ✅ **bitcoin.types.ts** — Strong types for RPC responses (BlockchainInfo, MempoolInfo, MempoolEntry, FeeEstimate, JSON-RPC envelope)
- ✅ **BitcoinRPCAdapter.ts** — Adapter pattern isolating HTTP JSON-RPC transport behind `BitcoinRPCClient` interface; `BitcoinRPCError` for typed error handling
- ✅ **BasePoller.ts** — Template Method base class for polling cycle (start/stop/no-overlap scheduling); reusable by MempoolPoller and future BlockWatcher
- ✅ **MempoolPoller.ts** — Observer that diffs mempool snapshots and emits `tx:added`, `tx:removed`, `fee:spike`, `poll:error`

### Tooling & Validation
- ✅ **app/backend/package.json** — Workspace manifest (ESM, vitest, tsx, typescript, dotenv)
- ✅ **app/backend/tsconfig.json** — ES2022 target, Bundler resolution, strict mode, `types: ["node"]`
- ✅ **app/backend/.env.example** — RPC connection template
- ✅ **scripts/watch-mempool.ts** — Manual wiring demo (connects adapter + poller, prints events to console)

### Documentation
- ✅ **docs/features/bitcoin-node-integration/plan.md** — Scope, interfaces, design decisions, test plan
- ✅ **docs/features/bitcoin-node-integration/implementation.md** — What was built and why
- ✅ **docs/features/bitcoin-node-integration/review.md** — SOLID checklist, known trade-offs, next steps

### Testing & Validation
- ✅ Typecheck: `tsc --noEmit` clean
- ✅ Live validation: `scripts/watch-mempool.ts` ran against real node (Bitcoin Core 24.0.1, pruned) with no errors
- ✅ Typed probe: confirmed RPC response shapes match implementation

**Status:** First vertical slice complete on `feature/bitcoin-node-integration` branch. Validated against real Bitcoin node. Mempool empty (node mid-IBD) — re-verify `tx:added`/`fee:spike` once node is synced.

### Phase 2: Database Schema & Domain Layer
- ✅ **app/infra/docker-compose.yml** — PostgreSQL 16 with health checks and persistent volume
- ✅ **app/infra/schema.ts** — Drizzle ORM: users, events (append-only), alerts, operations_log, peers_status, rule_definitions
- ✅ **app/backend/src/domain/types.ts** — User, Alert, Role, AggregateType shared vocabulary
- ✅ **app/backend/src/domain/events/** — DomainEvent base class + subclasses (MemPoolFeeSpike, AlertTriggered, AlertAcknowledged, PeerConnected, PeerDisconnected, NewBlockMined, TransactionDetected)
- ✅ **app/backend/src/domain/commands/** — Command base class + subclasses (CreateAlertRule, AcknowledgeAlert, UpdatePeerStatus)
- ✅ **app/backend/src/domain/specs/PermissionSpec.ts** — Authorization rules (ADMIN, OPERATOR, VIEWER roles)
- ✅ **app/backend/src/db/index.ts** — Drizzle client, connection pool, health checks, graceful shutdown
- ✅ **app/backend/drizzle.config.ts** — Migration config
- ✅ **docs/features/database-schema-and-domain/plan.md, implementation.md, review.md** — Complete documentation

**Status:** Phase 2 complete on `feature/schema-and-domain` branch. All domain types, database schema, and tooling ready. TypeScript strict mode passes.

### Phase 3: Event Sourcing Infrastructure
- ✅ **app/backend/src/infra/EventStore.ts** — Append-only log with optimistic locking via `UNIQUE(aggregate_id, version)` constraint, `append(command, events)`, `getEventsFor(aggregateId)`
- ✅ **app/backend/src/infra/CommandBus.ts** — Command dispatch with PermissionSpec validation, handler registry, OptimisticConcurrencyError propagation
- ✅ **app/backend/src/infra/EventBus.ts** — In-memory pub/sub (MVP; Redis integration Phase 5)
- ✅ **app/backend/src/infra/handlers/** — Three CommandHandlers (CreateAlertRuleHandler, AcknowledgeAlertHandler, UpdatePeerStatusHandler)
- ✅ **app/backend/src/infra/__tests__/** — Full unit test coverage (EventStore, CommandBus, EventBus, error scenarios)
- ✅ **app/backend/src/infra/index.ts** — Barrel file exporting public interfaces
- ✅ **docs/features/event-sourcing/plan.md** — Complete design documentation

**Status:** Phase 3 infrastructure complete on `feature/event-sourcing` branch. All modules SOLID-checked, TypeScript strict mode passes.

### Phase 4: Rule Engine
- ✅ **app/backend/src/infra/RuleEngine.ts** — Chain of Responsibility; subscribes to all known domain event types via EventBus, evaluates active rules, dispatches matching commands through CommandBus (fire-and-forget, errors isolated per rule)
- ✅ **app/backend/src/infra/rules/AlertRuleBuilder.ts** — Fluent DSL (`.whenFeeSpike(20).triggerAlert(...)`) with threshold validation
- ✅ **app/backend/src/infra/rules/ConditionMatcher.ts**, **Rule.ts** — Strategy interface and rule vocabulary (RuleCondition, RuleAction, Rule)
- ✅ **app/backend/src/infra/rules/matchers/** — FeeSpikeMatcher, TransactionSizeMatcher, PeerCountMatcher (stateful — tracks connected peer count)
- ✅ **app/backend/src/domain/commands/TriggerAlert.ts** + **app/backend/src/infra/handlers/TriggerAlertHandler.ts** — new Command/Handler pair so RuleEngine can produce `AlertTriggered` via CommandBus (it previously existed only as a DomainEvent with no Command path)
- ✅ **app/backend/src/infra/CommandBus.ts** — added `TRIGGER_ALERT` permission case
- ✅ **docs/features/rule-engine/plan.md, implementation.md, review.md** — Complete documentation, including known trade-offs (no EventBus wildcard subscribe, in-memory peer count state, single-event evaluation model)

**Status:** Phase 4 complete on `feature/rule-engine` branch. TypeScript strict mode passes. Unit tests skipped this round at dev's request — planned cases preserved in `plan.md`. Bootstrap wiring (handler registration, loading `rule_definitions` from Postgres) deferred to Phase 5.

### Phase 5a: tRPC API & Bootstrap Wiring
- ✅ **app/backend/src/domain/events/AlertRuleCreated.ts** — new DomainEvent; fixes the `CreateAlertRuleHandler` stub that previously returned `[]` and never persisted anything
- ✅ **app/backend/src/infra/rules/RuleDefinitionRepository.ts**, **RuleDefinitionProjector.ts**, **RuleDefinitionCompiler.ts** — `rule_definitions` treated as a read-model: handler emits `AlertRuleCreated` → projector persists the row → compiler turns JSONB `configuration` into a `Rule` via `AlertRuleBuilder`
- ✅ **app/backend/src/bootstrap.ts** — composition root: wires EventBus, EventStore, CommandBus (4 handlers registered), RuleEngine (3 matchers registered), loads active rules from `rule_definitions`, calls `RuleEngine.bootstrap()`
- ✅ **app/backend/src/trpc/** — `context.ts` (placeholder `x-user-id` auth), `trpc.ts`, `middleware/{auth,audit,rateLimit}.ts` (Decorator chain), `routers/alerts.router.ts` (`createAlertRule`, `acknowledgeAlert` mutations; `onBitcoinNetworkEvent` subscription)
- ✅ **app/backend/src/server.ts** — HTTP (`@trpc/server/adapters/standalone`) + WS (`@trpc/server/adapters/ws`) entrypoint, graceful shutdown
- ✅ **app/backend/src/infra/CommandBus.ts** — `dispatch(command, actingUser?)`, backward-compatible, lets the singleton CommandBus serve both the RuleEngine (system actor) and per-request tRPC users
- ✅ **app/backend/src/db/index.ts** — exports `Database` type (`NodePgDatabase<typeof schema>`), fixing a latent type mismatch between the schema-typed client and the bare `NodePgDatabase` type used by `EventStore`/`RuleDefinitionRepository`
- ✅ **docs/features/trpc-api/plan.md, implementation.md, review.md** — full documentation

**Status:** Phase 5a complete on `feature/trpc-api` branch. TypeScript strict mode passes. Frontend deferred to a separate feature, by agreement with the dev. Unit tests not written this round (same decision as Phase 4).

### Phase 5b: Frontend Integration
- ✅ **app/frontend/** — new npm workspace: Vite + React 18 + TypeScript strict, no `@trpc/react-query` (external store required by the roadmap, not React-managed data fetching)
- ✅ **app/frontend/src/trpc/client.ts** — `createWSClient` (with `connectionParams`, since browsers can't set custom WS handshake headers) + `createTRPCClient` (`splitLink`: subscriptions → `wsLink`, mutations → `httpBatchLink` with `x-user-id` header)
- ✅ **app/frontend/src/store/WebSocketFeed.ts** — external store implementing the `useSyncExternalStore` contract; circular buffer (max 500 events, drops oldest — backpressure), connection-state tracking, reconnects on user switch
- ✅ **app/frontend/src/domain/events.ts** — frontend-local event types/constants (deliberately *not* imported from the backend — those modules pull in `node:crypto` via `DomainEvent`, which would break the browser bundle on a value import)
- ✅ **app/frontend/src/components/** — `OperationsTable` (render props) + `OperationsView` adapter, `AlertPanel` (compound component), `EventTimeline`, `MempoolWidget`, plus `UserSwitcher` and `CreateAlertRuleForm` (minimal UI for the auth/rule-creation placeholders)
- ✅ **app/backend/src/trpc/context.ts** — small backend fix: resolves the current user from `connectionParams` (WS) in addition to the `x-user-id` header (HTTP)
- ✅ Manually verified with the Vite dev server + headless Chromium (no `chromium-cli` available in this environment) — caught and fixed a real `useSyncExternalStore` infinite-render-loop bug (`getSnapshot()` was returning a new object on every call)
- ✅ **docs/features/frontend-dashboard/plan.md, implementation.md, review.md** — full documentation
- ❌ **PresenceAvatars** — dropped from scope: no user-presence domain event exists (`PeerConnected`/`PeerDisconnected` are Bitcoin node peers, not panel users), so there's nothing to render

**Status:** Phase 5b complete on `feature/frontend-dashboard` branch (based on `feature/trpc-api`, not yet merged to `main`). TypeScript strict mode passes for both workspaces. No historical/persisted data — components are driven entirely by the live WebSocket stream since page load (no read/query procedures exist on the backend yet).

---

## In Progress (🔄)

_None._

---

## Next Steps (TODO)

### Phase 6: Read Queries & Real Auth

1. Backend read procedures (`alerts.list`, `operations.list`) so the frontend survives a page reload
2. Real authentication, replacing the `x-user-id`/`connectionParams` placeholder on both sides
3. Merge `feature/trpc-api` and `feature/frontend-dashboard` into `main`

---

## Architecture Reminders

- **Order matters:** later phases assume earlier phases exist
- **SRP:** each class has one reason to change (adapter doesn't persist, poller doesn't notify, etc.)
- **SOLID:** checked on every file; see `.skills/feature/references/solid-constraints.md`
- **Testing:** unit tests written (not executed) per phase; see `.skills/feature/SKILL.md`
- **Patterns are concrete:** not decorative — each one solves a real problem in this codebase

---

## How to Read This

- **New to the project?** Start with completed `bitcoin.types.ts` + `BitcoinRPCAdapter.ts` (10 min each, real data), then `MempoolPoller.ts` (see live events). These are the "tangible proof it works" phase.
- **Ready to extend?** Pick the next TODO phase, create `feature/{name}` off `main`, and follow `.skills/feature/SKILL.md` workflow.
- **Reviewing code?** Each file's `@module` header explains the pattern and responsibility; see `review.md` for SOLID checklist; see `plan.md` for design decisions.
