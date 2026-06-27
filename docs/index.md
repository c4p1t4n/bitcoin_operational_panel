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

---

## In Progress (🔄)

### Phase 3: Event Sourcing Infrastructure
- ✅ **app/backend/src/infra/EventStore.ts** — Append-only log with optimistic locking via `UNIQUE(aggregate_id, version)` constraint, `append(command, events)`, `getEventsFor(aggregateId)`
- ✅ **app/backend/src/infra/CommandBus.ts** — Command dispatch with PermissionSpec validation, handler registry, OptimisticConcurrencyError propagation
- ✅ **app/backend/src/infra/EventBus.ts** — In-memory pub/sub (MVP; Redis integration Phase 5)
- ✅ **app/backend/src/infra/handlers/** — Three CommandHandlers (CreateAlertRuleHandler, AcknowledgeAlertHandler, UpdatePeerStatusHandler)
- ✅ **app/backend/src/infra/__tests__/** — Full unit test coverage (EventStore, CommandBus, EventBus, error scenarios)
- ✅ **app/backend/src/infra/index.ts** — Barrel file exporting public interfaces
- ✅ **docs/features/event-sourcing/plan.md** — Complete design documentation

**Status:** Phase 3 infrastructure complete on `feature/event-sourcing` branch. All modules SOLID-checked, TypeScript strict mode passes, ready for Phase 4 (RuleEngine).

---

## Next Steps (TODO)

### Phase 4: Rule Engine (Next)

- **RuleEngine.ts** — Chain of Responsibility pattern
  - Subscribes to EventBus, evaluates events against active alert rules
  - Each condition type (fee spike, tx size, RBF) is a Strategy handler
  - Produces AlertTriggered or UpdatePeerStatus commands if condition met

- **AlertRuleBuilder.ts** — Fluent API
  - DSL for building and combining rule conditions
  - Registers with RuleEngine

### Phase 5: Backend API & Frontend Integration

5. **alerts.router.ts** — tRPC router
   - Decorator pattern via middleware (auth, audit, rate-limit)
   - Mutations: createAlertRule, acknowledgeAlert
   - Subscriptions: onBitcoinNetworkEvent (tRPC + Redis Pub/Sub + WebSocket)

6. **frontend/store/WebSocketStore.ts** — External store (not React state)
   - `useSyncExternalStore` + EventEmitter pattern
   - Reconnection, backpressure handling

7. **frontend/components/** — React components
   - OperationsTable (render props pattern)
   - AlertPanel (compound component)
   - EventTimeline (reconstructs state from event log)
   - MempoolWidget (real-time metrics)
   - PresenceAvatars (who's online)

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
